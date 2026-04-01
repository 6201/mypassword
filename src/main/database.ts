import DatabaseType from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export interface PasswordEntry {
  id?: number;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  createdAt?: number;
  updatedAt?: number;
  favorite?: boolean;
}

export interface LockSettings {
  passwordHash: string | null;
  passwordSalt: string | null;
  autoEnabled: boolean;
  idleTimeoutSec: number;
}

const DEFAULT_CATEGORY = 'Default';
const IMPORTED_CATEGORY = 'Imported';
const RESERVED_CATEGORY = 'All';
const LOCK_PASSWORD_HASH_KEY = 'lock.passwordHash';
const LOCK_PASSWORD_SALT_KEY = 'lock.passwordSalt';
const LOCK_AUTO_ENABLED_KEY = 'lock.autoEnabled';
const LOCK_IDLE_TIMEOUT_SEC_KEY = 'lock.idleTimeoutSec';
const DEFAULT_LOCK_IDLE_TIMEOUT_SEC = 300;
const MIN_LOCK_IDLE_TIMEOUT_SEC = 60;
const MAX_LOCK_IDLE_TIMEOUT_SEC = 3600;

export class Database {
  private db: DatabaseType.Database;

  constructor(dbOrPath: string | DatabaseType.Database) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseType(dbOrPath);
    } else {
      this.db = dbOrPath;
    }
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS passwords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        url TEXT,
        notes TEXT,
        category TEXT DEFAULT 'Default',
        tags TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now')),
        updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
        favorite INTEGER DEFAULT 0
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        name TEXT PRIMARY KEY COLLATE NOCASE
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_passwords_category
      ON passwords (category COLLATE NOCASE)
    `);

    this.bootstrapCategories();
  }

  private bootstrapCategories(): void {
    this.ensureCategoryExists(DEFAULT_CATEGORY);

    const needsNormalization = this.db.prepare(`
      SELECT 1
      FROM passwords
      WHERE category IS NULL
         OR TRIM(category) = ''
         OR LOWER(TRIM(category)) = LOWER(?)
         OR category != TRIM(category)
      LIMIT 1
    `).get(RESERVED_CATEGORY);

    if (needsNormalization) {
      const normalizeStmt = this.db.prepare(`
        UPDATE passwords
        SET category = CASE
          WHEN category IS NULL OR TRIM(category) = '' OR LOWER(TRIM(category)) = LOWER(?) THEN ?
          ELSE TRIM(category)
        END
        WHERE category IS NULL
           OR TRIM(category) = ''
           OR LOWER(TRIM(category)) = LOWER(?)
           OR category != TRIM(category)
      `);
      normalizeStmt.run(RESERVED_CATEGORY, DEFAULT_CATEGORY, RESERVED_CATEGORY);
    }

    const backfillStmt = this.db.prepare(`
      INSERT OR IGNORE INTO categories (name)
      SELECT DISTINCT category
      FROM passwords
      WHERE category IS NOT NULL AND TRIM(category) <> ''
    `);
    backfillStmt.run();
  }

  private normalizeCategoryName(name: string): string {
    const normalized = (name || '').trim();
    if (!normalized) {
      throw new Error('分类名称不能为空');
    }
    if (normalized.toLowerCase() === RESERVED_CATEGORY.toLowerCase()) {
      throw new Error('分类名称不可用');
    }
    return normalized;
  }

  private normalizePasswordCategory(category?: string | null): string {
    const normalized = (category || '').trim();
    if (!normalized) {
      return DEFAULT_CATEGORY;
    }
    if (normalized.toLowerCase() === RESERVED_CATEGORY.toLowerCase()) {
      return DEFAULT_CATEGORY;
    }
    return normalized;
  }

  private ensureCategoryExists(name: string): void {
    this.db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
  }

  private categoryExists(name: string): boolean {
    const row = this.db.prepare('SELECT name FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1').get(name) as { name: string } | undefined;
    return !!row;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    const message = String((error as Error | undefined)?.message || '');
    return message.includes('UNIQUE constraint failed: categories.name');
  }

  private normalizeIdleTimeoutSec(value: number): number {
    if (!Number.isFinite(value)) {
      return DEFAULT_LOCK_IDLE_TIMEOUT_SEC;
    }

    const integerValue = Math.floor(value);
    if (integerValue < MIN_LOCK_IDLE_TIMEOUT_SEC) {
      return MIN_LOCK_IDLE_TIMEOUT_SEC;
    }
    if (integerValue > MAX_LOCK_IDLE_TIMEOUT_SEC) {
      return MAX_LOCK_IDLE_TIMEOUT_SEC;
    }

    return integerValue;
  }

  private parseIdleTimeoutSec(rawValue: string | null): number {
    if (rawValue === null) {
      return DEFAULT_LOCK_IDLE_TIMEOUT_SEC;
    }

    return this.normalizeIdleTimeoutSec(Number(rawValue));
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string | null } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string | null): void {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  setLockPassword(hash: string, saltHex: string): void {
    this.setSetting(LOCK_PASSWORD_HASH_KEY, hash);
    this.setSetting(LOCK_PASSWORD_SALT_KEY, saltHex);
  }

  clearLockPassword(): void {
    this.setSetting(LOCK_PASSWORD_HASH_KEY, null);
    this.setSetting(LOCK_PASSWORD_SALT_KEY, null);
  }

  updateLockConfig(config: { autoEnabled?: boolean; idleTimeoutSec?: number }): LockSettings {
    const current = this.getLockSettings();

    const autoEnabled = config.autoEnabled ?? current.autoEnabled;
    const idleTimeoutSec = config.idleTimeoutSec === undefined
      ? current.idleTimeoutSec
      : this.normalizeIdleTimeoutSec(config.idleTimeoutSec);

    this.setSetting(LOCK_AUTO_ENABLED_KEY, autoEnabled ? 'true' : 'false');
    this.setSetting(LOCK_IDLE_TIMEOUT_SEC_KEY, String(idleTimeoutSec));

    return this.getLockSettings();
  }

  getLockSettings(): LockSettings {
    const passwordHash = this.getSetting(LOCK_PASSWORD_HASH_KEY);
    const passwordSalt = this.getSetting(LOCK_PASSWORD_SALT_KEY);
    const autoEnabledRaw = this.getSetting(LOCK_AUTO_ENABLED_KEY);
    const idleTimeoutRaw = this.getSetting(LOCK_IDLE_TIMEOUT_SEC_KEY);

    return {
      passwordHash,
      passwordSalt,
      autoEnabled: autoEnabledRaw === 'true',
      idleTimeoutSec: this.parseIdleTimeoutSec(idleTimeoutRaw)
    };
  }

  getAllPasswords(): PasswordEntry[] {
    const stmt = this.db.prepare('SELECT * FROM passwords ORDER BY title');
    return stmt.all() as PasswordEntry[];
  }

  getPasswordById(id: number): PasswordEntry | undefined {
    const stmt = this.db.prepare('SELECT * FROM passwords WHERE id = ?');
    return stmt.get(id) as PasswordEntry | undefined;
  }

  addPassword(entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>): number {
    const category = this.normalizePasswordCategory(entry.category);
    this.ensureCategoryExists(category);

    const stmt = this.db.prepare(`
      INSERT INTO passwords (title, username, password, url, notes, category, tags, favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.title,
      entry.username,
      entry.password,
      entry.url || null,
      entry.notes || null,
      category,
      entry.tags || null,
      entry.favorite ? 1 : 0
    );
    return result.lastInsertRowid as number;
  }

  updatePassword(id: number, entry: Partial<PasswordEntry>): void {
    const existing = this.getPasswordById(id);
    if (!existing) {
      throw new Error(`Password entry with id ${id} not found`);
    }

    const category = this.normalizePasswordCategory(entry.category ?? existing.category);
    this.ensureCategoryExists(category);

    const stmt = this.db.prepare(`
      UPDATE passwords
      SET title = ?, username = ?, password = ?, url = ?, notes = ?,
          category = ?, tags = ?, favorite = ?, updatedAt = strftime('%s', 'now')
      WHERE id = ?
    `);
    stmt.run(
      entry.title ?? existing.title,
      entry.username ?? existing.username,
      entry.password ?? existing.password,
      entry.url ?? existing.url ?? null,
      entry.notes ?? existing.notes ?? null,
      category,
      entry.tags ?? existing.tags ?? null,
      (entry.favorite ?? existing.favorite) ? 1 : 0,
      id
    );
  }

  deletePassword(id: number): void {
    const stmt = this.db.prepare('DELETE FROM passwords WHERE id = ?');
    stmt.run(id);
  }

  searchPasswords(query: string): PasswordEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM passwords
      WHERE title LIKE ? OR username LIKE ? OR url LIKE ? OR notes LIKE ?
      ORDER BY title
    `);
    const searchPattern = `%${query}%`;
    return stmt.all(searchPattern, searchPattern, searchPattern, searchPattern) as PasswordEntry[];
  }

  getCategories(): string[] {
    const stmt = this.db.prepare('SELECT name FROM categories ORDER BY name COLLATE NOCASE');
    const rows = stmt.all() as { name: string }[];
    return rows.map(row => row.name);
  }

  addCategory(name: string): void {
    const normalized = this.normalizeCategoryName(name);
    try {
      this.db.prepare('INSERT INTO categories (name) VALUES (?)').run(normalized);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new Error('分类已存在');
      }
      throw error;
    }
  }

  renameCategory(oldName: string, newName: string): void {
    const normalizedOldName = this.normalizeCategoryName(oldName);
    const normalizedNewName = this.normalizeCategoryName(newName);

    if (normalizedOldName.toLowerCase() === DEFAULT_CATEGORY.toLowerCase()) {
      throw new Error('默认分类不可重命名');
    }
    if (normalizedOldName.toLowerCase() === normalizedNewName.toLowerCase()) {
      return;
    }
    if (!this.categoryExists(normalizedOldName)) {
      throw new Error('分类不存在');
    }
    if (this.categoryExists(normalizedNewName)) {
      throw new Error('分类已存在');
    }

    this.db.exec('BEGIN TRANSACTION');
    try {
      this.db.prepare('UPDATE categories SET name = ? WHERE name = ? COLLATE NOCASE').run(normalizedNewName, normalizedOldName);
      this.db.prepare('UPDATE passwords SET category = ? WHERE category = ? COLLATE NOCASE').run(normalizedNewName, normalizedOldName);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  deleteCategory(name: string): { movedCount: number } {
    const normalizedName = this.normalizeCategoryName(name);

    if (normalizedName.toLowerCase() === DEFAULT_CATEGORY.toLowerCase()) {
      throw new Error('默认分类不可删除');
    }
    if (!this.categoryExists(normalizedName)) {
      throw new Error('分类不存在');
    }

    this.ensureCategoryExists(DEFAULT_CATEGORY);

    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM passwords WHERE category = ? COLLATE NOCASE');
    const moveStmt = this.db.prepare('UPDATE passwords SET category = ? WHERE category = ? COLLATE NOCASE');
    const deleteStmt = this.db.prepare('DELETE FROM categories WHERE name = ? COLLATE NOCASE');

    this.db.exec('BEGIN TRANSACTION');
    try {
      const row = countStmt.get(normalizedName) as { count: number } | undefined;
      const movedCount = row?.count ?? 0;

      if (movedCount > 0) {
        moveStmt.run(DEFAULT_CATEGORY, normalizedName);
      }

      deleteStmt.run(normalizedName);
      this.db.exec('COMMIT');

      return { movedCount };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  /**
   * 导出所有密码数据（用于备份）
   */
  exportAllData(): PasswordEntry[] {
    const stmt = this.db.prepare('SELECT * FROM passwords ORDER BY createdAt');
    return stmt.all() as PasswordEntry[];
  }

  /**
   * 批量导入密码数据
   * @param entries 要导入的密码条目
   * @param mergeMode 'skip' - 跳过已存在，'overwrite' - 覆盖，'rename' - 重命名
   * @returns 导入结果统计
   */
  importPasswords(
    entries: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>[],
    mergeMode: 'skip' | 'overwrite' | 'rename' = 'skip'
  ): { imported: number; skipped: number; updated: number } {
    const result = { imported: 0, skipped: 0, updated: 0 };

    const insertStmt = this.db.prepare(`
      INSERT INTO passwords (title, username, password, url, notes, category, tags, favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = this.db.prepare(`
      UPDATE passwords
      SET title = ?, username = ?, password = ?, url = ?, notes = ?,
          category = ?, tags = ?, favorite = ?, updatedAt = strftime('%s', 'now')
      WHERE username = ? AND (title = ? OR url = ?)
    `);

    const checkExistsStmt = this.db.prepare(`
      SELECT id FROM passwords WHERE username = ? AND (title = ? OR url = ?)
    `);

    const ensuredCategories = new Set<string>();

    this.db.exec('BEGIN TRANSACTION');

    try {
      for (const entry of entries) {
        const existing = checkExistsStmt.get(entry.username, entry.title, entry.url || '') as { id: number } | undefined;
        const rawCategory = entry.category && entry.category.trim() ? entry.category : IMPORTED_CATEGORY;
        const category = this.normalizePasswordCategory(rawCategory);
        const categoryKey = category.toLowerCase();
        if (!ensuredCategories.has(categoryKey)) {
          this.ensureCategoryExists(category);
          ensuredCategories.add(categoryKey);
        }

        if (existing) {
          if (mergeMode === 'overwrite') {
            updateStmt.run(
              entry.title,
              entry.username,
              entry.password,
              entry.url || null,
              entry.notes || null,
              category,
              entry.tags || null,
              entry.favorite ? 1 : 0,
              entry.username,
              entry.title,
              entry.url || ''
            );
            result.updated++;
          } else if (mergeMode === 'skip') {
            result.skipped++;
          } else {
            const newTitle = `${entry.title} (imported-${Date.now()})`;
            insertStmt.run(
              newTitle,
              entry.username,
              entry.password,
              entry.url || null,
              entry.notes || null,
              category,
              entry.tags || null,
              entry.favorite ? 1 : 0
            );
            result.imported++;
          }
        } else {
          insertStmt.run(
            entry.title,
            entry.username,
            entry.password,
            entry.url || null,
            entry.notes || null,
            category,
            entry.tags || null,
            entry.favorite ? 1 : 0
          );
          result.imported++;
        }
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return result;
  }
}

let dbInstance: Database | null = null;

export function initDatabase(): Database {
  if (!dbInstance) {
    const dbPath = path.join(app.getPath('userData'), 'passwords.db');
    dbInstance = new Database(dbPath);
  }
  return dbInstance;
}

export function getDatabase(): Database | null {
  return dbInstance;
}
