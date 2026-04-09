export type EntryId = string;

export type MergeMode = 'skip' | 'overwrite' | 'rename';

export type VaultLockReason = 'manual' | 'idle-timeout' | 'app-start';

export interface VaultSummaryEntry {
  id: EntryId;
  title: string;
  username: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VaultEntry extends VaultSummaryEntry {
  passwordCiphertext: string;
}

export interface NewVaultEntryInput {
  title: string;
  username: string;
  plaintextPassword: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  favorite?: boolean;
}

export interface UpdateVaultEntryInput {
  title?: string;
  username?: string;
  plaintextPassword?: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  favorite?: boolean;
}

export interface LockConfig {
  autoEnabled: boolean;
  idleTimeoutSec: number;
}

export interface LockState extends LockConfig {
  hasPassword: boolean;
  isLocked: boolean;
}

export interface EncryptedBlob {
  version: string;
  algorithm: string;
  payloadBase64: string;
}

export interface ExportEnvelope {
  version: string;
  exportedAt: number;
  entryCount: number;
  entries: NewVaultEntryInput[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  renamed: number;
}

export interface StorageAdapter {
  listEntries(): Promise<VaultEntry[]>;
  getEntryById(id: EntryId): Promise<VaultEntry | null>;
  insertEntry(entry: VaultEntry): Promise<void>;
  updateEntry(id: EntryId, patch: Partial<VaultEntry>): Promise<void>;
  deleteEntry(id: EntryId): Promise<void>;

  listCategories(): Promise<string[]>;
  ensureCategory(name: string): Promise<void>;
  renameCategory(oldName: string, newName: string): Promise<void>;
  deleteCategory(name: string, fallbackCategory: string): Promise<{ movedCount: number }>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  deleteSetting(key: string): Promise<void>;
}

export interface KeyStoreAdapter {
  wrapDataKey(rawDataKey: Uint8Array): Promise<string>;
  unwrapDataKey(wrappedDataKey: string): Promise<Uint8Array>;

  storeLockSecret(payload: string): Promise<void>;
  readLockSecret(): Promise<string | null>;
  clearLockSecret(): Promise<void>;
}

export interface CryptoAdapter {
  createRandom(bytes: number): Uint8Array;
  encryptString(plaintext: string, dataKey: Uint8Array): Promise<EncryptedBlob>;
  decryptString(blob: EncryptedBlob, dataKey: Uint8Array): Promise<string>;

  derivePasswordHash(password: string, salt: Uint8Array): Promise<string>;
  verifyPasswordHash(password: string, salt: Uint8Array, expectedHash: string): Promise<boolean>;
}

export interface VaultService {
  initialize(): Promise<void>;

  getLockState(): Promise<LockState>;
  setLockPassword(newPassword: string, currentPassword?: string): Promise<void>;
  updateLockConfig(config: Partial<LockConfig>): Promise<LockState>;
  lock(reason?: VaultLockReason): Promise<void>;
  unlock(password: string): Promise<boolean>;

  listSummaries(): Promise<VaultSummaryEntry[]>;
  getPlaintextPassword(id: EntryId): Promise<string>;
  createEntry(input: NewVaultEntryInput): Promise<EntryId>;
  updateEntry(id: EntryId, patch: UpdateVaultEntryInput): Promise<void>;
  deleteEntry(id: EntryId): Promise<void>;
  searchSummaries(query: string): Promise<VaultSummaryEntry[]>;

  listCategories(): Promise<string[]>;
  addCategory(name: string): Promise<void>;
  renameCategory(oldName: string, newName: string): Promise<void>;
  deleteCategory(name: string): Promise<{ movedCount: number }>;

  exportVault(exportPassword: string): Promise<Uint8Array>;
  importVault(encryptedData: Uint8Array, exportPassword: string, mergeMode: MergeMode): Promise<ImportResult>;
}

export type VaultErrorCode =
  | 'INVALID_PASSWORD'
  | 'DEVICE_KEY_UNAVAILABLE'
  | 'LOCK_PASSWORD_REQUIRED'
  | 'UNKNOWN';

// This function is the single source of truth for mapping lock-flow errors to stable codes.
// Keep this conservative: only map known messages, fallback to UNKNOWN.
export function classifyLockError(message: string): VaultErrorCode {
  const normalized = (message || '').trim();
  if (!normalized) return 'UNKNOWN';

  if (normalized.includes('设备密钥不可用') || normalized.includes('DEVICE_KEY_UNAVAILABLE')) {
    return 'DEVICE_KEY_UNAVAILABLE';
  }
  if (normalized.includes('密码错误') || normalized.includes('INVALID_PASSWORD')) {
    return 'INVALID_PASSWORD';
  }
  if (normalized.includes('锁屏密码不能为空') || normalized.includes('请输入当前锁屏密码') || normalized.includes('LOCK_PASSWORD_REQUIRED')) {
    return 'LOCK_PASSWORD_REQUIRED';
  }

  return 'UNKNOWN';
}

export type LockSecretPolicy = 'keystore-only' | 'storage-only' | 'split';

// Chosen policy: split.
// Rationale: keep lock secret material partially in keystore and partially in app storage
// to balance cross-platform portability with stronger protection than storage-only.
export function chooseLockSecretPolicy(): LockSecretPolicy {
  return 'split';
}
