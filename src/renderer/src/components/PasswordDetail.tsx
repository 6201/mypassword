import React, { useEffect, useState } from 'react';

interface PasswordRecord {
  id: number;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  updatedAt?: number;
  favorite?: boolean;
}

interface Props {
  password: PasswordRecord | null;
  onEdit: (password: PasswordRecord) => void;
  onDelete: (id: number) => void;
}

type CopiedField = 'username' | 'password' | null;

const PasswordDetail: React.FC<Props> = ({ password, onEdit, onDelete }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<CopiedField>(null);

  useEffect(() => {
    setShowPassword(false);
    setCopiedField(null);
  }, [password?.id]);

  const copyText = async (text: string, field: CopiedField): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      navigator.clipboard.writeText('');
      setCopiedField(current => (current === field ? null : current));
    }, 30000);
  };

  if (!password) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-gray-400">
        请选择左侧条目查看详情
      </div>
    );
  }

  const tagList = (password.tags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

  const updatedAtValue = password.updatedAt
    ? (password.updatedAt > 1_000_000_000_000 ? password.updatedAt : password.updatedAt * 1000)
    : null;

  const updatedAtLabel = updatedAtValue
    ? new Date(updatedAtValue).toLocaleString('zh-CN', { hour12: false })
    : '';

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 scrollbar-thin">
      <div className="card min-w-0 p-5">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-gray-900">
              <span className="truncate">{password.title}</span>
              {Boolean(password.favorite) && (
                <svg className="h-4 w-4 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{password.username}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(password)}
              className="btn-secondary"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => onDelete(password.id)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              删除
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-2">
            <span className="text-xs text-gray-400">账号:</span>
            <span className="truncate rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700">{password.username}</span>
            <button
              type="button"
              onClick={() => copyText(password.username, 'username')}
              className="shrink-0 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100"
            >
              {copiedField === 'username' ? '已复制' : '复制账号'}
            </button>
          </div>

          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto_auto] items-center gap-2">
            <span className="text-xs text-gray-400">密码:</span>
            <span className="truncate rounded-md bg-gray-100 px-3 py-1.5 font-mono text-sm text-gray-700">
              {showPassword ? password.password : '••••••••••••'}
            </span>
            <button
              type="button"
              onClick={() => setShowPassword(current => !current)}
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => copyText(password.password, 'password')}
              className="shrink-0 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100"
            >
              {copiedField === 'password' ? '已复制' : '复制密码'}
            </button>
          </div>

          {password.url && (
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-xs text-gray-400">网址:</span>
              <a
                href={password.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-primary-600 hover:text-primary-700 hover:underline"
              >
                {password.url}
              </a>
            </div>
          )}

          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2">
            <span className="pt-1 text-xs text-gray-400">分类:</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                {password.category || 'Default'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2">
            <span className="pt-1 text-xs text-gray-400">标签:</span>
            <div className="flex flex-wrap items-center gap-2">
              {tagList.length > 0 ? (
                tagList.map(tag => (
                  <span key={tag} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-600">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">无</span>
              )}
            </div>
          </div>

          {updatedAtLabel && (
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2">
              <span className="pt-1 text-xs text-gray-400">最后修改时间:</span>
              <span className="text-sm text-gray-700">{updatedAtLabel}</span>
            </div>
          )}

          {password.notes && (
            <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-2">
              <span className="pt-1 text-xs text-gray-400">备注:</span>
              <p className="whitespace-pre-wrap break-words rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                {password.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordDetail;
