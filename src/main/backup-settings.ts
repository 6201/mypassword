export interface BackupSettings {
  enabled: boolean;
  intervalMs: number;
  directory: string;
  password: string;
  retentionCount: number;
}

export interface IpcMainLike {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

interface RegisterBackupSettingsHandlersDeps {
  ipcMainLike: IpcMainLike;
  getSetting(key: string): string | null;
  setSetting(key: string, value: string | null): void;
  chooseDirectory?: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  reloadScheduler?: () => void;
}

const DEFAULT_INTERVAL_MS = 300000;
const DEFAULT_RETENTION_COUNT = 5;

const PERIODIC_BACKUP_ENABLED_KEY = 'backup.periodic.enabled.v1';
const PERIODIC_BACKUP_INTERVAL_MS_KEY = 'backup.periodic.intervalMs.v1';
const PERIODIC_BACKUP_DIRECTORY_KEY = 'backup.periodic.directory.v1';
const PERIODIC_BACKUP_PASSWORD_KEY = 'backup.periodic.password.v1';
const PERIODIC_BACKUP_RETENTION_COUNT_KEY = 'backup.periodic.retentionCount.v1';

function readBackupSettings(getSetting: (key: string) => string | null): BackupSettings {
  return {
    enabled: getSetting(PERIODIC_BACKUP_ENABLED_KEY) === 'true',
    intervalMs: Number(getSetting(PERIODIC_BACKUP_INTERVAL_MS_KEY) || String(DEFAULT_INTERVAL_MS)),
    directory: getSetting(PERIODIC_BACKUP_DIRECTORY_KEY) || '',
    password: getSetting(PERIODIC_BACKUP_PASSWORD_KEY) || '',
    retentionCount: Number(getSetting(PERIODIC_BACKUP_RETENTION_COUNT_KEY) || String(DEFAULT_RETENTION_COUNT)),
  };
}

export function registerBackupSettingsHandlers(deps: RegisterBackupSettingsHandlersDeps): void {
  deps.ipcMainLike.handle('backup-settings-get', async () => {
    return readBackupSettings(deps.getSetting);
  });

  deps.ipcMainLike.handle('backup-settings-set', async (_: unknown, payload: unknown) => {
    const next: BackupSettings = {
      ...readBackupSettings(deps.getSetting),
      ...(payload as Partial<BackupSettings>),
    };

    deps.setSetting(PERIODIC_BACKUP_ENABLED_KEY, next.enabled ? 'true' : 'false');
    deps.setSetting(PERIODIC_BACKUP_INTERVAL_MS_KEY, String(next.intervalMs));
    deps.setSetting(PERIODIC_BACKUP_DIRECTORY_KEY, next.directory);
    deps.setSetting(PERIODIC_BACKUP_PASSWORD_KEY, next.password);
    deps.setSetting(PERIODIC_BACKUP_RETENTION_COUNT_KEY, String(next.retentionCount));
    deps.reloadScheduler?.();

    return next;
  });

  deps.ipcMainLike.handle('backup-settings-pick-directory', async () => {
    const result = await deps.chooseDirectory?.();
    if (!result || result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return {
      canceled: false,
      directory: result.filePaths[0],
    };
  });
}

export {
  PERIODIC_BACKUP_DIRECTORY_KEY,
  PERIODIC_BACKUP_ENABLED_KEY,
  PERIODIC_BACKUP_INTERVAL_MS_KEY,
  PERIODIC_BACKUP_PASSWORD_KEY,
  PERIODIC_BACKUP_RETENTION_COUNT_KEY,
};

