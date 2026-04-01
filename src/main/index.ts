import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import { initDatabase, Database } from './database';
import { generatePassword } from './password-generator';
import { encryptExportData, decryptExportData, generateExportFilename, ExportData } from './export-import';
import { parseOnePasswordCSV, parseOnePassword1PIF, OnePasswordEntry } from './onepassword-importer';
import { generateSalt, hashPassword, verifyPassword } from './crypto';
import * as fs from 'fs';

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

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;
let isLocked = false;

function requireDatabase(): Database {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
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

function verifyLockPassword(rawPassword: string): boolean {
  const settings = requireDatabase().getLockSettings();
  if (!settings.passwordHash || !settings.passwordSalt) {
    return false;
  }
  return verifyPassword(rawPassword, Buffer.from(settings.passwordSalt, 'hex'), settings.passwordHash);
}

function setLockPassword(password: string): void {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  requireDatabase().setLockPassword(hash, salt.toString('hex'));
}

function ensureUnlocked(): void {
  const status = getLockStatus();
  if (status.hasPassword && status.isLocked) {
    throw new Error('应用已锁定，请先解锁');
  }
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

app.whenReady().then(() => {
  db = initDatabase();
  const settings = requireDatabase().getLockSettings();
  const hasPassword = Boolean(settings.passwordHash && settings.passwordSalt);
  isLocked = hasPassword;
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('lock-get-status', () => {
  return getLockStatus();
});

ipcMain.handle('lock-set-password', (_, payload: LockSetPasswordPayload) => {
  const nextPassword = validateLockPassword(payload?.newPassword || '');
  const status = getLockStatus();

  if (status.hasPassword) {
    if (!payload?.currentPassword) {
      throw new Error('请输入当前锁屏密码');
    }
    if (!verifyLockPassword(payload.currentPassword)) {
      throw new Error('当前锁屏密码错误');
    }
  }

  setLockPassword(nextPassword);
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

ipcMain.handle('lock-unlock', (_, payload: { password: string }) => {
  const status = getLockStatus();

  if (!status.hasPassword || !status.isLocked) {
    return { success: true, status };
  }

  const password = payload?.password || '';
  if (!verifyLockPassword(password)) {
    return {
      success: false,
      error: '密码错误',
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

ipcMain.handle('generate-password', (_, options) => {
  ensureUnlocked();
  return generatePassword(options);
});

ipcMain.handle('search-passwords', (_, query) => {
  ensureUnlocked();
  return requireDatabase().searchPasswords(query);
});

// 导出数据处理
ipcMain.handle('export-data', async (_, exportPassword: string) => {
  ensureUnlocked();

  try {
    const database = requireDatabase();

    // 获取所有密码数据
    const entries = database.exportAllData();

    // 构建导出数据
    const exportData: ExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      count: entries.length,
      entries: entries.map(({ id, createdAt, updatedAt, ...rest }) => rest)
    };

    // 加密数据
    const encryptedData = encryptExportData(exportData, exportPassword);

    // 选择保存位置
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存备份文件',
      defaultPath: generateExportFilename(),
      filters: [{ name: 'MyPassword 备份', extensions: ['enc'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // 写入文件
    fs.writeFileSync(result.filePath, encryptedData);

    return {
      success: true,
      filePath: result.filePath,
      count: entries.length
    };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, '导出失败') };
  }
});

// 导入数据处理
ipcMain.handle('import-data', async (_, importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename') => {
  ensureUnlocked();

  try {
    const database = requireDatabase();

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

    // 解密数据
    const exportData = decryptExportData(encryptedData, importPassword);

    // 验证数据格式
    if (!exportData.version || !exportData.entries || !Array.isArray(exportData.entries)) {
      return { success: false, error: '无效的备份文件格式' };
    }

    // 导入数据
    const importResult = database.importPasswords(exportData.entries, mergeMode);

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
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    // 根据文件格式解析
    let entries: OnePasswordEntry[] = [];
    if (ext === '.csv') {
      entries = parseOnePasswordCSV(fileContent);
    } else if (ext === '.1pif') {
      entries = parseOnePassword1PIF(fileContent);
    } else {
      return { success: false, error: '不支持的文件格式，请使用 CSV 或 1PIF 格式' };
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
