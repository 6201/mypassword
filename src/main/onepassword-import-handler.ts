import type { VaultService } from '@mypassword/shared-core';
import { importOnePasswordEntriesThroughCore } from './onepassword-core-import';
import type { OnePasswordEntry } from './onepassword-importer';

export interface IpcMainLike {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

interface RegisterOnePasswordImportHandlerDeps {
  ipcMainLike: IpcMainLike;
  ensureUnlocked(): void;
  getVaultService(): Pick<VaultService, 'listSummaries' | 'createEntry'>;
  showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
  readFileSync(path: string, encoding: 'utf-8'): string;
  parseOnePasswordCSV(content: string): OnePasswordEntry[];
  parseOnePassword1PIF(content: string): OnePasswordEntry[];
  parseOnePassword1PUX(path: string): Promise<OnePasswordEntry[]>;
  getBasename(path: string): string;
  getExtension(path: string): string;
}

export function registerOnePasswordImportHandler(deps: RegisterOnePasswordImportHandlerDeps): void {
  deps.ipcMainLike.handle('import-from-1password', async () => {
    deps.ensureUnlocked();

    const result = await deps.showOpenDialog();
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const ext = deps.getExtension(filePath).toLowerCase();

    let entries: OnePasswordEntry[] = [];
    if (ext === '.1pux') {
      entries = await deps.parseOnePassword1PUX(filePath);
    } else {
      const fileContent = deps.readFileSync(filePath, 'utf-8');
      if (ext === '.csv') {
        entries = deps.parseOnePasswordCSV(fileContent);
      } else if (ext === '.1pif') {
        entries = deps.parseOnePassword1PIF(fileContent);
      } else {
        return { success: false, error: '不支持的文件格式，请使用 1PUX、CSV 或 1PIF 格式' };
      }
    }

    if (entries.length === 0) {
      return { success: false, error: '文件中没有找到有效的密码数据' };
    }

    const importResult = await importOnePasswordEntriesThroughCore(deps.getVaultService() as VaultService, entries);
    return {
      success: true,
      ...importResult,
      filename: deps.getBasename(filePath),
    };
  });
}
