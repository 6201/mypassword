import type { VaultEntry } from '../../core-contract';

export interface JsonStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SecureVault {
  encryptUtf8(plaintext: string): Promise<string>;
  decryptUtf8(ciphertextBase64: string): Promise<string>;
}

export interface PlatformHasher {
  sha256Hex(input: string): Promise<string>;
}

export interface PasswordHasher {
  derivePasswordHash(password: string, salt: Uint8Array): Promise<string>;
  verifyPasswordHash(password: string, salt: Uint8Array, expectedHash: string): Promise<boolean>;
}

export interface EntryStoreShape {
  entries: VaultEntry[];
}

export interface CategoryStoreShape {
  categories: string[];
}

export interface SettingsStoreShape {
  settings: Record<string, string>;
}
