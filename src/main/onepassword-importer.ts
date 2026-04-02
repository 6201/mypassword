import fs from 'fs';
import * as yauzl from 'yauzl';

export interface OnePasswordEntry {
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags?: string;
  category?: string;
}

export interface OnePassword1PUXParseOptions {
  maxArchiveBytes?: number;
  maxJsonBytes?: number;
  maxItems?: number;
  maxUncompressedBytes?: number;
}

interface OnePassword1PUXResolvedOptions {
  maxArchiveBytes: number;
  maxJsonBytes: number;
  maxItems: number;
  maxUncompressedBytes: number;
}

const DEFAULT_1PUX_MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const DEFAULT_1PUX_MAX_JSON_BYTES = 20 * 1024 * 1024;
const DEFAULT_1PUX_MAX_ITEMS = 50000;
const DEFAULT_1PUX_MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
const ONEPASSWORD_1PUX_DATA_CANDIDATES = new Set(['export.data', 'data/export.data']);

/**
 * 解析 1Password 导出的 CSV 文件
 */
export function parseOnePasswordCSV(csv: string): OnePasswordEntry[] {
  if (!csv.trim()) {
    return [];
  }

  const lines = parseCSVLines(csv);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const entries: OnePasswordEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const entry: Record<string, string> = {};

    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        entry[header] = values[index];
      }
    });

    entries.push({
      title: entry.title || 'Unnamed',
      username: entry.username || '',
      password: entry.password || '',
      url: entry.url || '',
      notes: entry.notes || '',
      tags: entry.tags || '',
      category: entry.category || 'Imported'
    });
  }

  return entries;
}

/**
 * 解析 CSV 行为数组，处理引号和转义
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // 转义引号
        current += '"';
        i++;
      } else if (char === '"') {
        // 结束引号
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * 将 CSV 解析为行数组，处理多行引号内容
 */
function parseCSVLines(csv: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine.trim());
      currentLine = '';
    } else if (char !== '\r') {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}

/**
 * 解析 1Password 1PIF 格式
 */
