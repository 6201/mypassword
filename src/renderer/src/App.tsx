import React, { useState, useEffect } from 'react';
import PasswordList from './components/PasswordList';
import PasswordForm from './components/PasswordForm';
import PasswordGenerator from './components/PasswordGenerator';
import SearchBar from './components/SearchBar';
import CategoryNav from './components/CategoryNav';
import ExportImportModal from './components/ExportImportModal';

declare global {
  interface Window {
    electronAPI: {
      getPasswords: () => Promise<any[]>;
      addPassword: (entry: any) => Promise<number>;
      updatePassword: (id: number, entry: any) => Promise<void>;
      deletePassword: (id: number) => Promise<void>;
      generatePassword: (options: any) => Promise<string>;
      searchPasswords: (query: string) => Promise<any[]>;
      exportData: (exportPassword: string) => Promise<any>;
      importData: (importPassword: string, mergeMode: 'skip' | 'overwrite' | 'rename') => Promise<any>;
    };
  }
}

const App: React.FC = () => {
  const [passwords, setPasswords] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    loadPasswords();
  }, []);

  const loadPasswords = async () => {
    const data = await window.electronAPI.getPasswords();
    setPasswords(data || []);
    const cats = ['All', ...Array.from(new Set((data || []).map((p: any) => p.category).filter(Boolean)))];
    setCategories(cats);
  };

  const handleAddPassword = async (entry: any) => {
    await window.electronAPI.addPassword(entry);
    setShowForm(false);
    loadPasswords();
  };

  const handleUpdatePassword = async (entry: any) => {
    if (editingId) {
      await window.electronAPI.updatePassword(editingId, entry);
      setEditingId(null);
      setShowForm(false);
      loadPasswords();
    }
  };

  const handleDeletePassword = async (id: number) => {
    if (confirm('确定要删除这个密码吗？')) {
      await window.electronAPI.deletePassword(id);
      loadPasswords();
    }
  };

  const handleEdit = (password: any) => {
    setEditingId(password.id);
    setShowForm(true);
  };

  const filteredPasswords = passwords.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <CategoryNav
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
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
    </div>
  );
};

export default App;
