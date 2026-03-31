import { generatePassword, calculatePasswordStrength } from '../password-generator';

describe('PasswordGenerator', () => {
  describe('generatePassword', () => {
    test('生成默认长度的密码', () => {
      const password = generatePassword();
      expect(password).toHaveLength(16);
    });

    test('生成指定长度的密码', () => {
      const password = generatePassword({ length: 20 });
      expect(password).toHaveLength(20);
    });

    test('生成包含大写字母的密码', () => {
      const password = generatePassword({
        length: 20,
        uppercase: true,
        lowercase: false,
        numbers: false,
        symbols: false,
        requireEachType: false
      });
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    test('生成包含小写字母的密码', () => {
      const password = generatePassword({
        length: 20,
        uppercase: false,
        lowercase: true,
        numbers: false,
        symbols: false,
        requireEachType: false
      });
      expect(/[a-z]/.test(password)).toBe(true);
    });

    test('生成包含数字的密码', () => {
      const password = generatePassword({
        length: 20,
        uppercase: false,
        lowercase: false,
        numbers: true,
        symbols: false,
        requireEachType: false
      });
      expect(/[0-9]/.test(password)).toBe(true);
    });

    test('生成包含特殊字符的密码', () => {
      const password = generatePassword({
        length: 20,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: true,
        requireEachType: false
      });
      expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
    });

    test('排除模糊字符', () => {
      const password = generatePassword({
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: false,
        excludeAmbiguous: true,
        requireEachType: false
      });
      expect(/[0Ool1I]/.test(password)).toBe(false);
    });

    test('必须包含每类字符', () => {
      const password = generatePassword({
        length: 12,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        requireEachType: true
      });
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
    });

    test('密码长度太短时报错', () => {
      expect(() => {
        generatePassword({
          length: 2,
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true,
          requireEachType: true
        });
      }).toThrow('密码长度太短');
    });

    test('未选择任何字符类型时报错', () => {
      expect(() => {
        generatePassword({
          length: 10,
          uppercase: false,
          lowercase: false,
          numbers: false,
          symbols: false,
          requireEachType: false
        });
      }).toThrow('至少需要选择一种字符类型');
    });

    test('生成随机性密码', () => {
      const passwords = new Set();
      for (let i = 0; i < 10; i++) {
        passwords.add(generatePassword());
      }
      // 10 次生成应该至少有不同的密码
      expect(passwords.size).toBeGreaterThan(1);
    });
  });

  describe('calculatePasswordStrength', () => {
    test('弱密码评分', () => {
      const strength = calculatePasswordStrength('abc');
      expect(strength).toBeLessThan(40);
    });

    test('中等密码评分', () => {
      const strength = calculatePasswordStrength('abcdef1234');
      expect(strength).toBeGreaterThanOrEqual(40);
      expect(strength).toBeLessThan(70);
    });

    test('强密码评分', () => {
      const strength = calculatePasswordStrength('Abcdef1234!@#');
      expect(strength).toBeGreaterThanOrEqual(70);
    });

    test('长度评分', () => {
      expect(calculatePasswordStrength('12345678')).toBeGreaterThanOrEqual(20);
      expect(calculatePasswordStrength('123456789012')).toBeGreaterThanOrEqual(40);
      expect(calculatePasswordStrength('1234567890123456')).toBeGreaterThanOrEqual(60);
    });

    test('复杂度评分 - 大写字母', () => {
      const base = calculatePasswordStrength('12345678');
      const withUpper = calculatePasswordStrength('A2345678');
      expect(withUpper).toBeGreaterThan(base);
    });

    test('复杂度评分 - 特殊字符', () => {
      const base = calculatePasswordStrength('Aa123456');
      const withSymbol = calculatePasswordStrength('Aa12345!');
      expect(withSymbol).toBeGreaterThan(base);
    });
  });
});
