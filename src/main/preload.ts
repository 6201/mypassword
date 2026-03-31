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

contextBridge.exposeInMainWorld('electronAPI', {
  getPasswords: () => ipcRenderer.invoke('get-passwords'),
  getCategories: () => ipcRenderer.invoke('get-categories'),
  addCategory: (name: string) => ipcRenderer.invoke('add-category', name),
  renameCategory: (oldName: string, newName: string) => ipcRenderer.invoke('rename-category', oldName, newName),
  deleteCategory: (name: string) => ipcRenderer.invoke('delete-category', name),
  addPassword: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('add-password', entry),
  updatePassword: (id: number, entry: Partial<PasswordEntry>) =>
    ipcRenderer.invoke('update-password', id, entry),
  deletePassword: (id: number) =>
    ipcRenderer.invoke('delete-password', id),
  generatePassword: (options: Partial<PasswordGeneratorOptions>) =>
    ipcRenderer.invoke('generate-password', options),
  searchPasswords: (query: string) =>
    ipcRenderer.invoke('search-passwords', query),
  // 导出/导入功能
  exportData: (exportPassword: string) =>
    ipcRenderer.invoke('export-data', exportPassword),
  importData: (importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename') =>
    ipcRenderer.invoke('import-data', importPassword, mergeMode),
  // 1Password 导入
  importFrom1Password: () =>
    ipcRenderer.invoke('import-from-1password')
});
