import { contextBridge, ipcRenderer } from 'electron';

export interface PasswordEntry {
  id?: number;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  createdAt?: number;
  updatedAt?: number;
  favorite?: boolean;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  requireEachType: boolean;
}

export interface LockStatus {
  hasPassword: boolean;
  isLocked: boolean;
  autoEnabled: boolean;
  idleTimeoutSec: number;
}

export interface LockSetPasswordPayload {
  newPassword: string;
  currentPassword?: string;
}

export interface LockConfigPayload {
  autoEnabled?: boolean;
  idleTimeoutSec?: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  lockGetStatus: (): Promise<LockStatus> => ipcRenderer.invoke('lock-get-status'),
  lockSetPassword: (payload: LockSetPasswordPayload): Promise<LockStatus> => ipcRenderer.invoke('lock-set-password', payload),
  lockUpdateConfig: (payload: LockConfigPayload): Promise<LockStatus> => ipcRenderer.invoke('lock-update-config', payload),
  lockNow: (): Promise<LockStatus> => ipcRenderer.invoke('lock-now'),
  lockUnlock: (password: string): Promise<{ success: boolean; error?: string; status: LockStatus }> => ipcRenderer.invoke('lock-unlock', { password }),
  getPasswords: (): Promise<PasswordEntry[]> => ipcRenderer.invoke('get-passwords'),
  getCategories: (): Promise<string[]> => ipcRenderer.invoke('get-categories'),
  addCategory: (name: string): Promise<void> => ipcRenderer.invoke('add-category', name),
  renameCategory: (oldName: string, newName: string): Promise<void> => ipcRenderer.invoke('rename-category', oldName, newName),
  deleteCategory: (name: string): Promise<{ movedCount: number }> => ipcRenderer.invoke('delete-category', name),
  addPassword: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> =>
    ipcRenderer.invoke('add-password', entry),
  updatePassword: (id: number, entry: Partial<PasswordEntry>): Promise<void> =>
    ipcRenderer.invoke('update-password', id, entry),
  deletePassword: (id: number): Promise<void> =>
    ipcRenderer.invoke('delete-password', id),
  generatePassword: (options: Partial<PasswordGeneratorOptions>): Promise<string> =>
    ipcRenderer.invoke('generate-password', options),
  searchPasswords: (query: string): Promise<PasswordEntry[]> =>
    ipcRenderer.invoke('search-passwords', query),
  // 导出/导入功能
  exportData: (exportPassword: string): Promise<any> =>
    ipcRenderer.invoke('export-data', exportPassword),
  importData: (importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename'): Promise<any> =>
    ipcRenderer.invoke('import-data', importPassword, mergeMode),
  // 1Password 导入
  importFrom1Password: (): Promise<any> =>
    ipcRenderer.invoke('import-from-1password')
});
