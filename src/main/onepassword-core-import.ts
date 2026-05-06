import type { VaultService, VaultSummaryEntry } from '@mypassword/shared-core';
import type { OnePasswordEntry } from './onepassword-importer';

function normalizeIdentityPart(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function normalizeUrls(url?: string, urls?: string[]): string[] {
  const base = Array.isArray(urls) && urls.length > 0 ? urls : (url ? [url] : []);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of base) {
    const next = (candidate || '').trim();
    if (!next || seen.has(next)) {
      continue;
    }
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

function matchesDuplicate(existing: VaultSummaryEntry, incoming: OnePasswordEntry): boolean {
  if (normalizeIdentityPart(existing.username) !== normalizeIdentityPart(incoming.username)) {
    return false;
  }

  const existingUrls = normalizeUrls(existing.url, existing.urls);
  const incomingUrls = normalizeUrls(incoming.url);
  const hasMatchingUrl = incomingUrls.some(url => existingUrls.includes(url));

  return normalizeIdentityPart(existing.title) === normalizeIdentityPart(incoming.title) || hasMatchingUrl;
}

export async function importOnePasswordEntriesThroughCore(
  vaultService: VaultService,
  entries: OnePasswordEntry[]
): Promise<{ imported: number; skipped: number; updated: number }> {
  const existing = await vaultService.listSummaries();
  const result = { imported: 0, skipped: 0, updated: 0 };

  for (const entry of entries) {
    if (existing.some(summary => matchesDuplicate(summary, entry))) {
      result.skipped++;
      continue;
    }

    await vaultService.createEntry({
      title: entry.title,
      username: entry.username,
      plaintextPassword: entry.password,
      url: entry.url,
      notes: entry.notes,
      tags: entry.tags,
      category: entry.category,
    });
    result.imported++;
    existing.push({
      id: String(existing.length + result.imported),
      title: entry.title,
      username: entry.username,
      url: entry.url,
      urls: entry.url ? [entry.url] : undefined,
      notes: entry.notes,
      category: entry.category,
      tags: entry.tags,
      favorite: false,
      createdAt: 0,
      updatedAt: 0,
    });
  }

  return result;
}
