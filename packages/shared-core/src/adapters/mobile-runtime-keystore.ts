import { WebCryptoSecureVault } from './extension-keystore-adapter';
import type { SecureVault } from './internal/types';

export interface MobileSecureKeyProvider {
  getWrappingKey(): Promise<Uint8Array>;
}

export function createMobileSecureVault(provider: MobileSecureKeyProvider): SecureVault {
  return {
    async encryptUtf8(plaintext: string): Promise<string> {
      const key = await provider.getWrappingKey();
      const vault = new WebCryptoSecureVault(key);
      return vault.encryptUtf8(plaintext);
    },
    async decryptUtf8(ciphertextBase64: string): Promise<string> {
      const key = await provider.getWrappingKey();
      const vault = new WebCryptoSecureVault(key);
      return vault.decryptUtf8(ciphertextBase64);
    },
  };
}
