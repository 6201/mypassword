import type { AsyncKeyValueStorage } from '../../src';

/**
 * Example adapter for React Native AsyncStorage-like APIs.
 * Replace internals with your real dependency (AsyncStorage, SQLite KV, MMKV, etc.).
 */
export function createAsyncStorageProvider(storage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}): AsyncKeyValueStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      return storage.getItem(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      await storage.setItem(key, value);
    },
    async removeItem(key: string): Promise<void> {
      await storage.removeItem(key);
    },
  };
}
