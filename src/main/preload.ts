import { contextBridge, ipcRenderer } from 'electron';
import type { VaultErrorCode } from '@mypassword/shared-core';

export interface PasswordEntry {
  id?: string;
  title: string;
  username: string;
  password?: string;
  url?: string;
  urls?: string[];
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

export interface BackupSettings {
  enabled: boolean;
  intervalMs: number;
  directory: string;
  password: string;
  retentionCount: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  lockGetStatus: (): Promise<LockStatus> => ipcRenderer.invoke('lock-get-status'),
  lockSetPassword: (payload: LockSetPasswordPayload): Promise<LockStatus> => ipcRenderer.invoke('lock-set-password', payload),
  lockUpdateConfig: (payload: LockConfigPayload): Promise<LockStatus> => ipcRenderer.invoke('lock-update-config', payload),
  lockNow: (): Promise<LockStatus> => ipcRenderer.invoke('lock-now'),
  lockUnlock: (password: string): Promise<{ success: boolean; error?: string; errorCode?: VaultErrorCode; status: LockStatus }> => ipcRenderer.invoke('lock-unlock', { password }),
  getPasswords: (): Promise<PasswordEntry[]> => ipcRenderer.invoke('get-passwords'),
  getPasswordSecret: (id: string): Promise<string> => ipcRenderer.invoke('get-password-secret', id),
  getCategories: (): Promise<string[]> => ipcRenderer.invoke('get-categories'),
  addCategory: (name: string): Promise<void> => ipcRenderer.invoke('add-category', name),
  renameCategory: (oldName: string, newName: string): Promise<void> => ipcRenderer.invoke('rename-category', oldName, newName),
  deleteCategory: (name: string): Promise<{ movedCount: number }> => ipcRenderer.invoke('delete-category', name),
  addPassword: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> =>
    ipcRenderer.invoke('add-password', entry),
  updatePassword: (id: string, entry: Partial<PasswordEntry>): Promise<void> =>
    ipcRenderer.invoke('update-password', id, entry),
  deletePassword: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-password', id),
  generatePassword: (options: Partial<PasswordGeneratorOptions>): Promise<string> =>
    ipcRenderer.invoke('generate-password', options),
  searchPasswords: (query: string): Promise<PasswordEntry[]> =>
    ipcRenderer.invoke('search-passwords', query),
  resolveFavicon: (url: string): Promise<string | null> =>
    ipcRenderer.invoke('resolve-favicon', url),
  getBackupSettings: (): Promise<BackupSettings> => ipcRenderer.invoke('backup-settings-get'),
  setBackupSettings: (payload: Partial<BackupSettings>): Promise<BackupSettings> => ipcRenderer.invoke('backup-settings-set', payload),
  pickBackupDirectory: (): Promise<{ canceled: boolean; directory?: string }> => ipcRenderer.invoke('backup-settings-pick-directory'),
  // 导出/导入功能
  exportData: (exportPassword: string): Promise<any> =>
    ipcRenderer.invoke('export-data', exportPassword),
  importData: (importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename'): Promise<any> =>
    ipcRenderer.invoke('import-data', importPassword, mergeMode),
  // 1Password 导入
  importFrom1Password: (): Promise<any> =>
    ipcRenderer.invoke('import-from-1password'),
  scanPasswordDecryptFailures: (): Promise<{ totalEntries: number; failingEntryIds: string[] }> =>
    ipcRenderer.invoke('diagnostics:scan-password-decrypt-failures')
});
