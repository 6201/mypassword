import React, { useState, useEffect } from 'react';

interface PasswordEntry {
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string;
  favorite?: boolean;
}

interface Props {
  editData?: PasswordEntry;
  onClose: () => void;
  onSubmit: (entry: PasswordEntry) => Promise<void>;
}

const PasswordForm: React.FC<Props> = ({ editData, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<PasswordEntry>({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    category: 'Default',
    tags: '',
    favorite: false
  });

  useEffect(() => {
    if (editData) {
      setFormData(editData);
    }
  }, [editData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof PasswordEntry, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {editData ? '编辑密码' : '添加密码'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              required
              className="input-base"
              placeholder="例如：GitHub"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={e => handleChange('username', e.target.value)}
              required
              className="input-base"
              placeholder="例如：user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={e => handleChange('password', e.target.value)}
              required
              className="input-base font-mono"
              placeholder="输入密码"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              网址
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={e => handleChange('url', e.target.value)}
              className="input-base"
              placeholder="https://example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                分类
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                className="input-base"
                placeholder="例如：工作"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                标签
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={e => handleChange('tags', e.target.value)}
                className="input-base"
                placeholder="用逗号分隔"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              备注
            </label>
            <textarea
              value={formData.notes}
              onChange={e => handleChange('notes', e.target.value)}
              className="input-base min-h-[80px] resize-y"
              placeholder="添加备注信息..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="favorite"
              checked={formData.favorite}
              onChange={e => handleChange('favorite', e.target.checked)}
              className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="favorite" className="text-sm text-gray-700">
              收藏此项
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editData ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordForm;
