import { buildBackupSettingsFormState, validateBackupSettingsForm } from '../backup-settings-ui';

describe('backup settings UI helpers', () => {
  test('builds form state from persisted backup settings', () => {
    expect(buildBackupSettingsFormState({
      enabled: true,
      intervalMs: 300000,
      directory: 'C:/backups',
      password: 'backup-pass',
      retentionCount: 5,
    })).toEqual({
      enabled: true,
      intervalMs: 300000,
      directory: 'C:/backups',
      password: 'backup-pass',
      confirmPassword: 'backup-pass',
      retentionCount: 5,
    });
  });

  test('requires matching backup passwords before save', () => {
    expect(validateBackupSettingsForm({
      enabled: true,
      intervalMs: 300000,
      directory: 'C:/backups',
      password: 'backup-pass',
      confirmPassword: 'different-pass',
      retentionCount: 5,
    })).toBe('两次输入的备份密码不一致');
  });
});
