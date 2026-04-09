import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { initDatabase, Database } from './database';
import { parseOnePasswordCSV, parseOnePassword1PIF, parseOnePassword1PUX, OnePasswordEntry } from './onepassword-importer';
import { generateSalt, hashPassword, verifyPassword } from './crypto';
import {
  DesktopKeyStoreAdapter,
  DesktopCryptoAdapter,
  DesktopStorageAdapter,
  LOCK_SECRET_DIGEST_KEY,
  DEVICE_KEY_UNAVAILABLE_ERROR,
  computeLockSecretDigest,
} from '../shared/desktop-adapter-map';
import {
  classifyLockError,
  type VaultErrorCode,
  createVaultService,
} from '@mypassword/shared-core';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const FAVICON_CACHE_DIR_NAME = 'favicons';
const faviconCache = new Map<string, string | null>();
const faviconInFlight = new Map<string, Promise<string | null>>();

function normalizeHttpUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL((rawUrl || '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getHtmlAttribute(tag: string, attrName: string): string | null {
  const escapedName = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`${escapedName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[2] || match?.[3] || match?.[4] || null;
}

function parseIconCandidatesFromHtml(html: string, baseUrl: URL): string[] {
  const linkTagRegex = /<link\b[^>]*>/gi;
  const rankedCandidates: Array<{ score: number; url: string }> = [];
  const source = html.slice(0, 512_000);

  for (const tag of source.match(linkTagRegex) || []) {
    const rel = (getHtmlAttribute(tag, 'rel') || '').toLowerCase();
    const href = getHtmlAttribute(tag, 'href');

    if (!href || !rel.includes('icon')) {
      continue;
    }

    let iconUrl: URL;
    try {
      iconUrl = new URL(href, baseUrl);
    } catch {
      continue;
    }

    if (iconUrl.protocol !== 'http:' && iconUrl.protocol !== 'https:') {
      continue;
    }

    let score = 0;
    if (rel.includes('shortcut icon')) score += 40;
    if (/(^|\s)icon(\s|$)/.test(rel)) score += 30;
    if (rel.includes('apple-touch-icon')) score += 20;

    const type = (getHtmlAttribute(tag, 'type') || '').toLowerCase();
    if (type.includes('png')) score += 8;
    if (type.includes('x-icon') || type.includes('vnd.microsoft.icon')) score += 7;
    if (type.includes('svg')) score += 6;

    const sizes = (getHtmlAttribute(tag, 'sizes') || '').toLowerCase();
    if (sizes === 'any') {
      score += 5;
    } else {
      const sizeMatch = sizes.match(/(\d+)\s*x\s*(\d+)/);
      if (sizeMatch) {
        const width = Number(sizeMatch[1]);
        const height = Number(sizeMatch[2]);
        score += Math.min(10, Math.floor((width + height) / 64));
      }
    }

    rankedCandidates.push({ score, url: iconUrl.toString() });
  }

  const deduped = new Set<string>();
  return rankedCandidates
    .sort((a, b) => b.score - a.score)
    .map(candidate => candidate.url)
    .filter(url => {
      if (deduped.has(url)) {
        return false;
      }
      deduped.add(url);
      return true;
    });
}

function getCacheKey(pageUrl: URL): string {
  return createHash('sha256').update(pageUrl.origin).digest('hex');
}

function getFaviconCacheDir(): string {
  const cacheDir = path.join(app.getPath('userData'), FAVICON_CACHE_DIR_NAME);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function findCachedIconFiles(cacheKey: string): string[] {
  const cacheDir = getFaviconCacheDir();
  const extensions = ['.png', '.ico', '.svg', '.jpg', '.jpeg', '.webp', '.gif'];
  const files: string[] = [];

  for (const extension of extensions) {
    const iconPath = path.join(cacheDir, `${cacheKey}${extension}`);
    if (fs.existsSync(iconPath)) {
      files.push(iconPath);
    }
  }

  return files;
}

function normalizeContentType(contentType: string | null): string {
  return (contentType || '').split(';')[0].trim().toLowerCase();
}

function detectIconExtensionFromBuffer(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 && buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return '.png';
  }

  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return '.ico';
  }

  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return '.jpg';
  }

  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return '.gif';
    }
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.subarray(0, 4).toString('ascii');
    const webpHeader = buffer.subarray(8, 12).toString('ascii');
    if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
      return '.webp';
    }
  }

  const textProbe = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf8');
  const normalizedProbe = textProbe.replace(/^\uFEFF/, '').trimStart();
  if (/^<\?xml[\s\S]*?<svg\b/i.test(normalizedProbe) || /^<svg\b/i.test(normalizedProbe)) {
    return '.svg';
  }

  return null;
}

function inferIconExtension(iconUrl: URL, contentType: string | null, buffer: Buffer): string | null {
  const normalizedType = normalizeContentType(contentType);
  if (normalizedType && !normalizedType.startsWith('image/')) {
    return null;
  }

  const detectedExtension = detectIconExtensionFromBuffer(buffer);
  if (detectedExtension) {
    return detectedExtension;
  }

  const ext = path.extname(iconUrl.pathname).toLowerCase();
  if (!normalizedType && ['.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }

  return null;
}

function validateCachedIconFile(iconPath: string): string | null {
  try {
    const data = fs.readFileSync(iconPath);
    if (!detectIconExtensionFromBuffer(data)) {
      fs.rmSync(iconPath, { force: true });
      return null;
    }

    return pathToFileURL(iconPath).toString();
  } catch {
    try {
      fs.rmSync(iconPath, { force: true });
    } catch {
      // Ignore cleanup failures for stale cache files.
    }
    return null;
  }
}

function fileUrlToPathSafe(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    if (parsed.protocol !== 'file:') {
      return null;
    }
    return fileURLToPath(parsed);
  } catch {
    return null;
  }
}

async function fetchBinary(url: string, timeoutMs = 8000): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'MyPassword/1.0'
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0 || data.length > 2 * 1024 * 1024) {
      return null;
    }

    return { buffer: data, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function collectIconCandidates(pageUrl: URL): Promise<string[]> {
  const fallback = new URL('/favicon.ico', pageUrl.origin).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(pageUrl.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'MyPassword/1.0'
      }
    });

    if (!response.ok) {
      return [fallback];
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) {
      return [fallback];
    }

    const html = await response.text();
    const fromHtml = parseIconCandidatesFromHtml(html, pageUrl);
    return Array.from(new Set([...fromHtml, fallback]));
  } catch {
    return [fallback];
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFavicon(rawUrl: string): Promise<string | null> {
  const pageUrl = normalizeHttpUrl(rawUrl);
  if (!pageUrl) {
    return null;
  }

  const cacheKey = getCacheKey(pageUrl);
  const inMemory = faviconCache.get(cacheKey);
  if (typeof inMemory === 'string') {
    const cachedPath = fileUrlToPathSafe(inMemory);
    if (cachedPath) {
      const validatedUrl = validateCachedIconFile(cachedPath);
      if (validatedUrl) {
        faviconCache.set(cacheKey, validatedUrl);
        return validatedUrl;
      }
    }
    faviconCache.delete(cacheKey);
  }
  if (inMemory === null) {
    return null;
  }

  const pending = faviconInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async (): Promise<string | null> => {
    const cachedFiles = findCachedIconFiles(cacheKey);
    for (const cachedPath of cachedFiles) {
      const validatedUrl = validateCachedIconFile(cachedPath);
      if (validatedUrl) {
        faviconCache.set(cacheKey, validatedUrl);
        return validatedUrl;
      }
    }

    const candidates = await collectIconCandidates(pageUrl);
    for (const candidateUrl of candidates) {
      const iconUrl = normalizeHttpUrl(candidateUrl);
      if (!iconUrl) {
        continue;
      }

      const iconData = await fetchBinary(iconUrl.toString());
      if (!iconData) {
        continue;
      }

      const extension = inferIconExtension(iconUrl, iconData.contentType, iconData.buffer);
      if (!extension) {
        continue;
      }

      const iconPath = path.join(getFaviconCacheDir(), `${cacheKey}${extension}`);
      for (const stalePath of findCachedIconFiles(cacheKey)) {
        if (stalePath !== iconPath) {
          try {
            fs.rmSync(stalePath, { force: true });
          } catch {
            // Ignore stale-cache cleanup failures.
          }
        }
      }

      try {
        fs.writeFileSync(iconPath, iconData.buffer);
      } catch {
        continue;
      }

      const fileUrl = pathToFileURL(iconPath).toString();
      faviconCache.set(cacheKey, fileUrl);
      return fileUrl;
    }

    faviconCache.set(cacheKey, null);
    return null;
  })();

  faviconInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    faviconInFlight.delete(cacheKey);
  }
}

interface LockStatus {
  hasPassword: boolean;
  isLocked: boolean;
  autoEnabled: boolean;
  idleTimeoutSec: number;
}

interface LockSetPasswordPayload {
  newPassword: string;
  currentPassword?: string;
}

interface LockConfigPayload {
  autoEnabled?: boolean;
  idleTimeoutSec?: number;
}

interface LockUnlockResult {
  success: boolean;
  status: LockStatus;
  error?: string;
  errorCode?: VaultErrorCode;
}

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;
let vaultService: any | null = null; // We'll initialize this properly
let isLocked = false;

function requireDatabase(): Database {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

function requireVaultService(): any {
  if (!vaultService) {
    throw new Error('VaultService 未初始化');
  }
  return vaultService;
}

function validateLockPassword(password: string): string {
  if (!password || !password.trim()) {
    throw new Error('锁屏密码不能为空');
  }
  return password;
}

function getLockStatus(): LockStatus {
  const database = requireDatabase();
  const settings = database.getLockSettings();
  const hasPassword = Boolean(settings.passwordHash && settings.passwordSalt);

  if (!hasPassword) {
    isLocked = false;
  }

  return {
    hasPassword,
    isLocked: hasPassword ? isLocked : false,
    autoEnabled: hasPassword ? settings.autoEnabled : false,
    idleTimeoutSec: settings.idleTimeoutSec
  };
}

async function verifyLockPassword(rawPassword: string): Promise<boolean> {
  const settings = requireDatabase().getLockSettings();
  if (!settings.passwordHash || !settings.passwordSalt) {
    return false;
  }

  const isPasswordValid = verifyPassword(rawPassword, Buffer.from(settings.passwordSalt, 'hex'), settings.passwordHash);
  if (!isPasswordValid) {
    return false;
  }

  const database = requireDatabase();
  const digest = database.getSetting(LOCK_SECRET_DIGEST_KEY);
  if (!digest) {
    return true;
  }

  const adapter = createDesktopLockSecretAdapter(database);
  const lockSecretRaw = await adapter.readLockSecret();
  if (!lockSecretRaw) {
    throw new Error(DEVICE_KEY_UNAVAILABLE_ERROR);
  }

  if (computeLockSecretDigest(lockSecretRaw) !== digest) {
    throw new Error(DEVICE_KEY_UNAVAILABLE_ERROR);
  }

  return true;
}

function setLockPassword(password: string): Promise<void> {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const database = requireDatabase();
  database.setLockPassword(hash, salt.toString('hex'));

  const adapter = createDesktopLockSecretAdapter(database);
  const token = randomBytes(32).toString('hex');
  return adapter.storeLockSecret(token);
}

function ensureUnlocked(): void {
  const status = getLockStatus();
  if (status.hasPassword && status.isLocked) {
    throw new Error('应用已锁定，请先解锁');
  }
}

function createDesktopLockSecretAdapter(database: Database): DesktopKeyStoreAdapter {
  return new DesktopKeyStoreAdapter({
    getSetting: (key: string) => database.getSetting(key),
    setSetting: (key: string, value: string | null) => {
      database.setSetting(key, value);
    }
  });
}

async function ensureLockSecretProvisionedAfterUnlock(): Promise<void> {
  const database = requireDatabase();
  const existingDigest = database.getSetting(LOCK_SECRET_DIGEST_KEY);
  if (existingDigest) {
    return;
  }

  const adapter = createDesktopLockSecretAdapter(database);
  const token = randomBytes(32).toString('hex');
  await adapter.storeLockSecret(token);
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function isCryptoImportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorWithCode = error as Error & { code?: string };
  return error.message.includes('ECONNRESET') || errorWithCode.code === 'ERR_CRYPTO';
}

function createWindow(): void {
  // 隐藏默认菜单栏
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MyPassword',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      return;
    }

    createWindow();
  });

  app.whenReady().then(async () => {
    db = initDatabase();
    const storageAdapter = new DesktopStorageAdapter(db);
    const keystoreAdapter = new DesktopKeyStoreAdapter({
      getSetting: (key: string) => db!.getSetting(key),
      setSetting: (key: string, value: string | null) => {
        db!.setSetting(key, value);
      }
    });
    const cryptoAdapter = new DesktopCryptoAdapter();

    vaultService = createVaultService(storageAdapter, keystoreAdapter, cryptoAdapter);
    await vaultService.initialize();

    const settings = requireDatabase().getLockSettings();
    const hasPassword = Boolean(settings.passwordHash && settings.passwordSalt);
    isLocked = hasPassword;
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('lock-get-status', () => {
  return getLockStatus();
});

ipcMain.handle('lock-set-password', async (_, payload: LockSetPasswordPayload) => {
  const nextPassword = validateLockPassword(payload?.newPassword || '');
  const status = getLockStatus();

  if (status.hasPassword) {
    if (!payload?.currentPassword) {
      throw new Error('请输入当前锁屏密码');
    }
    const isCurrentPasswordValid = await verifyLockPassword(payload.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('当前锁屏密码错误');
    }
  }

  await setLockPassword(nextPassword);
  return getLockStatus();
});

ipcMain.handle('lock-update-config', (_, payload: LockConfigPayload) => {
  const status = getLockStatus();
  if (payload?.autoEnabled && !status.hasPassword) {
    throw new Error('请先设置锁屏密码');
  }

  requireDatabase().updateLockConfig(payload || {});
  return getLockStatus();
});

ipcMain.handle('lock-now', () => {
  const status = getLockStatus();
  if (!status.hasPassword) {
    throw new Error('请先设置锁屏密码');
  }

  isLocked = true;
  return getLockStatus();
});

ipcMain.handle('lock-unlock', async (_, payload: { password: string }): Promise<LockUnlockResult> => {
  const status = getLockStatus();

  if (!status.hasPassword || !status.isLocked) {
    return { success: true, status };
  }

  const password = payload?.password || '';
  try {
    const isPasswordValid = await verifyLockPassword(password);
    if (!isPasswordValid) {
      return {
        success: false,
        error: '密码错误',
        errorCode: 'INVALID_PASSWORD',
        status: getLockStatus()
      };
    }

    await ensureLockSecretProvisionedAfterUnlock();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '解锁失败';
    return {
      success: false,
      error: message,
      errorCode: classifyLockError(message),
      status: getLockStatus()
    };
  }

  isLocked = false;
  return {
    success: true,
    status: getLockStatus()
  };
});

ipcMain.handle('get-passwords', () => {
  ensureUnlocked();
  return requireDatabase().getAllPasswords();
});

ipcMain.handle('get-password-secret', (_, id: number) => {
  ensureUnlocked();
  return requireDatabase().getPasswordSecret(id);
});

ipcMain.handle('get-categories', () => {
  ensureUnlocked();
  return requireDatabase().getCategories();
});

ipcMain.handle('add-category', (_, name: string) => {
  ensureUnlocked();
  return requireDatabase().addCategory(name);
});

ipcMain.handle('rename-category', (_, oldName: string, newName: string) => {
  ensureUnlocked();
  return requireDatabase().renameCategory(oldName, newName);
});

ipcMain.handle('delete-category', (_, name: string) => {
  ensureUnlocked();
  return requireDatabase().deleteCategory(name);
});

ipcMain.handle('add-password', (_, entry) => {
  ensureUnlocked();
  return requireDatabase().addPassword(entry);
});

ipcMain.handle('update-password', (_, id, entry) => {
  ensureUnlocked();
  return requireDatabase().updatePassword(id, entry);
});

ipcMain.handle('delete-password', (_, id) => {
  ensureUnlocked();
  return requireDatabase().deletePassword(id);
});

ipcMain.handle('generate-password', async (_, options) => {
  // 生成密码是一个工具功能，不受锁定状态影响
  // 动态导入以确保在运行时正确加载
  const { generatePassword } = require('@mypassword/shared-core');
  return generatePassword(options);
});

ipcMain.handle('search-passwords', (_, query) => {
  ensureUnlocked();
  return requireDatabase().searchPasswords(query);
});

ipcMain.handle('resolve-favicon', async (_, rawUrl: string) => {
  ensureUnlocked();
  return resolveFavicon(rawUrl);
});

// 导出数据处理
ipcMain.handle('export-data', async (_, exportPassword: string) => {
  ensureUnlocked();

  try {
    const vaultSvc = requireVaultService();

    // 使用 core 库的导出功能
    const encryptedData = await vaultSvc.exportVault(exportPassword);

    // 选择保存位置
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存备份文件',
      defaultPath: `mypassword-backup-${new Date().toISOString().slice(0, 10)}-${new Date().toTimeString().slice(0, 8).replace(/:/g, '-')}.enc`,
      filters: [{ name: 'MyPassword 备份', extensions: ['enc'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // 写入文件
    fs.writeFileSync(result.filePath, Buffer.from(encryptedData));

    // 获取导出的条目数（需要从导出数据中解析）
    let count = 0;
    try {
      // Since the export is encrypted, we can't determine the exact count without decrypting
      // For now, we'll get the count from the database
      const database = requireDatabase();
      const entries = database.exportAllData();
      count = entries.length;
    } catch (err) {
      // If we can't get the count from the DB, we'll set it to 0
      count = 0;
    }

    return {
      success: true,
      filePath: result.filePath,
      count: count
    };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, '导出失败') };
  }
});

// 导入数据处理
ipcMain.handle('import-data', async (_, importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename') => {
  ensureUnlocked();

  try {
    const vaultSvc = requireVaultService();

    // 选择要导入的文件
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择备份文件',
      filters: [{ name: 'MyPassword 备份', extensions: ['enc'] }],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const encryptedData = fs.readFileSync(filePath);

    // 使用 core 库的导入功能
    const importResult = await vaultSvc.importVault(new Uint8Array(encryptedData), importPassword, mergeMode);

    return {
      success: true,
      ...importResult,
      filename: path.basename(filePath)
    };
  } catch (error: unknown) {
    if (isCryptoImportError(error)) {
      return { success: false, error: '密码错误或文件已损坏' };
    }

    return { success: false, error: getErrorMessage(error, '导入失败') };
  }
});

// 1Password 导入处理
ipcMain.handle('import-from-1password', async () => {
  ensureUnlocked();

  try {
    const database = requireDatabase();

    // 选择要导入的文件
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 1Password 导出文件',
      filters: [
        { name: '1Password 1PUX', extensions: ['1pux'] },
        { name: '1Password CSV', extensions: ['csv'] },
        { name: '1Password 1PIF', extensions: ['1pif'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    // 根据文件格式解析
    let entries: OnePasswordEntry[] = [];
    if (ext === '.1pux') {
      entries = await parseOnePassword1PUX(filePath);
    } else {
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      if (ext === '.csv') {
        entries = parseOnePasswordCSV(fileContent);
      } else if (ext === '.1pif') {
        entries = parseOnePassword1PIF(fileContent);
      } else {
        return { success: false, error: '不支持的文件格式，请使用 1PUX、CSV 或 1PIF 格式' };
      }
    }

    if (entries.length === 0) {
      return { success: false, error: '文件中没有找到有效的密码数据' };
    }

    // 导入数据
    const importResult = database.importPasswords(entries, 'skip');

    return {
      success: true,
      ...importResult,
      filename: path.basename(filePath)
    };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, '导入失败') };
  }
});
