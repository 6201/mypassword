import type { JsonStorage } from './internal/types';

declare const chrome:
  | {
      storage?: {
        local?: {
          get(keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void): void;
          set(items: Record<string, unknown>, callback?: () => void): void;
          remove(keys: string | string[], callback?: () => void): void;
        };
      };
      runtime?: { lastError?: { message?: string } };
    }
  | undefined;

type BrowserLikeStorageArea = {
  get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function getExtensionStorageArea(explicitStorage?: BrowserLikeStorageArea): BrowserLikeStorageArea {
  if (explicitStorage) {
    return explicitStorage;
  }

  const local = chrome?.storage?.local;
  if (!local) {
    throw new Error('Extension storage.local is unavailable');
  }

  return {
    get: keys =>
      new Promise((resolve, reject) => {
        local.get(keys, items => {
          const error = chrome?.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || 'storage.local.get failed'));
            return;
          }
          resolve(items || {});
        });
      }),
    set: items =>
      new Promise((resolve, reject) => {
        local.set(items, () => {
          const error = chrome?.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || 'storage.local.set failed'));
            return;
          }
          resolve();
        });
      }),
    remove: keys =>
      new Promise((resolve, reject) => {
        local.remove(keys, () => {
          const error = chrome?.runtime?.lastError;
          if (error) {
            reject(new Error(error.message || 'storage.local.remove failed'));
            return;
          }
          resolve();
        });
      }),
  };
}

export function createExtensionJsonStorage(explicitStorage?: BrowserLikeStorageArea): JsonStorage {
  const storage = getExtensionStorageArea(explicitStorage);

  return {
    async get<T>(key: string): Promise<T | null> {
      const items = await storage.get(key);
      return (items[key] as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await storage.set({ [key]: value });
    },
    async remove(key: string): Promise<void> {
      await storage.remove(key);
    },
  };
}
