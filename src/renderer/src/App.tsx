import React, { useState, useEffect, useRef } from 'react';
import PasswordList from './components/PasswordList';
import PasswordForm from './components/PasswordForm';
import PasswordGenerator from './components/PasswordGenerator';
import SearchBar from './components/SearchBar';
import CategoryNav from './components/CategoryNav';
import ExportImportModal from './components/ExportImportModal';

interface LockStatus {
  hasPassword: boolean;
  isLocked: boolean;
  autoEnabled: boolean;
  idleTimeoutSec: number;
}

interface LockUnlockResult {
  success: boolean;
  error?: string;
  status: LockStatus;
}

declare global {
  interface Window {
    electronAPI: {
      lockGetStatus: () => Promise<LockStatus>;
      lockSetPassword: (payload: { newPassword: string; currentPassword?: string }) => Promise<LockStatus>;
      lockUpdateConfig: (payload: { autoEnabled?: boolean; idleTimeoutSec?: number }) => Promise<LockStatus>;
      lockNow: () => Promise<LockStatus>;
      lockUnlock: (password: string) => Promise<LockUnlockResult>;
      getPasswords: () => Promise<any[]>;
      getCategories: () => Promise<string[]>;
      addCategory: (name: string) => Promise<void>;
      renameCategory: (oldName: string, newName: string) => Promise<void>;
      deleteCategory: (name: string) => Promise<{ movedCount: number }>;
      addPassword: (entry: any) => Promise<number>;
      updatePassword: (id: number, entry: any) => Promise<void>;
      deletePassword: (id: number) => Promise<void>;
      generatePassword: (options: any) => Promise<string>;
      searchPasswords: (query: string) => Promise<any[]>;
      exportData: (exportPassword: string) => Promise<any>;
      importData: (importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename') => Promise<any>;
      importFrom1Password: () => Promise<any>;
    };
  }
}

const DEFAULT_CATEGORY = 'Default';
const ALL_CATEGORY = 'All';
const DEFAULT_IDLE_TIMEOUT_SEC = 300;
const IDLE_EVENTS: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
const IDLE_TIMEOUT_OPTIONS = [
  { label: '1 分钟', value: 60 },
  { label: '5 分钟', value: 300 },
  { label: '10 分钟', value: 600 },
  { label: '15 分钟', value: 900 },
  { label: '30 分钟', value: 1800 },
  { label: '60 分钟', value: 3600 }
];

type CategoryDialogMode = 'add' | 'rename';

const normalizeCategory = (value: string): string => value.trim().toLowerCase();

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function shouldTrackAutoLock(status: LockStatus): boolean {
  return status.hasPassword && status.autoEnabled && !status.isLocked;
}

function getCategoryDialogActionError(mode: CategoryDialogMode | null): string {
  return mode === 'add' ? '添加分类失败' : '重命名分类失败';
}

const App: React.FC = () => {
  const [passwords, setPasswords] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([DEFAULT_CATEGORY]);
  const [categoryDialogMode, setCategoryDialogMode] = useState<CategoryDialogMode | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryEditingTarget, setCategoryEditingTarget] = useState<string | null>(null);
  const [categoryDialogError, setCategoryDialogError] = useState('');

  const [lockStatus, setLockStatus] = useState<LockStatus>({
    hasPassword: false,
    isLocked: false,
    autoEnabled: false,
    idleTimeoutSec: DEFAULT_IDLE_TIMEOUT_SEC
  });
  const [showLockSettings, setShowLockSettings] = useState(false);
  const [lockCurrentPassword, setLockCurrentPassword] = useState('');
  const [lockNewPassword, setLockNewPassword] = useState('');
  const [lockConfirmPassword, setLockConfirmPassword] = useState('');
  const [lockAutoEnabled, setLockAutoEnabled] = useState(false);
  const [lockIdleTimeoutSec, setLockIdleTimeoutSec] = useState(DEFAULT_IDLE_TIMEOUT_SEC);
  const [lockSettingsError, setLockSettingsError] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const lastActivityAtRef = useRef<number>(Date.now());

  const normalizeCategories = (source: string[]): string[] => {
    const unique = new Map<string, string>();

    for (const rawCategory of source || []) {
      const category = (rawCategory || '').trim();
      if (!category || normalizeCategory(category) === normalizeCategory(ALL_CATEGORY)) {
        continue;
      }
      const key = normalizeCategory(category);
      if (!unique.has(key)) {
        unique.set(key, category);
      }
    }

    if (!unique.has(normalizeCategory(DEFAULT_CATEGORY))) {
      unique.set(normalizeCategory(DEFAULT_CATEGORY), DEFAULT_CATEGORY);
    }

    return Array.from(unique.values()).sort((a, b) =>
      a.localeCompare(b, 'zh-CN', { sensitivity: 'base' })
    );
  };

  const loadLockStatus = async (): Promise<LockStatus> => {
    const nextStatus = await window.electronAPI.lockGetStatus();
    setLockStatus(nextStatus);
    setLockAutoEnabled(nextStatus.autoEnabled);
    setLockIdleTimeoutSec(nextStatus.idleTimeoutSec);

    if (!nextStatus.isLocked) {
      setUnlockPassword('');
      setUnlockError('');
    }

    if (nextStatus.isLocked) {
      setShowForm(false);
      setShowGenerator(false);
      setShowExportImport(false);
      closeCategoryDialog();
      setShowLockSettings(false);
      setPasswords([]);
      setCategories([DEFAULT_CATEGORY]);
      setSelectedCategory(ALL_CATEGORY);
      setSearchQuery('');
    }

    return nextStatus;
  };

  const loadData = async (): Promise<void> => {
    const [passwordData, categoryData] = await Promise.all([
      window.electronAPI.getPasswords(),
      window.electronAPI.getCategories()
    ]);

    setPasswords(passwordData || []);
    setCategories(normalizeCategories(categoryData || []));
  };

  useEffect(() => {
    const initialize = async () => {
      const status = await loadLockStatus();
      if (!status.isLocked) {
        await loadData();
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORY) {
      return;
    }

    const matchedCategory = categories.find(
      category => normalizeCategory(category) === normalizeCategory(selectedCategory)
    );

    if (!matchedCategory) {
      setSelectedCategory(ALL_CATEGORY);
      return;
    }

    if (matchedCategory !== selectedCategory) {
      setSelectedCategory(matchedCategory);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (!shouldTrackAutoLock(lockStatus)) {
      return;
    }

    const updateActivity = (): void => {
      lastActivityAtRef.current = Date.now();
    };

    IDLE_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, updateActivity, { passive: true });
    });

    const timer = window.setInterval(async () => {
      const idleFor = Date.now() - lastActivityAtRef.current;
      if (idleFor < lockStatus.idleTimeoutSec * 1000) {
        return;
      }

      try {
        await window.electronAPI.lockNow();
        await loadLockStatus();
      } catch {
        // ignored: status refresh below will reconcile state on next tick/user action
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      IDLE_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, updateActivity);
      });
    };
  }, [lockStatus.hasPassword, lockStatus.autoEnabled, lockStatus.isLocked, lockStatus.idleTimeoutSec]);


  const handleAddPassword = async (entry: any): Promise<void> => {
    await window.electronAPI.addPassword(entry);
    setShowForm(false);
    await loadData();
  };

  const handleUpdatePassword = async (entry: any): Promise<void> => {
    if (!editingId) {
      return;
    }

    await window.electronAPI.updatePassword(editingId, entry);
    setEditingId(null);
    setShowForm(false);
    await loadData();
  };

  const handleDeletePassword = async (id: number): Promise<void> => {
    if (!confirm('确定要删除这个密码吗？')) {
      return;
    }

    await window.electronAPI.deletePassword(id);
    await loadData();
  };

  const handleEdit = (password: any): void => {
    setEditingId(password.id);
    setShowForm(true);
  };

  function closeCategoryDialog(): void {
    setCategoryDialogMode(null);
    setCategoryInput('');
    setCategoryEditingTarget(null);
    setCategoryDialogError('');
  }

  function openCategoryDialog(mode: CategoryDialogMode, category = ''): void {
    setCategoryDialogMode(mode);
    if (mode === 'add') {
      setCategoryEditingTarget(null);
      setCategoryInput('');
    } else {
      setCategoryEditingTarget(category);
      setCategoryInput(category);
    }
    setCategoryDialogError('');
  }

  function openAddCategoryDialog(): void {
    openCategoryDialog('add');
  }

  function openRenameCategoryDialog(category: string): void {
    openCategoryDialog('rename', category);
  }

  function handleCategoryInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setCategoryInput(event.target.value);
    if (categoryDialogError) {
      setCategoryDialogError('');
    }
  }

  const handleSubmitCategoryDialog: React.ComponentProps<'form'>['onSubmit'] = async event => {
    event.preventDefault();

    const normalizedName = categoryInput.trim();
    if (!normalizedName) {
      setCategoryDialogError('分类名称不能为空');
      return;
    }

    try {
      if (categoryDialogMode === 'add') {
        await window.electronAPI.addCategory(normalizedName);
        await loadData();
        setSelectedCategory(normalizedName);
        closeCategoryDialog();
        return;
      }

      if (categoryDialogMode !== 'rename' || !categoryEditingTarget) {
        setCategoryDialogError('分类操作失败');
        return;
      }

      if (normalizedName === categoryEditingTarget) {
        closeCategoryDialog();
        return;
      }

      await window.electronAPI.renameCategory(categoryEditingTarget, normalizedName);
      await loadData();
      if (selectedCategory === categoryEditingTarget) {
        setSelectedCategory(normalizedName);
      }
      closeCategoryDialog();
    } catch (error: unknown) {
      setCategoryDialogError(getErrorMessage(error, getCategoryDialogActionError(categoryDialogMode)));
    }
  };

  const handleDeleteCategory = async (category: string) => {
    const confirmed = confirm(`删除分类“${category}”？\n该分类下的密码会自动迁移到 ${DEFAULT_CATEGORY}。`);
    if (!confirmed) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteCategory(category);
      await loadData();

      if (selectedCategory === category) {
        setSelectedCategory(DEFAULT_CATEGORY);
      }

      if (result?.movedCount) {
        alert(`分类已删除，${result.movedCount} 条密码已迁移到 ${DEFAULT_CATEGORY}`);
      }
    } catch (error: unknown) {
      alert(getErrorMessage(error, '删除分类失败'));
    }
  };

  const openLockSettings = (): void => {
    setLockCurrentPassword('');
    setLockNewPassword('');
    setLockConfirmPassword('');
    setLockSettingsError('');
    setLockAutoEnabled(lockStatus.autoEnabled);
    setLockIdleTimeoutSec(lockStatus.idleTimeoutSec);
    setShowLockSettings(true);
  };

  const closeLockSettings = (): void => {
    setShowLockSettings(false);
    setLockSettingsError('');
  };

  const handleSaveLockSettings: React.ComponentProps<'form'>['onSubmit'] = async event => {
    event.preventDefault();

    const wantsSetPassword = lockNewPassword.length > 0 || lockConfirmPassword.length > 0;

    if (wantsSetPassword) {
      if (lockNewPassword !== lockConfirmPassword) {
        setLockSettingsError('两次输入的密码不一致');
        return;
      }
      if (!lockNewPassword.trim()) {
        setLockSettingsError('锁屏密码不能为空');
        return;
      }
    }

    try {
      if (wantsSetPassword) {
        await window.electronAPI.lockSetPassword({
          newPassword: lockNewPassword,
          currentPassword: lockStatus.hasPassword ? lockCurrentPassword : undefined
        });
      }

      await window.electronAPI.lockUpdateConfig({
        autoEnabled: lockAutoEnabled,
        idleTimeoutSec: lockIdleTimeoutSec
      });

      await loadLockStatus();
      lastActivityAtRef.current = Date.now();
      closeLockSettings();
    } catch (error: unknown) {
      setLockSettingsError(getErrorMessage(error, '保存安全设置失败'));
    }
  };

  const handleLockNow = async (): Promise<void> => {
    try {
      await window.electronAPI.lockNow();
      await loadLockStatus();
    } catch (error: unknown) {
      alert(getErrorMessage(error, '锁定失败'));
    }
  };

  const handleUnlock: React.ComponentProps<'form'>['onSubmit'] = async event => {
    event.preventDefault();

    if (!unlockPassword.trim()) {
      setUnlockError('请输入锁屏密码');
      return;
    }

    const result = await window.electronAPI.lockUnlock(unlockPassword);
    if (!result.success) {
      setUnlockError(result.error || '解锁失败');
      return;
    }

    setLockStatus(result.status);
    setUnlockPassword('');
    setUnlockError('');
    lastActivityAtRef.current = Date.now();
    await loadData();
  };

  const navCategories = [ALL_CATEGORY, ...categories];

  const filteredPasswords = passwords.filter(p => {
    const matchesCategory = selectedCategory === ALL_CATEGORY || p.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryDialogTitle = categoryDialogMode === 'add' ? '添加分类' : '重命名分类';
  const categoryDialogSubmitText = categoryDialogMode === 'add' ? '添加' : '保存';

  return (
    <div className="flex h-screen bg-gray-50">
      {lockStatus.isLocked && (
        <div className="lock-overlay">
          <div className="lock-card">
            <h2 className="text-lg font-semibold text-gray-900">应用已锁定</h2>
            <p className="mt-1 text-sm text-gray-600">请输入预设密码以继续使用</p>

            <form onSubmit={handleUnlock} className="mt-5 space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  value={unlockPassword}
                  onChange={event => {
                    setUnlockPassword(event.target.value);
                    if (unlockError) {
                      setUnlockError('');
                    }
                  }}
                  className="input-base"
                  placeholder="请输入锁屏密码"
                />
                {unlockError && (
                  <p className="mt-1.5 text-xs text-red-600">{unlockError}</p>
                )}
              </div>

              <button type="submit" className="btn-primary w-full justify-center">
                解锁
              </button>
            </form>
          </div>
        </div>
      )}

      <CategoryNav
        categories={navCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onAddCategory={openAddCategoryDialog}
        onEditCategory={openRenameCategoryDialog}
        onDeleteCategory={handleDeleteCategory}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <button
            onClick={openLockSettings}
            className="btn-secondary"
            title="安全设置"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 0v8m-7 0h14" />
            </svg>
          </button>
          {lockStatus.hasPassword && (
            <button
              onClick={handleLockNow}
              className="btn-secondary"
              title="立即锁定"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V9a5 5 0 00-10 0v2H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V9a3 3 0 016 0v2H9z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowExportImport(true)}
            className="btn-secondary"
            title="备份与恢复"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加密码
          </button>
          <button
            onClick={() => setShowGenerator(true)}
            className="btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            生成密码
          </button>
        </header>

        <PasswordList
          passwords={filteredPasswords}
          onEdit={handleEdit}
          onDelete={handleDeletePassword}
        />
      </div>

      {showForm && (
        <PasswordForm
          editData={editingId ? passwords.find(p => p.id === editingId) : undefined}
          categories={categories}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSubmit={editingId ? handleUpdatePassword : handleAddPassword}
        />
      )}

      {showGenerator && (
        <PasswordGenerator
          onClose={() => setShowGenerator(false)}
        />
      )}

      {showExportImport && (
        <ExportImportModal
          onClose={() => setShowExportImport(false)}
        />
      )}

      {showLockSettings && (
        <div className="modal-overlay" onClick={closeLockSettings}>
          <div
            className="modal-content max-w-md"
            onClick={event => event.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">安全设置</h3>
              <button
                type="button"
                onClick={closeLockSettings}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveLockSettings} className="p-6 space-y-4">
              {lockStatus.hasPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    当前锁屏密码
                  </label>
                  <input
                    type="password"
                    value={lockCurrentPassword}
                    onChange={event => setLockCurrentPassword(event.target.value)}
                    className="input-base"
                    placeholder="修改密码时必填"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  新锁屏密码
                </label>
                <input
                  type="password"
                  value={lockNewPassword}
                  onChange={event => setLockNewPassword(event.target.value)}
                  className="input-base"
                  placeholder={lockStatus.hasPassword ? '不修改可留空' : '请输入锁屏密码'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={lockConfirmPassword}
                  onChange={event => setLockConfirmPassword(event.target.value)}
                  className="input-base"
                  placeholder={lockStatus.hasPassword ? '不修改可留空' : '请再次输入锁屏密码'}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                <label className="text-sm text-gray-700">启用自动锁定</label>
                <input
                  type="checkbox"
                  checked={lockAutoEnabled}
                  onChange={event => setLockAutoEnabled(event.target.checked)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  空闲时长
                </label>
                <select
                  value={lockIdleTimeoutSec}
                  onChange={event => setLockIdleTimeoutSec(Number(event.target.value))}
                  className="input-base"
                >
                  {IDLE_TIMEOUT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {lockSettingsError && (
                <p className="text-xs text-red-600">{lockSettingsError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeLockSettings} className="btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {categoryDialogMode && (
        <div className="modal-overlay" onClick={closeCategoryDialog}>
          <div
            className="modal-content max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {categoryDialogTitle}
              </h3>
              <button
                type="button"
                onClick={closeCategoryDialog}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitCategoryDialog} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  分类名称
                </label>
                <input
                  type="text"
                  autoFocus
                  value={categoryInput}
                  onChange={handleCategoryInputChange}
                  className="input-base"
                  placeholder="请输入分类名称"
                />
                {categoryDialogError && (
                  <p className="mt-1.5 text-xs text-red-600">{categoryDialogError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeCategoryDialog} className="btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {categoryDialogSubmitText}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
