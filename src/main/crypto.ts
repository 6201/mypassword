import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const PASSWORD_FIELD_PREFIX = 'enc:v1:';

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
  return Buffer.concat([Buffer.alloc(SALT_LENGTH), iv, Buffer.from(encrypted, 'base64'), tag]).toString('base64');
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
 * 生成字段级数据加密密钥（DEK）
 */
export function generateDataEncryptionKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * 判断是否为已加密密码字段
 */
export function isEncryptedPasswordField(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PASSWORD_FIELD_PREFIX);
}

/**
 * 加密密码字段（enc:v1:<base64(iv|tag|ciphertext)>)
 */
export function encryptPasswordField(plainText: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new Error('无效的数据加密密钥长度');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');

  return `${PASSWORD_FIELD_PREFIX}${payload}`;
}

/**
 * 解密密码字段（兼容未加密明文）
 */
export function decryptPasswordField(value: string, key: Buffer): string {
  if (!isEncryptedPasswordField(value)) {
    return value;
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error('无效的数据加密密钥长度');
  }

  const payload = value.slice(PASSWORD_FIELD_PREFIX.length);
  const data = Buffer.from(payload, 'base64');
  if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('密码字段密文格式无效');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
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
  const expected = Buffer.from(hash, 'hex');
  const actual = deriveKey(password, salt);

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}

/**
 * 哈希密码（用于验证）
 */
export function hashPassword(password: string, salt: Buffer): string {
  return deriveKey(password, salt).toString('hex');
}
