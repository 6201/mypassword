import {
  MobileCryptoAdapter,
  MobileKeyStoreAdapter,
  MobileStorageAdapter,
  createMobileJsonStorage,
  createMobileSecureVault,
  LOCK_SECRET_DIGEST_KEY,
  type AsyncKeyValueStorage,
  type MobileSecureKeyProvider,
  type VaultEntry,
} from '../../src';

export interface MobileVaultRuntime {
  unlock(password: string): Promise<{ success: boolean; error?: string }>;
  listEntries(): Promise<VaultEntry[]>;
  createEntry(entry: VaultEntry): Promise<void>;
  status(): { unlocked: boolean };
}

export function createMobileVaultRuntime(
  storageProvider: AsyncKeyValueStorage,
  secureKeyProvider: MobileSecureKeyProvider
): MobileVaultRuntime {
  const jsonStorage = createMobileJsonStorage(storageProvider);
  const secureVault = createMobileSecureVault(secureKeyProvider);
  const storage = new MobileStorageAdapter(jsonStorage);
  const crypto = new MobileCryptoAdapter();
  const keystore = new MobileKeyStoreAdapter(jsonStorage, secureVault);

  let unlocked = false;

  async function unlock(password: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = (password || '').trim();
    if (!trimmed) {
      return { success: false, error: 'LOCK_PASSWORD_REQUIRED' };
    }

    // Minimal template: validate lock secret presence to show real keystore wiring path.
    const digest = await storage.getSetting(LOCK_SECRET_DIGEST_KEY);
    if (digest) {
      try {
        await keystore.readLockSecret();
      } catch {
        return { success: false, error: 'DEVICE_KEY_UNAVAILABLE' };
      }
    }

    unlocked = true;
    return { success: true };
  }

  async function listEntries(): Promise<VaultEntry[]> {
    if (!unlocked) {
      throw new Error('LOCK_REQUIRED');
    }
    return storage.listEntries();
  }

  async function createEntry(entry: VaultEntry): Promise<void> {
    if (!unlocked) {
      throw new Error('LOCK_REQUIRED');
    }
    await storage.insertEntry(entry);
  }

  return {
    unlock,
    listEntries,
    createEntry,
    status: () => ({ unlocked }),
  };
}
