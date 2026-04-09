function normalizeText(value: string | undefined): string {
  return (value || '').trim();
}

export function normalizeCategoryName(value: string): string {
  return normalizeText(value);
}

export function normalizeEntryUrls(url?: string): string | undefined {
  const normalized = normalizeText(url);
  return normalized || undefined;
}

export function normalizeEntryTags(tags?: string): string | undefined {
  const normalized = normalizeText(tags);
  return normalized || undefined;
}

export function stableDedupStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = normalizeText(raw);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}
