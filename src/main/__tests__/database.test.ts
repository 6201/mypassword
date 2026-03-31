import { Database } from '../database';
import * as path from 'path';
import * as fs from 'fs';
import DatabaseLib from 'better-sqlite3';

describe('Database', () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(__dirname, 'test-passwords.db');
    const betterDb = new DatabaseLib(dbPath);
    db = new Database(betterDb);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('addPassword', () => {
    test('添加密码条目', () => {
      const id = db.addPassword({
        title: 'Test Account',
        username: 'test@example.com',
        password: 'secret123',
        category: 'Email'
      });

      expect(id).toBeGreaterThan(0);
    });

    test('添加密码后能查询到', () => {
      db.addPassword({
        title: 'GitHub',
        username: 'myuser',
        password: 'gh_token_123',
        url: 'https://github.com',
        category: 'Work'
      });

      const passwords = db.getAllPasswords();
      expect(passwords).toHaveLength(1);
      expect(passwords[0].title).toBe('GitHub');
      expect(passwords[0].username).toBe('myuser');
    });

    test('添加密码时自动创建分类', () => {
      db.addPassword({
        title: 'Bank',
        username: 'bank-user',
        password: 'money123',
        category: 'Finance'
      });

      const categories = db.getCategories();
      expect(categories).toContain('Finance');
    });
  });

  describe('getAllPasswords', () => {
    test('空数据库返回空数组', () => {
      const passwords = db.getAllPasswords();
      expect(passwords).toEqual([]);
    });

    test('返回所有密码条目', () => {
      db.addPassword({ title: 'A', username: 'a', password: '1' });
      db.addPassword({ title: 'B', username: 'b', password: '2' });
      db.addPassword({ title: 'C', username: 'c', password: '3' });

      const passwords = db.getAllPasswords();
      expect(passwords).toHaveLength(3);
    });
  });

  describe('getPasswordById', () => {
    test('通过 ID 获取密码', () => {
      const id = db.addPassword({
        title: 'Netflix',
        username: 'viewer@netflix.com',
        password: 'netflix123'
      });

      const password = db.getPasswordById(id);
      expect(password).toBeDefined();
      expect(password?.title).toBe('Netflix');
    });

    test('不存在的 ID 返回 undefined', () => {
      const password = db.getPasswordById(999);
      expect(password).toBeUndefined();
    });
  });

  describe('updatePassword', () => {
    test('更新密码信息', () => {
      const id = db.addPassword({
        title: 'Old Title',
        username: 'old@user.com',
        password: 'oldpass'
      });

      db.updatePassword(id, {
        title: 'New Title',
        password: 'newpass123'
      });

      const password = db.getPasswordById(id);
      expect(password?.title).toBe('New Title');
      expect(password?.password).toBe('newpass123');
      expect(password?.username).toBe('old@user.com');
    });

    test('更新密码分类时自动创建新分类', () => {
      const id = db.addPassword({
        title: 'Site',
        username: 'site-user',
        password: 'site-pass',
        category: 'Work'
      });

      db.updatePassword(id, { category: 'Personal' });

      const updated = db.getPasswordById(id);
      expect(updated?.category).toBe('Personal');
      expect(db.getCategories()).toContain('Personal');
    });
  });

  describe('deletePassword', () => {
    test('删除密码条目', () => {
      const id = db.addPassword({
        title: 'To Delete',
        username: 'delete@me.com',
        password: 'delete123'
      });

      db.deletePassword(id);

      const passwords = db.getAllPasswords();
      expect(passwords).toHaveLength(0);
    });
  });

  describe('searchPasswords', () => {
    beforeEach(() => {
      db.addPassword({ title: 'Google', username: 'gmail@test.com', password: 'g1', category: 'Email' });
      db.addPassword({ title: 'Facebook', username: 'fb@test.com', password: 'f1', category: 'Social' });
      db.addPassword({ title: 'GitHub', username: 'git@test.com', password: 'gh1', category: 'Work' });
      db.addPassword({ title: 'Netflix', username: 'movie@fan.com', password: 'n1', category: 'Entertainment' });
    });

    test('按标题搜索', () => {
      const results = db.searchPasswords('Google');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Google');
    });

    test('按用户名搜索', () => {
      const results = db.searchPasswords('movie');
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('movie@fan.com');
    });

    test('模糊搜索', () => {
      const results = db.searchPasswords('oo');
      expect(results.length).toBeGreaterThan(0);
    });

    test('搜索无结果返回空数组', () => {
      const results = db.searchPasswords('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    test('默认包含 Default 分类', () => {
      const categories = db.getCategories();
      expect(categories).toContain('Default');
    });

    test('获取所有分类且不重复', () => {
      db.addPassword({ title: 'A', username: 'a', password: '1', category: 'Email' });
      db.addPassword({ title: 'B', username: 'b', password: '2', category: 'Work' });
      db.addPassword({ title: 'C', username: 'c', password: '3', category: 'Email' });

      const categories = db.getCategories();
      expect(categories).toContain('Email');
      expect(categories).toContain('Work');
      expect(categories).toContain('Default');
      expect(categories.filter(c => c.toLowerCase() === 'email').length).toBe(1);
    });

    test('支持创建无密码分类', () => {
      db.addCategory('EmptyCategory');
      const categories = db.getCategories();
      expect(categories).toContain('EmptyCategory');
    });
  });

  describe('category CRUD', () => {
    describe('addCategory', () => {
      test('添加分类成功', () => {
        db.addCategory('Travel');
        expect(db.getCategories()).toContain('Travel');
      });

      test('分类名为空时报错', () => {
        expect(() => db.addCategory('   ')).toThrow('分类名称不能为空');
      });

      test('分类名重复时报错（忽略大小写）', () => {
        db.addCategory('Email');
        expect(() => db.addCategory('email')).toThrow('分类已存在');
      });

      test('保留分类名不可添加', () => {
        expect(() => db.addCategory('All')).toThrow('分类名称不可用');
      });
    });

    describe('renameCategory', () => {
      test('重命名分类并同步更新密码条目', () => {
        const id = db.addPassword({
          title: 'Workspace',
          username: 'dev@workspace.com',
          password: 'work-pass',
          category: 'Work'
        });

        db.renameCategory('Work', 'Office');

        const updated = db.getPasswordById(id);
        const categories = db.getCategories();

        expect(updated?.category).toBe('Office');
        expect(categories).toContain('Office');
        expect(categories).not.toContain('Work');
      });

      test('默认分类不可重命名', () => {
        expect(() => db.renameCategory('Default', 'Base')).toThrow('默认分类不可重命名');
      });
    });

    describe('deleteCategory', () => {
      test('删除未使用分类', () => {
        db.addCategory('Temp');

        const result = db.deleteCategory('Temp');
        const categories = db.getCategories();

        expect(result.movedCount).toBe(0);
        expect(categories).not.toContain('Temp');
      });

      test('删除已使用分类时迁移到 Default', () => {
        const id = db.addPassword({
          title: 'Social Account',
          username: 'user@social.com',
          password: 'social-pass',
          category: 'Social'
        });

        const result = db.deleteCategory('Social');
        const updated = db.getPasswordById(id);

        expect(result.movedCount).toBe(1);
        expect(updated?.category).toBe('Default');
        expect(db.getCategories()).not.toContain('Social');
      });

      test('默认分类不可删除', () => {
        expect(() => db.deleteCategory('Default')).toThrow('默认分类不可删除');
      });
    });
  });

  describe('importPasswords', () => {
    test('导入数据时自动创建分类', () => {
      const result = db.importPasswords([
        {
          title: 'Imported Service',
          username: 'imported@service.com',
          password: 'imported-pass',
          category: 'ImportedGroup'
        }
      ], 'skip');

      expect(result.imported).toBe(1);
      expect(db.getCategories()).toContain('ImportedGroup');
    });
  });

  describe('bootstrap categories', () => {
    test('初始化时回填旧数据中的分类并规范化保留值', () => {
      const legacyPath = path.join(__dirname, 'legacy-passwords.db');
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }

      const legacyDb = new DatabaseLib(legacyPath);
      legacyDb.exec(`
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

      const insertStmt = legacyDb.prepare(`
        INSERT INTO passwords (title, username, password, category)
        VALUES (?, ?, ?, ?)
      `);

      insertStmt.run('Legacy A', 'legacy-a', 'pass-a', ' Legacy ');
      insertStmt.run('Legacy B', 'legacy-b', 'pass-b', 'All');
      insertStmt.run('Legacy C', 'legacy-c', 'pass-c', '');

      legacyDb.close();

      const migratedDb = new Database(legacyPath);
      const categories = migratedDb.getCategories();
      const passwords = migratedDb.getAllPasswords();

      expect(categories).toContain('Legacy');
      expect(categories).toContain('Default');
      expect(categories).not.toContain('All');

      const allRow = passwords.find(item => item.username === 'legacy-b');
      const emptyRow = passwords.find(item => item.username === 'legacy-c');

      expect(allRow?.category).toBe('Default');
      expect(emptyRow?.category).toBe('Default');

      migratedDb.close();
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }
    });
  });
});
