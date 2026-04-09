import type { EntryId, StorageAdapter, VaultEntry } from '../core-contract';
import {
  DEFAULT_CATEGORY,
  EXT_CATEGORIES_KEY,
  EXT_ENTRIES_KEY,
  EXT_SETTINGS_KEY,
} from './internal/constants';
import {
  normalizeCategoryName,
  normalizeEntryTags,
  normalizeEntryUrls,
  stableDedupStrings,
} from './internal/normalizers';
import type {
  CategoryStoreShape,
  EntryStoreShape,
  JsonStorage,
  SettingsStoreShape,
} from './internal/types';

function cloneEntry(entry: VaultEntry): VaultEntry {
  return {
    ...entry,
    title: entry.title || '',
    username: entry.username || '',
    passwordCiphertext: entry.passwordCiphertext || '',
    url: normalizeEntryUrls(entry.url),
    notes: entry.notes,
    category: entry.category,
    tags: normalizeEntryTags(entry.tags),
    favorite: Boolean(entry.favorite),
    createdAt: Number(entry.createdAt || 0),
    updatedAt: Number(entry.updatedAt || 0),
  };
}

function resolveDeleteFallback(categories: string[], current: string, fallbackCategory: string): string {
  const fallback = normalizeCategoryName(fallbackCategory) || DEFAULT_CATEGORY;
  if (fallback.toLowerCase() !== current.toLowerCase()) {
    return fallback;
  }
  const candidate = categories.find(category => category.toLowerCase() !== current.toLowerCase());
  return candidate || DEFAULT_CATEGORY;
}

export class ExtensionStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: JsonStorage) {}

  private async readEntries(): Promise<VaultEntry[]> {
    const payload = await this.storage.get<EntryStoreShape>(EXT_ENTRIES_KEY);
    if (!payload?.entries || !Array.isArray(payload.entries)) {
      return [];
    }

    return payload.entries.map(cloneEntry);
  }

  private async writeEntries(entries: VaultEntry[]): Promise<void> {
    await this.storage.set<EntryStoreShape>(EXT_ENTRIES_KEY, {
      entries: entries.map(cloneEntry),
    });
  }

  private async readCategories(): Promise<string[]> {
    const payload = await this.storage.get<CategoryStoreShape>(EXT_CATEGORIES_KEY);
    const categories = payload?.categories || [];
    const deduped = stableDedupStrings(categories);
    if (deduped.length === 0) {
      return [DEFAULT_CATEGORY];
    }
    return deduped;
  }

  private async writeCategories(categories: string[]): Promise<void> {
    const deduped = stableDedupStrings(categories);
    await this.storage.set<CategoryStoreShape>(EXT_CATEGORIES_KEY, {
      categories: deduped.length ? deduped : [DEFAULT_CATEGORY],
    });
  }

  private async readSettings(): Promise<Record<string, string>> {
    const payload = await this.storage.get<SettingsStoreShape>(EXT_SETTINGS_KEY);
    return payload?.settings || {};
  }

  private async writeSettings(settings: Record<string, string>): Promise<void> {
    await this.storage.set<SettingsStoreShape>(EXT_SETTINGS_KEY, { settings });
  }

  async listEntries(): Promise<VaultEntry[]> {
    return this.readEntries();
  }

  async getEntryById(id: EntryId): Promise<VaultEntry | null> {
    const entries = await this.readEntries();
    return entries.find(entry => entry.id === id) || null;
  }

  async insertEntry(entry: VaultEntry): Promise<void> {
    const entries = await this.readEntries();
    if (entries.some(existing => existing.id === entry.id)) {
      throw new Error(`Entry already exists: ${entry.id}`);
    }

    entries.push(cloneEntry(entry));
    await this.writeEntries(entries);

    if (entry.category) {
      await this.ensureCategory(entry.category);
    }
  }

  async updateEntry(id: EntryId, patch: Partial<VaultEntry>): Promise<void> {
    const entries = await this.readEntries();
    const index = entries.findIndex(entry => entry.id === id);
    if (index < 0) {
      throw new Error(`Entry not found: ${id}`);
    }

    entries[index] = cloneEntry({
      ...entries[index],
      ...patch,
      id,
      updatedAt: patch.updatedAt ?? Date.now(),
    });
    await this.writeEntries(entries);

    if (patch.category) {
      await this.ensureCategory(patch.category);
    }
  }

  async deleteEntry(id: EntryId): Promise<void> {
    const entries = await this.readEntries();
    const filtered = entries.filter(entry => entry.id !== id);
    if (filtered.length === entries.length) {
      return;
    }
    await this.writeEntries(filtered);
  }

  async listCategories(): Promise<string[]> {
    return this.readCategories();
  }

  async ensureCategory(name: string): Promise<void> {
    const normalized = normalizeCategoryName(name);
    if (!normalized) {
      return;
    }

    const categories = await this.readCategories();
    if (categories.some(category => category.toLowerCase() === normalized.toLowerCase())) {
      return;
    }

    categories.push(normalized);
    await this.writeCategories(categories);
  }

  async renameCategory(oldName: string, newName: string): Promise<void> {
    const oldNormalized = normalizeCategoryName(oldName);
    const newNormalized = normalizeCategoryName(newName);
    if (!oldNormalized || !newNormalized) {
      throw new Error('Category name cannot be empty');
    }

    const categories = await this.readCategories();
    const oldIndex = categories.findIndex(category => category.toLowerCase() === oldNormalized.toLowerCase());
    if (oldIndex < 0) {
      return;
    }

    categories[oldIndex] = newNormalized;
    await this.writeCategories(categories);

    const entries = await this.readEntries();
    const nextEntries = entries.map(entry => {
      if (!entry.category || entry.category.toLowerCase() !== oldNormalized.toLowerCase()) {
        return entry;
      }
      return cloneEntry({ ...entry, category: newNormalized, updatedAt: Date.now() });
    });
    await this.writeEntries(nextEntries);
  }

  async deleteCategory(name: string, fallbackCategory: string): Promise<{ movedCount: number }> {
    const normalized = normalizeCategoryName(name);
    if (!normalized) {
      return { movedCount: 0 };
    }

    const categories = await this.readCategories();
    const filteredCategories = categories.filter(category => category.toLowerCase() !== normalized.toLowerCase());
    const fallback = resolveDeleteFallback(filteredCategories, normalized, fallbackCategory);

    if (!filteredCategories.some(category => category.toLowerCase() === fallback.toLowerCase())) {
      filteredCategories.push(fallback);
    }
    await this.writeCategories(filteredCategories);

    const entries = await this.readEntries();
    let movedCount = 0;
    const nextEntries = entries.map(entry => {
      if (!entry.category || entry.category.toLowerCase() !== normalized.toLowerCase()) {
        return entry;
      }
      movedCount += 1;
      return cloneEntry({ ...entry, category: fallback, updatedAt: Date.now() });
    });

    await this.writeEntries(nextEntries);
    return { movedCount };
  }

  async getSetting(key: string): Promise<string | null> {
    const settings = await this.readSettings();
    return settings[key] ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const settings = await this.readSettings();
    settings[key] = value;
    await this.writeSettings(settings);
  }

  async deleteSetting(key: string): Promise<void> {
    const settings = await this.readSettings();
    delete settings[key];
    await this.writeSettings(settings);
  }
}
