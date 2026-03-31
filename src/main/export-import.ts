import crypto from 'crypto';
import { PasswordEntry } from './database';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

export interface ExportData {
  version: string;
  exportedAt: number;
  count: number;
  entries: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>[];
}

/**
 * 从密码派生加密密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * 加密导出数据
 */
export function encryptExportData(data: ExportData, exportPassword: string): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const key = deriveKey(exportPassword, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const jsonString = JSON.stringify(data);
  let encrypted = cipher.update(jsonString, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // 构建导出文件 Buffer: [salt(32)][iv(16)][tag(16)][encrypted data]
  const result = Buffer.concat([
    salt,
    iv,
    tag,
    Buffer.from(encrypted, 'base64')
  ]);

  return result;
}

/**
 * 解密导出数据
 */
export function decryptExportData(encryptedBuffer: Buffer, exportPassword: string): ExportData {
  // 提取各部分
  const salt = encryptedBuffer.slice(0, SALT_LENGTH);
  const iv = encryptedBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(exportPassword, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  const jsonString = decrypted.toString('utf8');
  return JSON.parse(jsonString) as ExportData;
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `mypassword-backup-${dateStr}-${timeStr}.enc`;
}
