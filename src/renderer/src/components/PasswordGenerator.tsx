import React, { useState } from 'react';

interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  requireEachType: boolean;
}

interface Props {
  onClose: () => void;
  onUsePassword?: (password: string) => void;
}

const PasswordGenerator: React.FC<Props> = ({ onClose, onUsePassword }) => {
  const [options, setOptions] = useState<GeneratorOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
    requireEachType: true
  });

  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [strength, setStrength] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);

  const generate = async () => {
    const password = await window.electronAPI.generatePassword(options);
    setGeneratedPassword(password);
    setStrength(calculateStrength(password));
    setIsCopied(false);
  };

  const calculateStrength = (password: string): number => {
    let score = 0;
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 20;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[a-z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^A-Za-z0-9]/.test(password)) score += 10;
    return Math.min(score, 100);
  };

  const copyToClipboard = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      setIsCopied(true);
      setTimeout(() => {
        navigator.clipboard.writeText('');
        setIsCopied(false);
      }, 30000);
    }
  };

  const getStrengthInfo = () => {
    if (strength < 40) return { color: 'bg-red-500', text: '弱', textColor: 'text-red-600' };
    if (strength < 70) return { color: 'bg-amber-500', text: '中', textColor: 'text-amber-600' };
    return { color: 'bg-emerald-500', text: '强', textColor: 'text-emerald-600' };
  };

  const strengthInfo = getStrengthInfo();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            密码生成器
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

        <div className="p-6 space-y-6">
          {/* 密码长度滑块 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">密码长度</label>
              <span className="px-2.5 py-1 text-sm font-semibold text-primary-600 bg-primary-50 rounded-lg">
                {options.length}
              </span>
            </div>
            <input
              type="range"
              min="4"
              max="64"
              value={options.length}
              onChange={e => setOptions({ ...options, length: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>4</span>
              <span>64</span>
            </div>
          </div>

          {/* 选项网格 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={options.uppercase}
                onChange={e => setOptions({ ...options, uppercase: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">大写字母 (A-Z)</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={options.lowercase}
                onChange={e => setOptions({ ...options, lowercase: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">小写字母 (a-z)</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={options.numbers}
                onChange={e => setOptions({ ...options, numbers: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">数字 (0-9)</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={options.symbols}
                onChange={e => setOptions({ ...options, symbols: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">特殊字符</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={options.excludeAmbiguous}
                onChange={e => setOptions({ ...options, excludeAmbiguous: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">排除模糊字符</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={options.requireEachType}
                onChange={e => setOptions({ ...options, requireEachType: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">每类至少一个</span>
            </label>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={generate}
            className="btn-primary w-full py-3 text-base font-semibold justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            生成密码
          </button>

          {/* 生成结果 */}
          {generatedPassword && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 font-mono text-lg text-gray-900 bg-white px-4 py-2.5 rounded-lg border border-gray-200 break-all">
                  {generatedPassword}
                </code>
                <button
                  onClick={copyToClipboard}
                  className={`
                    px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap
                    transition-all duration-200
                    ${
                      isCopied
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }
                  `}
                >
                  {isCopied ? '已复制' : '复制'}
                </button>
                {onUsePassword && (
                  <button
                    onClick={() => {
                      onUsePassword(generatedPassword);
                      onClose();
                    }}
                    className="btn-secondary px-4 py-2.5 whitespace-nowrap"
                  >
                    使用此密码
                  </button>
                )}
              </div>

              {/* 强度指示 */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">强度:</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strengthInfo.color} transition-all duration-300`}
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${strengthInfo.textColor}`}>
                  {strengthInfo.text}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordGenerator;
