import DatabaseLib from 'better-sqlite3';
import { createVaultService } from '@mypassword/shared-core';
import { Database } from '../database';
import {
  DesktopCryptoAdapter,
  DesktopKeyStoreAdapter,
  DesktopStorageAdapter,
} from '../../shared/desktop-adapter-map';
import { encryptPasswordField, generateSalt, hashPassword } from '../crypto';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => process.cwd())
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => false),
    encryptString: jest.fn((value: string) => Buffer.from(value, 'utf8')),
    decryptString: jest.fn((value: Buffer) => value.toString('utf8')),
  }
}));

describe('Desktop VaultService integration', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(new DatabaseLib(':memory:'));
  });

  afterEach(() => {
    db.close();
  });

  function createDesktopService() {
    const storage = new DesktopStorageAdapter(db);
    const keystore = new DesktopKeyStoreAdapter({
      getSetting: key => db.getSetting(key),
      setSetting: (key, value) => db.setSetting(key, value),
    });
    return createVaultService(storage, keystore, new DesktopCryptoAdapter());
  }

  test('shared vault service reads existing desktop database entries and secrets after unlock', async () => {
    const id = db.addPassword({
      title: 'Local Account',
      username: 'local@example.com',
      password: 'local-secret',
      url: 'https://example.com',
      category: 'Local',
    });

    const service = createDesktopService();

    await service.initialize();

    const summaries = await service.listSummaries();
    const secret = await service.getPlaintextPassword(String(id));

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: String(id),
      title: 'Local Account',
      username: 'local@example.com',
      url: 'https://example.com',
      category: 'Local',
    });
    expect(secret).toBe('local-secret');
  });

  test('shared vault service decrypts legacy desktop ciphertext rows', async () => {
    const legacyCiphertext = encryptPasswordField('legacy-secret', Buffer.from('0123456789abcdef0123456789abcdef', 'utf8'));
    db.addPasswordCiphertext({
      title: 'Legacy Account',
      username: 'legacy@example.com',
      password: legacyCiphertext,
      url: 'https://legacy.example.com',
      category: 'Legacy',
    });
    db.setSetting('crypto.dek.wrapped.v1', `plain:v1:${Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}`);

    const service = createDesktopService();
    await service.initialize();

    const summaries = await service.listSummaries();
    await expect(service.getPlaintextPassword(String(summaries[0].id))).resolves.toBe('legacy-secret');
  });

  test('unlocking through VaultService clears its locked state so desktop data can load', async () => {
    db.addPassword({
      title: 'Locked Local Account',
      username: 'locked@example.com',
      password: 'locked-secret',
    });

    const salt = generateSalt();
    db.setLockPassword(hashPassword('lock-pass', salt), salt.toString('hex'));

    const service = createDesktopService();
    await service.initialize();

    await expect(service.listSummaries()).rejects.toThrow('LOCK_REQUIRED');
    await expect(service.unlock('lock-pass')).resolves.toBe(true);
    await expect(service.listSummaries()).resolves.toHaveLength(1);
  });

  test('shared vault service exports existing desktop database entries', async () => {
    db.addPassword({
      title: 'Exported Account',
      username: 'exported@example.com',
      password: 'exported-secret',
      url: 'https://exported.example.com',
      category: 'Exported',
    });

    const service = createDesktopService();
    await service.initialize();

    await expect(service.exportVault('export-pass')).resolves.toBeInstanceOf(Uint8Array);
  });

  test('shared vault service creates desktop entries that round-trip through core decrypt', async () => {
    const service = createDesktopService();
    await service.initialize();

    const id = await service.createEntry({
      title: 'Created Account',
      username: 'created@example.com',
      plaintextPassword: 'created-secret',
      url: 'https://created.example.com',
      category: 'Created',
    });

    await expect(service.getPlaintextPassword(id)).resolves.toBe('created-secret');
    await expect(service.listSummaries()).resolves.toEqual([
      expect.objectContaining({
        id,
        title: 'Created Account',
        username: 'created@example.com',
        url: 'https://created.example.com',
        category: 'Created',
      })
    ]);
  });

  test('shared vault service updates desktop entry passwords that round-trip through core decrypt', async () => {
    const id = db.addPassword({
      title: 'Updated Account',
      username: 'updated@example.com',
      password: 'old-secret',
    });

    const service = createDesktopService();
    await service.initialize();

    await service.updateEntry(String(id), { plaintextPassword: 'new-secret' });

    await expect(service.getPlaintextPassword(String(id))).resolves.toBe('new-secret');
  });

  test('shared vault service honors existing desktop lock settings keys', async () => {
    const salt = generateSalt();
    db.setLockPassword(hashPassword('desktop-pass', salt), salt.toString('hex'));

    const service = createDesktopService();
    await service.initialize();

    await expect(service.getLockState()).resolves.toMatchObject({
      hasPassword: true,
      isLocked: true,
    });
    await expect(service.unlock('desktop-pass')).resolves.toBe(true);
    await expect(service.getLockState()).resolves.toMatchObject({
      hasPassword: true,
      isLocked: false,
    });
  });
});

