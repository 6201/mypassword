import type { MobileSecureKeyProvider } from '../../src';

/**
 * Example secure key provider.
 * Replace with platform keystore bootstrap (iOS Keychain / Android Keystore wrapper).
 */
export function createStaticSecureKeyProvider(seedHex: string): MobileSecureKeyProvider {
  const normalized = seedHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('Secure key seed must be 32-byte hex string');
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }

  return {
    async getWrappingKey(): Promise<Uint8Array> {
      const key = new Uint8Array(bytes.length);
      key.set(bytes);
      return key;
    },
  };
}
