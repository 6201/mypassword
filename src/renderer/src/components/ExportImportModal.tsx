import React, { useState } from 'react';

interface Props {
  onClose: () => void;
}

const ExportImportModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | '1password'>('export');

  const buildImportMessage = (result: { imported?: number; updated?: number; skipped?: number; filename: string }) => {
    const messages = [];
    if (result.imported && result.imported > 0) messages.push(`导入 ${result.imported} 条`);
    if (result.updated && result.updated > 0) messages.push(`更新 ${result.updated} 条`);
    if (result.skipped && result.skipped > 0) messages.push(`跳过 ${result.skipped} 条`);
    return `从 ${result.filename} 导入完成：${messages.join(', ')}`;
  };

  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);

  // Import state
  const [importPassword, setImportPassword] = useState('');
  const [mergeMode, setMergeMode] = useState<'skip' | 'overwrite' | 'rename'>('skip');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  // 1Password import state
  const [isOnePasswordImporting, setIsOnePasswordImporting] = useState(false);
  const [onePasswordResult, setOnePasswordResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleExport = async () => {
    if (!exportPassword) {
      setExportResult({ success: false, message: '请输入加密密码' });
      return;
    }
    if (exportPassword !== exportConfirm) {
      setExportResult({ success: false, message: '两次输入的密码不一致' });
      return;
    }
    if (exportPassword.length < 4) {
      setExportResult({ success: false, message: '加密密码至少 4 位' });
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      const result = await window.electronAPI.exportData(exportPassword);

      if (result.canceled) {
        setExportResult({ success: false, message: '已取消导出' });
      } else if (result.success) {
        setExportResult({
          success: true,
          message: `成功导出 ${result.count} 条密码到 ${result.filePath}`
        });
      } else {
        setExportResult({ success: false, message: result.error || '导出失败' });
      }
    } catch (error: any) {
      setExportResult({ success: false, message: error.message });
    }

    setIsExporting(false);
  };

  const handleImport = async () => {
    if (!importPassword) {
      setImportResult({ success: false, message: '请输入备份密码' });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await window.electronAPI.importData(importPassword, mergeMode);

      if (result.canceled) {
        setImportResult({ success: false, message: '已取消导入' });
      } else if (result.success) {
        setImportResult({
          success: true,
          message: buildImportMessage(result)
        });
        // 导入成功后刷新页面数据
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setImportResult({ success: false, message: result.error || '导入失败' });
      }
    } catch (error: any) {
      setImportResult({ success: false, message: error.message });
    }

    setIsImporting(false);
  };

  const handleOnePasswordImport = async () => {
    setIsOnePasswordImporting(true);
    setOnePasswordResult(null);

    try {
      const result = await window.electronAPI.importFrom1Password();

      if (result.canceled) {
        setOnePasswordResult({ success: false, message: '已取消导入' });
      } else if (result.success) {
        setOnePasswordResult({
          success: true,
          message: buildImportMessage(result)
        });
        // 导入成功后刷新页面数据
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setOnePasswordResult({ success: false, message: result.error || '导入失败' });
      }
    } catch (error: any) {
      setOnePasswordResult({ success: false, message: error.message });
    }

    setIsOnePasswordImporting(false);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: active ? 'var(--color-primary-600)' : '#4b5563',
    backgroundColor: active ? 'var(--color-primary-50)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-primary-500)' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 150ms ease'
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">数据备份与恢复</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 选项卡 */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => { setActiveTab('export'); setExportResult(null); setImportResult(null); setOnePasswordResult(null); }}
            style={tabStyle(activeTab === 'export')}
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              导出数据
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('import'); setExportResult(null); setImportResult(null); setOnePasswordResult(null); }}
            style={tabStyle(activeTab === 'import')}
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              导入数据
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('1password'); setExportResult(null); setImportResult(null); setOnePasswordResult(null); }}
            style={tabStyle(activeTab === '1password')}
          >
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              1Password 导入
            </span>
          </button>
        </div>

        {/* 导出面板 */}
        {activeTab === 'export' && (
          <div className="p-6 grid gap-5">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>注意：</strong>导出的文件包含您的所有密码数据（加密存储），请妥善保管。
                建议将备份文件存储到安全的位置（如加密的 U 盘或私有云盘）。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">加密密码</label>
              <input
                type="password"
                value={exportPassword}
                onChange={e => setExportPassword(e.target.value)}
                className="input-base"
                placeholder="设置一个密码来加密备份文件"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                此密码用于加密备份文件，导入时需要输入相同的密码
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">确认密码</label>
              <input
                type="password"
                value={exportConfirm}
                onChange={e => setExportConfirm(e.target.value)}
                className="input-base"
                placeholder="再次输入密码"
              />
            </div>

            {exportResult && (
              <div className={`px-4 py-3 rounded-lg text-sm border ${
                exportResult.success
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {exportResult.message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary">取消</button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="btn-primary"
                style={{ opacity: isExporting ? 0.7 : 1, cursor: isExporting ? 'not-allowed' : 'pointer' }}
              >
                {isExporting ? '导出中...' : '导出备份'}
              </button>
            </div>
          </div>
        )}

        {/* 导入面板 */}
        {activeTab === 'import' && (
          <div className="p-6 grid gap-5">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>注意：</strong>导入操作会将备份文件中的数据合并到当前数据库。
                如有重复条目，可选择跳过、覆盖或重命名。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">备份密码</label>
              <input
                type="password"
                value={importPassword}
                onChange={e => setImportPassword(e.target.value)}
                className="input-base"
                placeholder="输入创建备份时设置的密码"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">重复数据处理方式</label>
              <div className="grid gap-3">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                  mergeMode === 'skip' ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
                }`}>
                  <input
                    type="radio"
                    checked={mergeMode === 'skip'}
                    onChange={() => setMergeMode('skip')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>跳过重复</strong> - 如果条目已存在，跳过不导入
                  </span>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                  mergeMode === 'overwrite' ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
                }`}>
                  <input
                    type="radio"
                    checked={mergeMode === 'overwrite'}
                    onChange={() => setMergeMode('overwrite')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>覆盖重复</strong> - 用备份中的数据覆盖现有条目
                  </span>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                  mergeMode === 'rename' ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
                }`}>
                  <input
                    type="radio"
                    checked={mergeMode === 'rename'}
                    onChange={() => setMergeMode('rename')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>重命名</strong> - 为重复条目添加后缀后作为新条目导入
                  </span>
                </label>
              </div>
            </div>

            {importResult && (
              <div className={`px-4 py-3 rounded-lg text-sm border ${
                importResult.success
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {importResult.message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary">取消</button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="btn-primary"
                style={{ opacity: isImporting ? 0.7 : 1, cursor: isImporting ? 'not-allowed' : 'pointer' }}
              >
                {isImporting ? '导入中...' : '导入备份'}
              </button>
            </div>
          </div>
        )}

        {/* 1Password 导入面板 */}
        {activeTab === '1password' && (
          <div className="p-6 grid gap-5">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>支持的格式：</strong>
              </p>
              <ul className="text-sm text-blue-800 leading-relaxed mt-2 ml-4 list-disc">
                <li><strong>CSV 格式</strong> - 从 1Password 导出的 CSV 文件</li>
                <li><strong>1PIF 格式</strong> - 从 1Password 导出的 1PIF 文件</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                提示：在 1Password 中选择"文件 → 导出"来导出数据
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>注意：</strong>导入的重复条目将被跳过。如需更新现有条目，请先删除或手动编辑。
              </p>
            </div>

            {onePasswordResult && (
              <div className={`px-4 py-3 rounded-lg text-sm border ${
                onePasswordResult.success
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {onePasswordResult.message}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary">取消</button>
              <button
                onClick={handleOnePasswordImport}
                disabled={isOnePasswordImporting}
                className="btn-primary"
                style={{ opacity: isOnePasswordImporting ? 0.7 : 1, cursor: isOnePasswordImporting ? 'not-allowed' : 'pointer' }}
              >
                {isOnePasswordImporting ? '导入中...' : '选择文件并导入'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportImportModal;