export function parseOnePassword1PIF(pifContent: string): OnePasswordEntry[] {
  let data: any[];

  try {
    data = JSON.parse(pifContent);
  } catch (e) {
    throw new Error('Invalid 1PIF JSON format');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  const entries: OnePasswordEntry[] = [];

  for (const item of data) {
    const entry: OnePasswordEntry = {
      title: item.label || item.title || 'Unnamed',
      username: '',
      password: '',
      url: item.location || item.url || '',
      category: 'Imported'
    };

    // 解析 secureContent
    if (item.secureContent) {
      const { passwordField, PINField, passwordValues = [], PINValues = [] } = item.secureContent;

      // 尝试从不同字段获取用户名和密码
      if (passwordField === 'username' && passwordValues.length >= 2) {
        entry.username = passwordValues[0];
        entry.password = passwordValues[1];
      } else if (passwordField === 'password' && passwordValues.length >= 1) {
        entry.password = passwordValues[0];
      } else if (passwordValues.length >= 1) {
        entry.password = passwordValues[0];
      }

      // 处理 PIN 字段（有时用作密码）
      if (PINField === 'password' && PINValues.length >= 1 && !entry.password) {
        entry.password = PINValues[0];
      }
    }

    // 处理自定义字段
    if (item.customFields) {
      for (const field of item.customFields) {
        if (field.name === 'username' && !entry.username) {
          entry.username = field.value;
        }
        if (field.name === 'password' && !entry.password) {
          entry.password = field.value;
        }
        if (field.name === 'notes' || field.name === 'notesPlain') {
          entry.notes = field.value;
        }
      }
    }

    entries.push(entry);
  }

  return entries;
}

/**
 * 解析 1Password 1PUX 格式（ZIP + JSON）
 */
export async function parseOnePassword1PUX(filePath: string, options: OnePassword1PUXParseOptions = {}): Promise<OnePasswordEntry[]> {
  const limits = resolve1PUXOptions(options);

  let archiveStats: fs.Stats;
  try {
    archiveStats = await fs.promises.stat(filePath);
  } catch {
    throw new Error('无法读取 1PUX 文件');
  }

  if (archiveStats.size > limits.maxArchiveBytes) {
    throw new Error('1PUX 文件过大');
  }

  const rawData = await read1PUXDataFile(filePath, limits);
  return parseOnePassword1PUXData(rawData, limits.maxItems);
}

function resolve1PUXOptions(options: OnePassword1PUXParseOptions): OnePassword1PUXResolvedOptions {
  return {
    maxArchiveBytes: options.maxArchiveBytes ?? DEFAULT_1PUX_MAX_ARCHIVE_BYTES,
    maxJsonBytes: options.maxJsonBytes ?? DEFAULT_1PUX_MAX_JSON_BYTES,
    maxItems: options.maxItems ?? DEFAULT_1PUX_MAX_ITEMS,
    maxUncompressedBytes: options.maxUncompressedBytes ?? DEFAULT_1PUX_MAX_UNCOMPRESSED_BYTES
  };
}

function read1PUXDataFile(filePath: string, limits: OnePassword1PUXResolvedOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, autoClose: true, validateEntrySizes: true },
      (openError, zipfile) => {
        if (openError || !zipfile) {
          reject(new Error('无效的 1PUX 压缩包'));
          return;
        }

        let isSettled = false;
        let totalUncompressedSize = 0;

        const settle = (error?: Error, content?: string): void => {
          if (isSettled) {
            return;
          }
          isSettled = true;
          if (error) {
            reject(error);
            return;
          }
          resolve(content || '');
        };

        zipfile.on('error', () => {
          settle(new Error('无效的 1PUX 压缩包'));
        });

        zipfile.on('end', () => {
          settle(new Error('1PUX 中未找到导出数据文件'));
        });

        zipfile.on('entry', (entry: yauzl.Entry) => {
          const normalizedName = entry.fileName.replace(/\\/g, '/').toLowerCase();

          if (normalizedName.endsWith('/')) {
            zipfile.readEntry();
            return;
          }

          totalUncompressedSize += entry.uncompressedSize;
          if (totalUncompressedSize > limits.maxUncompressedBytes) {
            zipfile.close();
            settle(new Error('1PUX 解压数据过大'));
            return;
          }

          if (!is1PUXDataEntry(normalizedName)) {
            zipfile.readEntry();
            return;
          }

          if (entry.uncompressedSize > limits.maxJsonBytes) {
            zipfile.close();
            settle(new Error('1PUX 导出数据过大'));
            return;
          }

          zipfile.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              zipfile.close();
              settle(new Error('读取 1PUX 导出数据失败'));
              return;
            }

            const chunks: Buffer[] = [];
            let consumedBytes = 0;

            stream.on('data', (chunk: Buffer) => {
              consumedBytes += chunk.length;
              if (consumedBytes > limits.maxJsonBytes) {
                stream.destroy();
                zipfile.close();
                settle(new Error('1PUX 导出数据过大'));
                return;
              }

              chunks.push(chunk);
            });

            stream.on('error', () => {
              zipfile.close();
              settle(new Error('读取 1PUX 导出数据失败'));
            });

            stream.on('end', () => {
              zipfile.close();
              settle(undefined, Buffer.concat(chunks).toString('utf-8'));
            });
          });
        });

        zipfile.readEntry();
      }
    );
  });
}

function is1PUXDataEntry(fileName: string): boolean {
  if (ONEPASSWORD_1PUX_DATA_CANDIDATES.has(fileName)) {
    return true;
  }

  return fileName.endsWith('/export.data');
}

function parseOnePassword1PUXData(rawData: string, maxItems: number): OnePasswordEntry[] {
  let payload: unknown;

  try {
    payload = JSON.parse(rawData);
  } catch {
    throw new Error('1PUX 导出数据 JSON 格式无效');
  }

  const sourceItems = extract1PUXItems(payload);
  const entries: OnePasswordEntry[] = [];

  for (const item of sourceItems) {
    const mapped = map1PUXItem(item);
    if (!mapped) {
      continue;
    }

    entries.push(mapped);

    if (entries.length > maxItems) {
      throw new Error('1PUX 条目数量超过限制');
    }
  }

  return entries;
}

function extract1PUXItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  const directItems = asArray(root.items);
  if (directItems) {
    return directItems;
  }

  const rootVaults = asArray(root.vaults);
  if (rootVaults) {
    return flattenVaultItems(rootVaults);
  }

  const accounts = asArray(root.accounts);
  if (!accounts) {
    return [];
  }

  const allItems: unknown[] = [];
  for (const account of accounts) {
    const accountRecord = asRecord(account);
    if (!accountRecord) {
      continue;
    }

    const vaults = asArray(accountRecord.vaults);
    if (!vaults) {
      continue;
    }

    allItems.push(...flattenVaultItems(vaults));
  }

  return allItems;
}

function flattenVaultItems(vaults: unknown[]): unknown[] {
  const items: unknown[] = [];

  for (const vault of vaults) {
    const vaultRecord = asRecord(vault);
    if (!vaultRecord) {
      continue;
    }

    const vaultItems = asArray(vaultRecord.items);
    if (!vaultItems) {
      continue;
    }

    items.push(...vaultItems);
  }

  return items;
}

