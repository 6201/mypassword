import type { KeyStoreAdapter } from '../core-contract';
import { LOCK_SECRET_DIGEST_KEY, LOCK_SECRET_TOKEN_KEY } from './internal/constants';
import type { JsonStorage, SecureVault } from './internal/types';

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getUtf8Codec(): { encode(value: string): Uint8Array; decode(value: Uint8Array): string } {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    encode: value => encoder.encode(value),
    decode: value => decoder.decode(value),
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

async function computeLockSecretDigest(raw: string): Promise<string> {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto is unavailable');
  }

  const encoded = new TextEncoder().encode(raw);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(encoded));
  return toHex(new Uint8Array(hash));
}

export class ExtensionKeyStoreAdapter implements KeyStoreAdapter {
  constructor(
    private readonly settingsStorage: JsonStorage,
    private readonly secureVault: SecureVault
  ) {}

  async wrapDataKey(rawDataKey: Uint8Array): Promise<string> {
    const encoded = toBase64(rawDataKey);
    return this.secureVault.encryptUtf8(encoded);
  }

  async unwrapDataKey(wrappedDataKey: string): Promise<Uint8Array> {
    const decoded = await this.secureVault.decryptUtf8(wrappedDataKey);
    return fromBase64(decoded);
  }

  async storeLockSecret(payload: string): Promise<void> {
    const raw = (payload || '').trim();
    if (!raw) {
      throw new Error('Lock secret payload cannot be empty');
    }

    const wrapped = await this.secureVault.encryptUtf8(raw);
    const digest = await computeLockSecretDigest(raw);

    await this.settingsStorage.set(LOCK_SECRET_TOKEN_KEY, wrapped);
    await this.settingsStorage.set(LOCK_SECRET_DIGEST_KEY, digest);
  }

  async readLockSecret(): Promise<string | null> {
    const wrapped = await this.settingsStorage.get<string>(LOCK_SECRET_TOKEN_KEY);
    if (!wrapped) {
      return null;
    }

    try {
      return await this.secureVault.decryptUtf8(wrapped);
    } catch {
      throw new Error('DEVICE_KEY_UNAVAILABLE');
    }
  }

  async clearLockSecret(): Promise<void> {
    await this.settingsStorage.remove(LOCK_SECRET_TOKEN_KEY);
    await this.settingsStorage.remove(LOCK_SECRET_DIGEST_KEY);
  }
}

export class WebCryptoSecureVault implements SecureVault {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(private readonly wrappingKey: Uint8Array) {
    this.keyPromise = this.importWrappingKey();
  }

  private getCryptoRuntime(): Crypto {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      return globalThis.crypto;
    }

    throw new Error('WebCrypto is unavailable');
  }

  private async importWrappingKey(): Promise<CryptoKey> {
    if (this.wrappingKey.length !== 32) {
      throw new Error('Wrapping key must be 32 bytes');
    }

    return this.getCryptoRuntime().subtle.importKey(
      'raw',
      toArrayBuffer(this.wrappingKey),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptUtf8(plaintext: string): Promise<string> {
    const key = await this.keyPromise;
    const iv = this.getCryptoRuntime().getRandomValues(new Uint8Array(12));
    const encoded = getUtf8Codec().encode(plaintext);

    const encrypted = new Uint8Array(
      await this.getCryptoRuntime().subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(encoded)
      )
    );

    const payload = new Uint8Array(iv.length + encrypted.length);
    payload.set(iv, 0);
    payload.set(encrypted, iv.length);
    return toBase64(payload);
  }

  async decryptUtf8(ciphertextBase64: string): Promise<string> {
    const payload = fromBase64(ciphertextBase64);
    if (payload.length <= 12 + 16) {
      throw new Error('Ciphertext payload is invalid');
    }

    const key = await this.keyPromise;
    const iv = payload.slice(0, 12);
    const encrypted = payload.slice(12);

    const decrypted = await this.getCryptoRuntime().subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(encrypted)
    );

    return getUtf8Codec().decode(new Uint8Array(decrypted));
  }
}
