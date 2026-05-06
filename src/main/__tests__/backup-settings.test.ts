import {
  PERIODIC_BACKUP_DIRECTORY_KEY,
  PERIODIC_BACKUP_ENABLED_KEY,
  PERIODIC_BACKUP_INTERVAL_MS_KEY,
  PERIODIC_BACKUP_PASSWORD_KEY,
  PERIODIC_BACKUP_RETENTION_COUNT_KEY,
  registerBackupSettingsHandlers,
} from '../backup-settings';

describe('backup settings handlers', () => {
  test('registers get and set handlers backed by settings storage', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMainLike = {
      handle: jest.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      }),
    };
    const values = new Map<string, string | null>([
      [PERIODIC_BACKUP_ENABLED_KEY, 'true'],
      [PERIODIC_BACKUP_INTERVAL_MS_KEY, '60000'],
      [PERIODIC_BACKUP_DIRECTORY_KEY, 'C:/backups'],
      [PERIODIC_BACKUP_PASSWORD_KEY, 'backup-pass'],
      [PERIODIC_BACKUP_RETENTION_COUNT_KEY, '5'],
    ]);
    const getSetting = jest.fn((key: string) => values.get(key) ?? null);
    const setSetting = jest.fn((key: string, value: string | null) => {
      values.set(key, value);
    });

    registerBackupSettingsHandlers({
      ipcMainLike,
      getSetting,
      setSetting,
    });

    const getHandler = handlers.get('backup-settings-get');
    const setHandler = handlers.get('backup-settings-set');
    expect(getHandler).toBeDefined();
    expect(setHandler).toBeDefined();

    await expect(getHandler?.({})).resolves.toEqual({
      enabled: true,
      intervalMs: 60000,
      directory: 'C:/backups',
      password: 'backup-pass',
      retentionCount: 5,
    });

    await expect(setHandler?.({}, {
      enabled: false,
      intervalMs: 300000,
      directory: 'D:/vault-backups',
      password: 'next-pass',
      retentionCount: 3,
    })).resolves.toEqual({
      enabled: false,
      intervalMs: 300000,
      directory: 'D:/vault-backups',
      password: 'next-pass',
      retentionCount: 3,
    });

    expect(setSetting).toHaveBeenCalledWith(PERIODIC_BACKUP_ENABLED_KEY, 'false');
    expect(setSetting).toHaveBeenCalledWith(PERIODIC_BACKUP_INTERVAL_MS_KEY, '300000');
    expect(setSetting).toHaveBeenCalledWith(PERIODIC_BACKUP_DIRECTORY_KEY, 'D:/vault-backups');
    expect(setSetting).toHaveBeenCalledWith(PERIODIC_BACKUP_PASSWORD_KEY, 'next-pass');
    expect(setSetting).toHaveBeenCalledWith(PERIODIC_BACKUP_RETENTION_COUNT_KEY, '3');
  });
});
