import type { CryptoAdapter, EncryptedBlob } from '../core-contract';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HASH_ALGORITHM = 'SHA-256';
const DEFAULT_PBKDF2_ITERATIONS = 100000;

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

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex value');
  }

  const result = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    result[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return result;
}

function getCryptoRuntime(): Crypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }

  throw new Error('WebCrypto is unavailable');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function importAesKey(dataKey: Uint8Array): Promise<CryptoKey> {
  if (dataKey.length !== KEY_LENGTH) {
    throw new Error('Invalid data key length');
  }

  return getCryptoRuntime().subtle.importKey('raw', toArrayBuffer(dataKey), { name: ALGORITHM }, false, ['encrypt', 'decrypt']);
}

export class ExtensionCryptoAdapter implements CryptoAdapter {
  constructor(private readonly pbkdf2Iterations = DEFAULT_PBKDF2_ITERATIONS) {}

  createRandom(bytes: number): Uint8Array {
    const output = new Uint8Array(bytes);
    getCryptoRuntime().getRandomValues(output);
    return output;
  }

  async encryptString(plaintext: string, dataKey: Uint8Array): Promise<EncryptedBlob> {
    const cryptoKey = await importAesKey(dataKey);
    const iv = this.createRandom(IV_LENGTH);
    const encoded = new TextEncoder().encode(plaintext);

    const encrypted = new Uint8Array(
      await getCryptoRuntime().subtle.encrypt(
        { name: ALGORITHM, iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(encoded)
      )
    );

    const payload = new Uint8Array(iv.length + encrypted.length);
    payload.set(iv, 0);
    payload.set(encrypted, iv.length);

    return {
      version: 'v1',
      algorithm: 'aes-256-gcm',
      payloadBase64: toBase64(payload),
    };
  }

  async decryptString(blob: EncryptedBlob, dataKey: Uint8Array): Promise<string> {
    const payload = fromBase64(blob.payloadBase64);
    if (payload.length <= IV_LENGTH + TAG_LENGTH) {
      throw new Error('Encrypted payload is invalid');
    }

    const iv = payload.slice(0, IV_LENGTH);
    const encrypted = payload.slice(IV_LENGTH);
    const cryptoKey = await importAesKey(dataKey);

    const decrypted = await getCryptoRuntime().subtle.decrypt(
      { name: ALGORITHM, iv: toArrayBuffer(iv) },
      cryptoKey,
      toArrayBuffer(encrypted)
    );
    return new TextDecoder().decode(decrypted);
  }

  async derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
    const passwordKey = await getCryptoRuntime().subtle.importKey(
      'raw',
      toArrayBuffer(new TextEncoder().encode(password)),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derived = await getCryptoRuntime().subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: HASH_ALGORITHM,
        salt: toArrayBuffer(salt),
        iterations: this.pbkdf2Iterations,
      },
      passwordKey,
      KEY_LENGTH * 8
    );

    return toHex(new Uint8Array(derived));
  }

  async verifyPasswordHash(password: string, salt: Uint8Array, expectedHash: string): Promise<boolean> {
    const actualHex = await this.derivePasswordHash(password, salt);
    const expectedBytes = fromHex(expectedHash);
    const actualBytes = fromHex(actualHex);

    if (expectedBytes.length !== actualBytes.length) {
      return false;
    }

    let diff = 0;
    for (let index = 0; index < expectedBytes.length; index += 1) {
      diff |= expectedBytes[index] ^ actualBytes[index];
    }

    return diff === 0;
  }
}
