import {
  decrypt,
  decryptPasswordField,
  encrypt,
  encryptPasswordField,
  generateDataEncryptionKey,
  generateKey,
  hashPassword,
  isEncryptedPasswordField,
  verifyPassword,
  generateSalt
} from '../crypto';

describe('Crypto', () => {
  describe('generateKey', () => {
    test('生成 32 字节 (64 字符 hex) 密钥', () => {
      const key = generateKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    test('生成的密钥具有随机性', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateSalt', () => {
    test('生成 32 字节盐', () => {
      const salt = generateSalt();
      expect(salt).toHaveLength(32);
      expect(Buffer.isBuffer(salt)).toBe(true);
    });

    test('生成的盐具有随机性', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1.toString('hex')).not.toBe(salt2.toString('hex'));
    });
  });

  describe('hashPassword', () => {
    test('哈希密码返回 64 字符 hex 字符串', () => {
      const salt = generateSalt();
      const hash = hashPassword('testpassword', salt);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    test('相同密码和盐生成相同哈希', () => {
      const salt = generateSalt();
      const hash1 = hashPassword('testpassword', salt);
      const hash2 = hashPassword('testpassword', salt);
      expect(hash1).toBe(hash2);
    });

    test('相同密码不同盐生成不同哈希', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const hash1 = hashPassword('testpassword', salt1);
      const hash2 = hashPassword('testpassword', salt2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    test('验证正确的密码', () => {
      const salt = generateSalt();
      const hash = hashPassword('testpassword', salt);
      expect(verifyPassword('testpassword', salt, hash)).toBe(true);
    });

    test('验证错误的密码', () => {
      const salt = generateSalt();
      const hash = hashPassword('testpassword', salt);
      expect(verifyPassword('wrongpassword', salt, hash)).toBe(false);
    });
  });

  describe('encrypt/decrypt', () => {
    test('加密后能正确解密', () => {
      const key = generateKey();
      const plaintext = 'This is a secret password';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    test('加密后的数据与原文不同', () => {
      const key = generateKey();
      const plaintext = 'password123';
      const encrypted = encrypt(plaintext, key);
      expect(encrypted).not.toBe(plaintext);
    });

    test('每次加密结果不同（随机 IV）', () => {
      const key = generateKey();
      const plaintext = 'password123';
      const encrypted1 = encrypt(plaintext, key);
      const encrypted2 = encrypt(plaintext, key);
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('解密后数据完整', () => {
      const key = generateKey();
      const testData = [
        'simple',
        'with spaces',
        '特殊字符 !@#$%^&*()',
        'unicode 🚀🔐',
        'very long password ' + 'a'.repeat(100)
      ];

      for (const data of testData) {
        const encrypted = encrypt(data, key);
        const decrypted = decrypt(encrypted, key);
        expect(decrypted).toBe(data);
      }
    });
  });

  describe('password field encryption', () => {
    test('字段密文可加解密并带版本前缀', () => {
      const key = generateDataEncryptionKey();
      const encrypted = encryptPasswordField('my-secret', key);

      expect(isEncryptedPasswordField(encrypted)).toBe(true);
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      expect(decryptPasswordField(encrypted, key)).toBe('my-secret');
    });

    test('解密函数兼容未加密旧值', () => {
      const key = generateDataEncryptionKey();
      expect(decryptPasswordField('legacy-plain', key)).toBe('legacy-plain');
    });

    test('不同 IV 会产生不同密文', () => {
      const key = generateDataEncryptionKey();
      const encryptedA = encryptPasswordField('same-input', key);
      const encryptedB = encryptPasswordField('same-input', key);

      expect(encryptedA).not.toBe(encryptedB);
    });

    test('错误密钥无法解密字段密文', () => {
      const keyA = generateDataEncryptionKey();
      const keyB = generateDataEncryptionKey();
      const encrypted = encryptPasswordField('my-secret', keyA);

      expect(() => decryptPasswordField(encrypted, keyB)).toThrow();
    });
  });
});
