import { registerBackupSettingsHandlers } from '../backup-settings';

describe('backup directory picker handler', () => {
  test('returns selected backup directory path', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMainLike = {
      handle: jest.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      }),
    };

    registerBackupSettingsHandlers({
      ipcMainLike,
      getSetting: () => null,
      setSetting: jest.fn(),
      chooseDirectory: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['C:/vault-backups'] }),
    });

    const pickHandler = handlers.get('backup-settings-pick-directory');
    expect(pickHandler).toBeDefined();
    await expect(pickHandler?.({})).resolves.toEqual({
      canceled: false,
      directory: 'C:/vault-backups',
    });
  });
});
