import { generateSalt, hashPassword, verifyPassword } from '../crypto';

interface LockSettings {
  passwordHash: string | null;
  passwordSalt: string | null;
  autoEnabled: boolean;
  idleTimeoutSec: number;
}

const DEFAULT_IDLE_TIMEOUT_SEC = 300;
const MIN_IDLE_TIMEOUT_SEC = 60;
const MAX_IDLE_TIMEOUT_SEC = 3600;

function createDefaultLockSettings(): LockSettings {
  return {
    passwordHash: null,
    passwordSalt: null,
    autoEnabled: false,
    idleTimeoutSec: DEFAULT_IDLE_TIMEOUT_SEC
  };
}

function validatePassword(password: string): string {
  if (!password || !password.trim()) {
    throw new Error('锁屏密码不能为空');
  }
  return password;
}

function applyLockPassword(settings: LockSettings, password: string): LockSettings {
  const nextPassword = validatePassword(password);
  const salt = generateSalt();
  return {
    ...settings,
    passwordSalt: salt.toString('hex'),
    passwordHash: hashPassword(nextPassword, salt)
  };
}

function verifyLockPassword(settings: LockSettings, password: string): boolean {
  if (!settings.passwordHash || !settings.passwordSalt) {
    return false;
  }
  return verifyPassword(password, Buffer.from(settings.passwordSalt, 'hex'), settings.passwordHash);
}

function normalizeIdleTimeoutSec(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_IDLE_TIMEOUT_SEC;
  }

  const integerValue = Math.floor(value);
  if (integerValue < MIN_IDLE_TIMEOUT_SEC) {
    return MIN_IDLE_TIMEOUT_SEC;
  }
  if (integerValue > MAX_IDLE_TIMEOUT_SEC) {
    return MAX_IDLE_TIMEOUT_SEC;
  }

  return integerValue;
}

describe('Lock logic', () => {
  test('首次设置锁屏密码后可以正确验证', () => {
    let settings = createDefaultLockSettings();

    settings = applyLockPassword(settings, 'my-lock-pass');

    expect(settings.passwordHash).toBeTruthy();
    expect(settings.passwordSalt).toBeTruthy();
    expect(verifyLockPassword(settings, 'my-lock-pass')).toBe(true);
    expect(verifyLockPassword(settings, 'wrong-pass')).toBe(false);
  });

  test('修改锁屏密码前必须验证旧密码', () => {
    let settings = createDefaultLockSettings();

    settings = applyLockPassword(settings, 'old-pass');

    const canChangeWithWrongCurrent = verifyLockPassword(settings, 'bad-current');
    const canChangeWithCorrectCurrent = verifyLockPassword(settings, 'old-pass');

    expect(canChangeWithWrongCurrent).toBe(false);
    expect(canChangeWithCorrectCurrent).toBe(true);

    if (canChangeWithCorrectCurrent) {
      settings = applyLockPassword(settings, 'new-pass');
    }

    expect(verifyLockPassword(settings, 'new-pass')).toBe(true);
    expect(verifyLockPassword(settings, 'old-pass')).toBe(false);
  });

  test('未设置密码时不能通过验证', () => {
    const settings = createDefaultLockSettings();

    expect(verifyLockPassword(settings, 'any-pass')).toBe(false);
  });

  test('空闲超时限制在 60~3600 秒', () => {
    expect(normalizeIdleTimeoutSec(10)).toBe(60);
    expect(normalizeIdleTimeoutSec(65.9)).toBe(65);
    expect(normalizeIdleTimeoutSec(5000)).toBe(3600);
    expect(normalizeIdleTimeoutSec(Number.NaN)).toBe(300);
  });
});
