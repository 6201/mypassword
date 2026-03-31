import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * 从密码派生加密密钥
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * 加密数据
 * 返回格式：salt(32) + iv(16) + encrypted + tag(16)，全部拼接为 base64
 */
export function encrypt(plainText: string, key: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // 拼接：salt + iv + encrypted + tag
  const result = Buffer.concat([Buffer.alloc(SALT_LENGTH), iv, Buffer.from(encrypted, 'base64'), tag]).toString('base64');
  return result;
}

/**
 * 解密数据
 */
export function decrypt(encryptedData: string, key: string): string {
  const data = Buffer.from(encryptedData, 'base64');

  // 提取各部分
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = data.slice(SALT_LENGTH + IV_LENGTH, data.length - TAG_LENGTH);
  const tag = data.slice(data.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * 生成随机密钥
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * 生成随机盐
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * 验证主密码
 */
export function verifyPassword(password: string, salt: Buffer, hash: string): boolean {
  const derivedKey = deriveKey(password, salt);
  return derivedKey.toString('hex') === hash;
}

/**
 * 哈希密码（用于验证）
 */
export function hashPassword(password: string, salt: Buffer): string {
  return deriveKey(password, salt).toString('hex');
}
