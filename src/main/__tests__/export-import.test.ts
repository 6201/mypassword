import { encryptExportData, decryptExportData, ExportData } from '../export-import';

describe('Export/Import', () => {
  const sampleData: ExportData = {
    version: '1.0',
    exportedAt: Date.now(),
    count: 2,
    entries: [
      {
        title: 'GitHub',
        username: 'user@example.com',
        password: 'gh_password123',
        url: 'https://github.com',
        notes: 'Work account',
        category: 'Work',
        tags: 'git,code',
        favorite: true
      },
      {
        title: 'Google',
        username: 'gmail@example.com',
        password: 'google_pass456',
        url: 'https://google.com',
        notes: '',
        category: 'Personal',
        tags: 'email',
        favorite: false
      }
    ]
  };

  const testPassword = 'test-export-password-123';

  describe('encryptExportData / decryptExportData', () => {
    test('加密后能正确解密', () => {
      const encrypted = encryptExportData(sampleData, testPassword);
      const decrypted = decryptExportData(encrypted, testPassword);

      expect(decrypted.version).toBe(sampleData.version);
      expect(decrypted.count).toBe(sampleData.count);
      expect(decrypted.entries).toHaveLength(2);
    });

    test('解密后的数据内容完整', () => {
      const encrypted = encryptExportData(sampleData, testPassword);
      const decrypted = decryptExportData(encrypted, testPassword);

      expect(decrypted.entries[0].title).toBe('GitHub');
      expect(decrypted.entries[0].username).toBe('user@example.com');
      expect(decrypted.entries[0].password).toBe('gh_password123');
      expect(decrypted.entries[1].title).toBe('Google');
    });

    test('错误的密码无法解密', () => {
      const encrypted = encryptExportData(sampleData, testPassword);

      expect(() => {
        decryptExportData(encrypted, 'wrong-password');
      }).toThrow();
    });

    test('每次加密结果不同（随机 IV 和盐）', () => {
      const encrypted1 = encryptExportData(sampleData, testPassword);
      const encrypted2 = encryptExportData(sampleData, testPassword);

      expect(encrypted1.toString('hex')).not.toBe(encrypted2.toString('hex'));
    });

    test('能处理空数据', () => {
      const emptyData: ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        count: 0,
        entries: []
      };

      const encrypted = encryptExportData(emptyData, testPassword);
      const decrypted = decryptExportData(encrypted, testPassword);

      expect(decrypted.count).toBe(0);
      expect(decrypted.entries).toHaveLength(0);
    });

    test('能处理特殊字符和 Unicode', () => {
      const unicodeData: ExportData = {
        version: '1.0',
        exportedAt: Date.now(),
        count: 1,
        entries: [{
          title: '中文标题 🚀',
          username: 'test@example.com',
          password: '密码！@#$%',
          url: 'https://例子.com',
          notes: '备注信息',
          category: '分类',
          tags: '标签 1，标签 2',
          favorite: false
        }]
      };

      const encrypted = encryptExportData(unicodeData, testPassword);
      const decrypted = decryptExportData(encrypted, testPassword);

      expect(decrypted.entries[0].title).toBe('中文标题 🚀');
      expect(decrypted.entries[0].password).toBe('密码！@#$%');
    });
  });
});
