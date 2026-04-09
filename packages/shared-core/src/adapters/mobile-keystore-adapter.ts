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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function computeLockSecretDigest(raw: string): Promise<string> {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto is unavailable');
  }

  const encoded = new TextEncoder().encode(raw);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(encoded));
  return toHex(new Uint8Array(hash));
}

export class MobileKeyStoreAdapter implements KeyStoreAdapter {
  constructor(
    private readonly settingsStorage: JsonStorage,
    private readonly secureVault: SecureVault
  ) {}

  async wrapDataKey(rawDataKey: Uint8Array): Promise<string> {
    return this.secureVault.encryptUtf8(toBase64(rawDataKey));
  }

  async unwrapDataKey(wrappedDataKey: string): Promise<Uint8Array> {
    const raw = await this.secureVault.decryptUtf8(wrappedDataKey);
    return fromBase64(raw);
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
