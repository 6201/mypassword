import crypto from 'crypto';
import { safeStorage } from 'electron';
import type {
  CryptoAdapter,
  EncryptedBlob,
  EntryId,
  KeyStoreAdapter,
  StorageAdapter,
  VaultEntry,
} from '@mypassword/shared-core';
import type { Database, PasswordEntry } from '../main/database';
import {
  decryptPasswordField,
  encryptPasswordField,
  hashPassword,
  verifyPassword,
  isEncryptedPasswordField,
} from '../main/crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const STORAGE_SAFE_PREFIX = 'safe:v1:';
const STORAGE_PLAIN_PREFIX = 'plain:v1:';
const LOCK_SECRET_SAFE_PREFIX = 'safe-lock:v1:';
const LOCK_SECRET_PLAIN_PREFIX = 'plain-lock:v1:';
export const LOCK_SECRET_DIGEST_KEY = 'lock.secretDigest.v1';
const LOCK_SECRET_TOKEN_KEY = 'lock.secretTokenWrapped.v1';
export const DEVICE_KEY_UNAVAILABLE_ERROR = '设备密钥不可用，请重置锁屏密码';

export interface LockSecretSettingsStore {
  getSetting(key: string): Promise<string | null> | string | null;
  setSetting(key: string, value: string | null): Promise<void> | void;
}

export function computeLockSecretDigest(lockSecretRaw: string): string {
  return crypto.createHash('sha256').update(lockSecretRaw, 'utf8').digest('hex');
}

function toEntryId(id: number): EntryId {
  return String(id);
}

