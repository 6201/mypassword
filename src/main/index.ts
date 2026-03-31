import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { initDatabase, Database } from './database';
import { encrypt, decrypt, generateKey } from './crypto';
import { generatePassword } from './password-generator';
import { encryptExportData, decryptExportData, generateExportFilename, ExportData } from './export-import';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-passwords', () => {
  return db?.getAllPasswords();
});

ipcMain.handle('add-password', (_, entry) => {
  return db?.addPassword(entry);
});

ipcMain.handle('update-password', (_, id, entry) => {
  return db?.updatePassword(id, entry);
});

ipcMain.handle('delete-password', (_, id) => {
  return db?.deletePassword(id);
});

ipcMain.handle('generate-password', (_, options) => {
  return generatePassword(options);
});

ipcMain.handle('search-passwords', (_, query) => {
  return db?.searchPasswords(query);
});

// 导出数据处理
ipcMain.handle('export-data', async (_, exportPassword: string) => {
  if (!db) {
    return { success: false, error: '数据库未初始化' };
  }

  try {
    // 获取所有密码数据
    const entries = db.exportAllData();

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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 导入数据处理
ipcMain.handle('import-data', async (_, importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename') => {
  if (!db) {
    return { success: false, error: '数据库未初始化' };
  }

  try {
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
    const importResult = db.importPasswords(exportData.entries, mergeMode);

    return {
      success: true,
      ...importResult,
      filename: path.basename(filePath)
    };
  } catch (error: any) {
    if (error.message.includes('ECONNRESET') || error.code === 'ERR_CRYPTO') {
      return { success: false, error: '密码错误或文件已损坏' };
    }
    return { success: false, error: error.message };
  }
});
