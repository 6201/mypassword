export interface BackupSettings {
  enabled: boolean;
  intervalMs: number;
  directory: string;
  password: string;
  retentionCount: number;
}

export interface BackupSettingsFormState extends BackupSettings {
  confirmPassword: string;
}

export function buildBackupSettingsFormState(settings: BackupSettings): BackupSettingsFormState {
  return {
    ...settings,
    confirmPassword: settings.password,
  };
}

export function validateBackupSettingsForm(form: BackupSettingsFormState): string | null {
  if (form.password !== form.confirmPassword) {
    return '两次输入的备份密码不一致';
  }
  if (form.enabled && !form.directory.trim()) {
    return '请输入备份目录';
  }
  if (form.enabled && !form.password.trim()) {
    return '请输入备份密码';
  }
  if (form.enabled && form.retentionCount < 1) {
    return '备份保留份数至少为 1';
  }
  return null;
}
