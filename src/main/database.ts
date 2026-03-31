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
      entry.category || 'Default',
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
      entry.category ?? existing.category ?? 'Default',
      entry.tags ?? existing.tags ?? null,
      entry.favorite ?? existing.favorite ? 1 : 0,
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
    const stmt = this.db.prepare('SELECT DISTINCT category FROM passwords ORDER BY category');
    const rows = stmt.all() as { category: string }[];
    return rows.map(row => row.category);
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

    this.db.exec('BEGIN TRANSACTION');

    try {
      for (const entry of entries) {
        const existing = checkExistsStmt.get(entry.username, entry.title, entry.url || '') as { id: number } | undefined;

        if (existing) {
          if (mergeMode === 'overwrite') {
            updateStmt.run(
              entry.title,
              entry.username,
              entry.password,
              entry.url || null,
              entry.notes || null,
              entry.category || 'Default',
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
            // rename: 添加后缀后插入
            const newTitle = `${entry.title} (imported-${Date.now()})`;
            insertStmt.run(
              newTitle,
              entry.username,
              entry.password,
              entry.url || null,
              entry.notes || null,
              entry.category || 'Imported',
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
            entry.category || 'Imported',
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
