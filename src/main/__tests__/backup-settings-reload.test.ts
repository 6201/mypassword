import { registerBackupSettingsHandlers } from '../backup-settings';

describe('backup settings scheduler reload', () => {
  test('reloads periodic backup scheduler after saving settings', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMainLike = {
      handle: jest.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      }),
    };
    const reloadScheduler = jest.fn();

    registerBackupSettingsHandlers({
      ipcMainLike,
      getSetting: () => null,
      setSetting: jest.fn(),
      reloadScheduler,
    });

    const setHandler = handlers.get('backup-settings-set');
    expect(setHandler).toBeDefined();

    await setHandler?.({}, {
      enabled: true,
      intervalMs: 300000,
      directory: 'C:/vault-backups',
      password: 'backup-pass',
      retentionCount: 4,
    });

    expect(reloadScheduler).toHaveBeenCalledTimes(1);
  });
});
