const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { app, safeStorage } = require('electron');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PASSWORD_FIELD_PREFIX = 'enc:v1:';
const DATA_ENCRYPTION_KEY_SAFE_PREFIX = 'safe:v1:';
const DATA_ENCRYPTION_KEY_PLAIN_PREFIX = 'plain:v1:';
const BACKUP_PATH_KEY = 'crypto.migration.passwords.v1.backupPath';
const DATA_KEY_KEY = 'crypto.dek.wrapped.v1';

function unwrapDataEncryptionKey(stored) {
  if (stored.startsWith(DATA_ENCRYPTION_KEY_SAFE_PREFIX)) {
    const payload = stored.slice(DATA_ENCRYPTION_KEY_SAFE_PREFIX.length);
    const decrypted = safeStorage.decryptString(Buffer.from(payload, 'base64'));
    return Buffer.from(decrypted, 'base64');
  }

  if (stored.startsWith(DATA_ENCRYPTION_KEY_PLAIN_PREFIX)) {
    const payload = stored.slice(DATA_ENCRYPTION_KEY_PLAIN_PREFIX.length);
    return Buffer.from(payload, 'base64');
  }

  throw new Error('Invalid wrapped key format');
}

function decryptPasswordField(value, key) {
  if (typeof value !== 'string' || !value.startsWith(PASSWORD_FIELD_PREFIX)) {
    return value;
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error('Invalid data encryption key length');
  }

  const payload = value.slice(PASSWORD_FIELD_PREFIX.length);
  const data = Buffer.from(payload, 'base64');
  if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid password ciphertext format');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function encryptPasswordField(plainText, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${PASSWORD_FIELD_PREFIX}${payload}`;
}

function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function resolveSourceDb() {
  const appDataPath = app.getPath('appData');
  const candidates = [
    path.join(appDataPath, 'MyPassword', 'passwords.db'),
    path.join(appDataPath, 'mypassword', 'passwords.db'),
  ];

  const diagnostics = [];

  for (const candidate of candidates) {
    const info = { path: candidate, exists: fs.existsSync(candidate) };
    diagnostics.push(info);

    if (!info.exists) {
      continue;
    }

    const db = new Database(candidate, { readonly: true });
    try {
      const wrappedKey = getSetting(db, DATA_KEY_KEY);
      const backupPath = getSetting(db, BACKUP_PATH_KEY);
      info.keyPrefix = wrappedKey ? wrappedKey.slice(0, 8) : null;
      info.hasBackupPath = Boolean(backupPath);

      if (!wrappedKey) {
        info.unwrap = 'missing-key';
        continue;
      }

      try {
        const dataKey = unwrapDataEncryptionKey(wrappedKey);
        info.unwrap = 'ok';
        info.keyLength = dataKey.length;
        return { sourceDbPath: candidate, dataKey, diagnostics };
      } catch (error) {
        info.unwrap = 'failed';
        info.unwrapError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      db.close();
    }
  }

  const detail = JSON.stringify(diagnostics, null, 2);
  throw new Error(`Could not resolve a decryptable passwords.db. Diagnostics:\n${detail}`);
}

function recoverPasswordSecretFromBackup(db, backupPath, id, dataKey) {
  const backupDb = new Database(backupPath, { readonly: true });
  try {
    const row = backupDb.prepare('SELECT password FROM passwords WHERE id = ?').get(id);
    if (!row) {
      return null;
    }

    const rawPassword = row.password || '';
    if (rawPassword.startsWith(PASSWORD_FIELD_PREFIX)) {
      return null;
    }

    const repairedCiphertext = encryptPasswordField(rawPassword, dataKey);
    db.prepare("UPDATE passwords SET password = ?, updatedAt = strftime('%s', 'now') WHERE id = ?").run(repairedCiphertext, id);
    return rawPassword;
  } finally {
    backupDb.close();
  }
}

async function main() {
  await app.whenReady();

  const { sourceDbPath, dataKey, diagnostics } = resolveSourceDb();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mypassword-recovery-check-'));
  const copyDbPath = path.join(tempDir, 'passwords.db');
  fs.copyFileSync(sourceDbPath, copyDbPath);

  const db = new Database(copyDbPath);
  try {
    const wrappedKey = getSetting(db, DATA_KEY_KEY);
    const backupPath = getSetting(db, BACKUP_PATH_KEY);
    if (!wrappedKey || !backupPath) {
      throw new Error('Missing active DEK or backup path');
    }
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup DB not found: ${backupPath}`);
    }

    const rows = db.prepare('SELECT id, title, username, password FROM passwords ORDER BY id').all();

    let failures = 0;
    let recovered = 0;
    const samples = [];

    for (const row of rows) {
      try {
        decryptPasswordField(row.password, dataKey);
      } catch (error) {
        failures += 1;
        const before = error instanceof Error ? error.message : String(error);
        const raw = recoverPasswordSecretFromBackup(db, backupPath, row.id, dataKey);
        if (raw === null) {
          samples.push({ id: row.id, title: row.title, username: row.username, before, recovered: false });
          continue;
        }

        const repaired = db.prepare('SELECT password FROM passwords WHERE id = ?').get(row.id).password;
        const roundTrip = decryptPasswordField(repaired, dataKey);
        recovered += 1;
        samples.push({ id: row.id, title: row.title, username: row.username, before, recovered: true, roundTripMatches: roundTrip === raw });
      }
    }

    console.log(JSON.stringify({
      sourceDbPath,
      backupPath,
      safeStorageAvailable: safeStorage.isEncryptionAvailable(),
      candidateDiagnostics: diagnostics,
      scanned: rows.length,
      failures,
      recovered,
      unrecovered: failures - recovered,
      samples: samples.slice(0, 10)
    }, null, 2));
  } finally {
    db.close();
    app.quit();
  }
}

main().catch(error => {
  console.error(error);
  app.quit();
  process.exitCode = 1;
});