function map1PUXItem(item: unknown): OnePasswordEntry | null {
  const raw = asRecord(item);
  if (!raw) {
    return null;
  }

  const category = firstNonEmptyString([
    asString(raw.category),
    asString(raw.type),
    asString(raw.itemType),
    asString(raw.template)
  ]);

  const title = firstNonEmptyString([
    asString(raw.title),
    asString(raw.label),
    asString(getNested(raw, ['overview', 'title'])),
    asString(raw.name)
  ]) || 'Unnamed';

  const url = firstNonEmptyString([
    asString(raw.url),
    asString(raw.location),
    asString(getNested(raw, ['overview', 'url'])),
    asString(getNested(raw, ['details', 'url'])),
    getFirstUrl(raw)
  ]) || '';

  const notes = firstNonEmptyString([
    asString(raw.notes),
    asString(getNested(raw, ['details', 'notesPlain'])),
    asString(getNested(raw, ['overview', 'notes']))
  ]) || '';

  const tags = getTags(raw).join(',');
  const credentials = extractCredentials(raw);

  const isLoginItem = isLoginCategory(category) || credentials.username.length > 0 || credentials.password.length > 0;
  if (!isLoginItem) {
    return null;
  }

  return {
    title,
    username: credentials.username,
    password: credentials.password,
    url,
    notes,
    tags,
    category: 'Imported'
  };
}

function extractCredentials(item: Record<string, unknown>): { username: string; password: string } {
  let username = firstNonEmptyString([
    asString(item.username),
    asString(getNested(item, ['details', 'username'])),
    asString(getNested(item, ['overview', 'username']))
  ]) || '';

  let password = firstNonEmptyString([
    asString(item.password),
    asString(getNested(item, ['details', 'password']))
  ]) || '';

  const candidateFieldSets: unknown[] = [
    item.fields,
    getNested(item, ['details', 'fields']),
    getNested(item, ['details', 'loginFields']),
    item.loginFields
  ];

  for (const fieldSet of candidateFieldSets) {
    const fields = asArray(fieldSet);
    if (!fields) {
      continue;
    }

    for (const field of fields) {
      const fieldRecord = asRecord(field);
      if (!fieldRecord) {
        continue;
      }

      const value = firstNonEmptyString([
        asString(fieldRecord.value),
        asString(fieldRecord.v),
        asString(fieldRecord.text)
      ]);

      if (!value) {
        continue;
      }

      const key = [
        asString(fieldRecord.designation),
        asString(fieldRecord.purpose),
        asString(fieldRecord.name),
        asString(fieldRecord.id),
        asString(fieldRecord.label),
        asString(fieldRecord.type)
      ].filter(Boolean).join(' ').toLowerCase();

      if (!username && looksLikeUsernameField(key)) {
        username = value;
      }

      if (!password && looksLikePasswordField(key)) {
        password = value;
      }
    }
  }

  return { username, password };
}

function looksLikeUsernameField(key: string): boolean {
  return key.includes('username') || key.includes('user name') || key.includes('email') || key.includes('login');
}

function looksLikePasswordField(key: string): boolean {
  return key.includes('password') || key.includes('passcode') || key.includes('secret');
}

function isLoginCategory(category: string): boolean {
  const normalized = (category || '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.includes('login');
}

function getTags(item: Record<string, unknown>): string[] {
  const source = asArray(getNested(item, ['overview', 'tags'])) || asArray(item.tags) || [];
  const tags = source.map(value => asString(value)).filter((tag): tag is string => Boolean(tag));
  return Array.from(new Set(tags));
}

function getFirstUrl(item: Record<string, unknown>): string {
  const urls = asArray(getNested(item, ['overview', 'urls'])) || asArray(item.urls);
  if (!urls) {
    return '';
  }

  for (const entry of urls) {
    if (typeof entry === 'string') {
      return entry;
    }

    const record = asRecord(entry);
    if (!record) {
      continue;
    }

    const href = firstNonEmptyString([
      asString(record.href),
      asString(record.url),
      asString(record.link)
    ]);

    if (href) {
      return href;
    }
  }

  return '';
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getNested(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;

  for (const segment of path) {
    const record = asRecord(current);
    if (!record || !(segment in record)) {
      return undefined;
    }

    current = record[segment];
  }

  return current;
}

function firstNonEmptyString(candidates: string[]): string {
  for (const candidate of candidates) {
    const normalized = (candidate || '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}
