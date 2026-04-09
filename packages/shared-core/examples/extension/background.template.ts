import {
  ExtensionCryptoAdapter,
  ExtensionKeyStoreAdapter,
  ExtensionStorageAdapter,
  WebCryptoSecureVault,
  createExtensionJsonStorage,
} from '../../src/adapters';

interface UnlockResult {
  success: boolean;
  error?: string;
}

interface VaultRuntime {
  storage: ExtensionStorageAdapter;
  crypto: ExtensionCryptoAdapter;
  keystore: ExtensionKeyStoreAdapter;
}

const runtime: VaultRuntime = createVaultRuntime();
let unlocked = false;

function createVaultRuntime(): VaultRuntime {
  const jsonStorage = createExtensionJsonStorage();

  // In production, derive/persist this key via extension-specific secure bootstrap.
  const wrappingKey = crypto.getRandomValues(new Uint8Array(32));
  const secureVault = new WebCryptoSecureVault(wrappingKey);

  return {
    storage: new ExtensionStorageAdapter(jsonStorage),
    crypto: new ExtensionCryptoAdapter(),
    keystore: new ExtensionKeyStoreAdapter(jsonStorage, secureVault),
  };
}

async function unlockWithPassword(password: string): Promise<UnlockResult> {
  const trimmed = (password || '').trim();
  if (!trimmed) {
    return { success: false, error: 'LOCK_PASSWORD_REQUIRED' };
  }

  // Minimal template behavior: keep branch stable; replace with full vault-service unlock flow.
  unlocked = true;
  return { success: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;

  if (type === 'vault.unlock') {
    unlockWithPassword(message.password)
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ success: false, error: 'UNKNOWN' }));
    return true;
  }

  if (type === 'vault.status') {
    sendResponse({ unlocked });
    return false;
  }

  if (type === 'vault.create-entry') {
    if (!unlocked) {
      sendResponse({ success: false, error: 'LOCK_REQUIRED' });
      return false;
    }

    runtime.storage
      .insertEntry(message.entry)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'UNKNOWN' }));
    return true;
  }

  return false;
});
