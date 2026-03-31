/**
 * 密码生成选项
 */
export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  requireEachType: boolean;
}

const defaultOptions: PasswordGeneratorOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachType: true
};

const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
const numberChars = '0123456789';
const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

// 模糊字符映射
const ambiguousChars = new Set(['0', 'O', 'o', 'l', '1', 'I']);

/**
 * 从字符串中随机选择一个字符
 */
function getRandomChar(charSet: string): string {
  return charSet[Math.floor(Math.random() * charSet.length)];
}

/**
 * 洗牌数组（Fisher-Yates）
 */
function shuffleArray(array: string[]): string[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * 生成密码
 */
export function generatePassword(options: Partial<PasswordGeneratorOptions> = {}): string {
  const opts = { ...defaultOptions, ...options };

  // 构建字符集
  let charPool = '';
  const requiredChars: string[] = [];

  if (opts.uppercase) {
    let set = uppercaseChars;
    if (opts.excludeAmbiguous) {
      set = set.split('').filter(c => !ambiguousChars.has(c)).join('');
    }
    charPool += set;
    if (opts.requireEachType) {
      requiredChars.push(getRandomChar(set));
    }
  }

  if (opts.lowercase) {
    let set = lowercaseChars;
    if (opts.excludeAmbiguous) {
      set = set.split('').filter(c => !ambiguousChars.has(c)).join('');
    }
    charPool += set;
    if (opts.requireEachType) {
      requiredChars.push(getRandomChar(set));
    }
  }

  if (opts.numbers) {
    let set = numberChars;
    if (opts.excludeAmbiguous) {
      set = set.split('').filter(c => !ambiguousChars.has(c)).join('');
    }
    charPool += set;
    if (opts.requireEachType) {
      requiredChars.push(getRandomChar(set));
    }
  }

  if (opts.symbols) {
    charPool += symbolChars;
    if (opts.requireEachType) {
      requiredChars.push(getRandomChar(symbolChars));
    }
  }

  if (charPool.length === 0) {
    throw new Error('至少需要选择一种字符类型');
  }

  if (opts.length < requiredChars.length) {
    throw new Error('密码长度太短，无法满足所有要求');
  }

  // 生成剩余字符
  const remainingLength = opts.length - requiredChars.length;
  const result: string[] = [...requiredChars];

  for (let i = 0; i < remainingLength; i++) {
    result.push(getRandomChar(charPool));
  }

  // 洗牌
  return shuffleArray(result).join('');
}

/**
 * 计算密码强度
 */
export function calculatePasswordStrength(password: string): number {
  let score = 0;

  // 长度评分
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 20;

  // 复杂度评分
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  return Math.min(score, 100);
}
