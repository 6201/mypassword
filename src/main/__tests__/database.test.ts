import { Database } from '../database';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import DatabaseLib from 'better-sqlite3';

describe('Database', () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    // 创建临时数据库
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
      expect(password?.username).toBe('old@user.com'); // unchanged
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
    test('获取所有分类', () => {
      db.addPassword({ title: 'A', username: 'a', password: '1', category: 'Email' });
      db.addPassword({ title: 'B', username: 'b', password: '2', category: 'Work' });
      db.addPassword({ title: 'C', username: 'c', password: '3', category: 'Email' }); // duplicate category

      const categories = db.getCategories();
      expect(categories).toContain('Email');
      expect(categories).toContain('Work');
      expect(categories.length).toBeLessThanOrEqual(3);
    });
  });
});