function toNumericId(id: EntryId): number {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid entry id: ${id}`);
  }
  return value;
}

function stripPrefix(value: string, prefix: string): string | null {
  if (!value.startsWith(prefix)) {
    return null;
  }

  return value.slice(prefix.length);
}

// 辅助函数：将桌面数据库格式（enc:v1:...）转换为 JSON EncryptedBlob 格式
function convertDesktopFormatToEncryptedBlob(desktopFormat: string): EncryptedBlob {
  if (isEncryptedPasswordField(desktopFormat)) {
    // 提取 base64 部分
    const base64Part = desktopFormat.slice('enc:v1:'.length);
    return {
      version: 'v1',
      algorithm: ENCRYPTION_ALGORITHM,
      payloadBase64: base64Part,
    };
  } else {
    // 如果是明文，需要加密然后转换
    // 注意：这应该是不会发生的，因为密码应该是已加密的
    throw new Error('Expected encrypted password field');
  }
}

// 辅助函数：将 JSON EncryptedBlob 格式转换为桌面数据库格式（enc:v1:...）
function convertEncryptedBlobToDesktopFormat(blob: EncryptedBlob): string {
  // blob.payloadBase64 已经是 base64 格式，我们只需要加上前缀
  return `enc:v1:${blob.payloadBase64}`;
}

function toVaultEntry(row: PasswordEntry): VaultEntry {
  // 如果密码字段是桌面格式，转换为 Core 库格式
  let passwordCiphertext: string;
  if (isEncryptedPasswordField(row.password)) {
    // 转换为 JSON 格式的 EncryptedBlob
    const blob = convertDesktopFormatToEncryptedBlob(row.password);
    passwordCiphertext = JSON.stringify(blob);
  } else {
    // 如果已经是 JSON 格式，直接使用
    passwordCiphertext = row.password;
  }

  return {
    id: toEntryId(row.id || 0),
    title: row.title,
    username: row.username,
    passwordCiphertext: passwordCiphertext,
    url: row.url,
    notes: row.notes,
    category: row.category,
    tags: row.tags,
    favorite: Boolean(row.favorite),
    createdAt: row.createdAt || 0,
    updatedAt: row.updatedAt || 0,
  };
}

export class DesktopStorageAdapter implements StorageAdapter {
  constructor(private readonly database: Database) {}

  async listEntries(): Promise<VaultEntry[]> {
    // TODO: Database currently doesn't expose a raw ciphertext list API.
    // This maps exported rows to VaultEntry until database.listRawEntries() exists.
    return this.database.exportAllData().map(toVaultEntry);
  }

  async getEntryById(id: EntryId): Promise<VaultEntry | null> {
    const row = this.database.getPasswordById(toNumericId(id));
    return row ? toVaultEntry(row) : null;
  }

  async insertEntry(entry: VaultEntry): Promise<void> {
    // 如果密码字段是 JSON 格式，需要转换为桌面格式
    let desktopPasswordFormat: string;
    try {
      // 尝试解析为 JSON 格式
      const parsed = JSON.parse(entry.passwordCiphertext);
      if (parsed && typeof parsed === 'object' && parsed.version && parsed.algorithm && parsed.payloadBase64) {
        // 是 JSON EncryptedBlob 格式，转换为桌面格式
        desktopPasswordFormat = convertEncryptedBlobToDesktopFormat(parsed);
      } else {
        // 不是标准的 EncryptedBlob，可能是其他格式，保持原样
        desktopPasswordFormat = entry.passwordCiphertext;
      }
    } catch {
      // 不是 JSON 格式，可能是桌面格式或其他格式，保持原样
      desktopPasswordFormat = entry.passwordCiphertext;
    }

    this.database.addPassword({
      title: entry.title,
      username: entry.username,
      // TODO: this expects plaintext today; switch when raw-cipher insert is supported.
      password: desktopPasswordFormat,
      url: entry.url,
      notes: entry.notes,
      category: entry.category,
      tags: entry.tags,
      favorite: entry.favorite,
    });
  }

  async updateEntry(id: EntryId, patch: Partial<VaultEntry>): Promise<void> {
    // 如果密码字段存在且是 JSON 格式，需要转换为桌面格式
    let desktopPasswordFormat: string | undefined;
    if (patch.passwordCiphertext !== undefined) {
      try {
        // 尝试解析为 JSON 格式
        const parsed = JSON.parse(patch.passwordCiphertext);
        if (parsed && typeof parsed === 'object' && parsed.version && parsed.algorithm && parsed.payloadBase64) {
          // 是 JSON EncryptedBlob 格式，转换为桌面格式
          desktopPasswordFormat = convertEncryptedBlobToDesktopFormat(parsed);
        } else {
          // 不是标准的 EncryptedBlob，可能是其他格式，保持原样
          desktopPasswordFormat = patch.passwordCiphertext;
        }
      } catch {
        // 不是 JSON 格式，可能是桌面格式或其他格式，保持原样
        desktopPasswordFormat = patch.passwordCiphertext;
      }
    }

    this.database.updatePassword(toNumericId(id), {
      title: patch.title,
      username: patch.username,
      // TODO: this expects plaintext today; switch when raw-cipher update is supported.
      password: desktopPasswordFormat,
      url: patch.url,
      notes: patch.notes,
      category: patch.category,
      tags: patch.tags,
      favorite: patch.favorite,
    });
  }

  async deleteEntry(id: EntryId): Promise<void> {
    this.database.deletePassword(toNumericId(id));
  }

  async listCategories(): Promise<string[]> {
    return this.database.getCategories();
  }

  async ensureCategory(name: string): Promise<void> {
    const existing = this.database.getCategories();
    const normalizedName = name.toLowerCase();

    if (!existing.some(function hasMatchingCategory(category) {
      return category.toLowerCase() === normalizedName;
    })) {
      this.database.addCategory(name);
    }
  }

  async renameCategory(oldName: string, newName: string): Promise<void> {
    this.database.renameCategory(oldName, newName);
  }

  async deleteCategory(name: string, _fallbackCategory: string): Promise<{ movedCount: number }> {
    // Database currently hardcodes Default as fallback.
    return this.database.deleteCategory(name);
  }

  async getSetting(key: string): Promise<string | null> {
    return this.database.getSetting(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.database.setSetting(key, value);
  }

  async deleteSetting(key: string): Promise<void> {
    this.database.setSetting(key, null);
  }
}

export class DesktopKeyStoreAdapter implements KeyStoreAdapter {
  constructor(private readonly settingsStore?: LockSecretSettingsStore) {}

  private requireSettingsStore(): LockSecretSettingsStore {
    if (!this.settingsStore) {
      throw new Error('Lock secret settings store is required');
    }
    return this.settingsStore;
  }

  private wrapLockSecretToken(lockSecretRaw: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      const payload = Buffer.from(lockSecretRaw, 'utf8').toString('base64');
      return `${LOCK_SECRET_PLAIN_PREFIX}${payload}`;
    }

    const payload = safeStorage.encryptString(lockSecretRaw).toString('base64');
    return `${LOCK_SECRET_SAFE_PREFIX}${payload}`;
  }

  private unwrapLockSecretToken(wrappedToken: string): string {
    const safePayload = stripPrefix(wrappedToken, LOCK_SECRET_SAFE_PREFIX);
    if (safePayload !== null) {
      return safeStorage.decryptString(Buffer.from(safePayload, 'base64'));
    }

    const plainPayload = stripPrefix(wrappedToken, LOCK_SECRET_PLAIN_PREFIX);
    if (plainPayload !== null) {
      return Buffer.from(plainPayload, 'base64').toString('utf8');
    }

    throw new Error('Unknown wrapped lock secret format');
  }

  async wrapDataKey(rawDataKey: Uint8Array): Promise<string> {
    const rawBase64 = Buffer.from(rawDataKey).toString('base64');

    if (!safeStorage.isEncryptionAvailable()) {
      return `${STORAGE_PLAIN_PREFIX}${rawBase64}`;
    }

    const encryptedPayload = safeStorage.encryptString(rawBase64).toString('base64');
    return `${STORAGE_SAFE_PREFIX}${encryptedPayload}`;
  }

  async unwrapDataKey(wrappedDataKey: string): Promise<Uint8Array> {
    const safePayload = stripPrefix(wrappedDataKey, STORAGE_SAFE_PREFIX);
    if (safePayload !== null) {
      const decrypted = safeStorage.decryptString(Buffer.from(safePayload, 'base64'));
      return Buffer.from(decrypted, 'base64');
    }

    const plainPayload = stripPrefix(wrappedDataKey, STORAGE_PLAIN_PREFIX);
    if (plainPayload !== null) {
      return Buffer.from(plainPayload, 'base64');
    }

    throw new Error('Unknown wrapped key format');
  }

  async storeLockSecret(payload: string): Promise<void> {
    // Split policy: persist digest in settings and wrapped token in secure storage.
    const settingsStore = this.requireSettingsStore();
    const lockSecretRaw = payload.trim();
    if (!lockSecretRaw) {
      throw new Error('Lock secret payload cannot be empty');
    }

    const digest = computeLockSecretDigest(lockSecretRaw);
    const wrappedToken = this.wrapLockSecretToken(lockSecretRaw);

    await settingsStore.setSetting(LOCK_SECRET_DIGEST_KEY, digest);
    await settingsStore.setSetting(LOCK_SECRET_TOKEN_KEY, wrappedToken);
  }

  async readLockSecret(): Promise<string | null> {
    // Read lockSecretRaw from keystore; caller verifies digest from settings.
    const settingsStore = this.requireSettingsStore();
    const wrappedToken = await settingsStore.getSetting(LOCK_SECRET_TOKEN_KEY);
    if (!wrappedToken) {
      return null;
    }

    try {
      return this.unwrapLockSecretToken(wrappedToken);
    } catch {
      throw new Error(DEVICE_KEY_UNAVAILABLE_ERROR);
    }
  }

  async clearLockSecret(): Promise<void> {
    // Clear both sources: settings.lockSecretDigest and keystore lockSecretRaw token.
    const settingsStore = this.requireSettingsStore();
    await settingsStore.setSetting(LOCK_SECRET_DIGEST_KEY, null);
    await settingsStore.setSetting(LOCK_SECRET_TOKEN_KEY, null);
  }
}

export class DesktopCryptoAdapter implements CryptoAdapter {
  createRandom(bytes: number): Uint8Array {
    return crypto.randomBytes(bytes);
  }

  async encryptString(plaintext: string, dataKey: Uint8Array): Promise<EncryptedBlob> {
    const key = Buffer.from(dataKey);
    // encryptPasswordField 返回 enc:v1:base64_encoded_data 格式
    const fullFieldCipher = encryptPasswordField(plaintext, key);

    // 提取 base64 部分
    if (!fullFieldCipher.startsWith('enc:v1:')) {
      throw new Error('Unexpected encryption format');
    }
    const base64Part = fullFieldCipher.substring('enc:v1:'.length);

    return {
      version: 'v1',
      algorithm: ENCRYPTION_ALGORITHM,
      payloadBase64: base64Part, // 仅 base64 编码部分
    };
  }

  async decryptString(blob: EncryptedBlob, dataKey: Uint8Array): Promise<string> {
    // 重构回 enc:v1:base64 格式以供 decryptPasswordField 使用
    const fullFieldCipher = `enc:v1:${blob.payloadBase64}`;
    return decryptPasswordField(fullFieldCipher, Buffer.from(dataKey));
  }

  async derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
    return hashPassword(password, Buffer.from(salt));
  }

  async verifyPasswordHash(password: string, salt: Uint8Array, expectedHash: string): Promise<boolean> {
    return verifyPassword(password, Buffer.from(salt), expectedHash);
  }
}

// NOTE: This file is a migration map skeleton, not production wiring.
// It documents how existing desktop modules can satisfy the new shared-core contracts.
