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

describe('preload bridge', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear();
    invoke.mockClear();
    jest.resetModules();
  });

  test('exposes decrypt failure diagnostics through electronAPI', async () => {
    await import('../preload');

    expect(exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.objectContaining({
      scanPasswordDecryptFailures: expect.any(Function),
    }));

    const api = exposeInMainWorld.mock.calls[0][1] as {
      scanPasswordDecryptFailures: () => Promise<unknown>;
    };

    await api.scanPasswordDecryptFailures();

    expect(invoke).toHaveBeenCalledWith('diagnostics:scan-password-decrypt-failures');
  });
});
