import type { JsonStorage } from './internal/types';

export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createMobileJsonStorage(storage: AsyncKeyValueStorage): JsonStorage {
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await storage.getItem(key);
      if (raw == null) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new Error(`Invalid JSON in mobile storage key: ${key}`);
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      await storage.setItem(key, JSON.stringify(value));
    },
    async remove(key: string): Promise<void> {
      await storage.removeItem(key);
    },
  };
}
