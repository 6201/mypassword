const exposeInMainWorld = jest.fn();
const invoke = jest.fn();

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld,
  },
  ipcRenderer: {
    invoke,
  },
}));

export {};

describe('preload backup settings bridge', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear();
    invoke.mockClear();
    jest.resetModules();
  });

  test('exposes backup settings get/set through electronAPI', async () => {
    await import('../preload');

    const api = exposeInMainWorld.mock.calls[0][1] as {
      getBackupSettings: () => Promise<unknown>;
      setBackupSettings: (payload: unknown) => Promise<unknown>;
    };

    await api.getBackupSettings();
    await api.setBackupSettings({ enabled: true });

    expect(invoke).toHaveBeenCalledWith('backup-settings-get');
    expect(invoke).toHaveBeenCalledWith('backup-settings-set', { enabled: true });
  });
});
