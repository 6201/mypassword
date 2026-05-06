const mockApp = {
  whenReady: jest.fn(() => new Promise<void>(() => {})),
  on: jest.fn(),
  quit: jest.fn(),
  getPath: jest.fn(() => process.cwd()),
  requestSingleInstanceLock: jest.fn(() => true),
};

const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
};

jest.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    webContents: { send: jest.fn(), on: jest.fn(), openDevTools: jest.fn() },
    on: jest.fn(),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    focus: jest.fn(),
  })),
  Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
  dialog: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
  },
  ipcMain: mockIpcMain,
  safeStorage: { isEncryptionAvailable: jest.fn(() => false) },
}));

jest.mock('../diagnostics', () => ({
  registerDiagnosticIpcHandlers: jest.fn(),
}));

jest.mock('../backup-settings', () => ({
  registerBackupSettingsHandlers: jest.fn(),
}));

jest.mock('../backup-scheduler-config', () => ({
  configurePeriodicBackupScheduler: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('../onepassword-import-handler', () => ({
  registerOnePasswordImportHandler: jest.fn(),
}));

jest.mock('../database', () => ({
  initDatabase: jest.fn(),
  Database: class Database {},
}));

jest.mock('../onepassword-importer', () => ({
  parseOnePasswordCSV: jest.fn(),
  parseOnePassword1PIF: jest.fn(),
  parseOnePassword1PUX: jest.fn(),
}));

jest.mock('../crypto', () => ({
  generateSalt: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('../../shared/desktop-adapter-map', () => ({
  DesktopKeyStoreAdapter: class DesktopKeyStoreAdapter {},
  DesktopCryptoAdapter: class DesktopCryptoAdapter {},
  DesktopStorageAdapter: class DesktopStorageAdapter {},
  LOCK_SECRET_DIGEST_KEY: 'lock-secret-digest',
  DEVICE_KEY_UNAVAILABLE_ERROR: 'DEVICE_KEY_UNAVAILABLE_ERROR',
  computeLockSecretDigest: jest.fn(),
}));

jest.mock('@mypassword/shared-core', () => ({
  classifyLockError: jest.fn(),
  createVaultService: jest.fn(),
}));

describe('runExportDataFlow', () => {
  async function loadRunExportDataFlow() {
    const mainModule = await import('../index');
    const runExportDataFlow = (mainModule as { runExportDataFlow?: unknown }).runExportDataFlow;
    expect(runExportDataFlow).toBeDefined();
    return runExportDataFlow as (typeof import('../index'))['runExportDataFlow'];
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns canceled without repairing, exporting, or writing when save dialog is canceled', async () => {
    const runExportDataFlow = await loadRunExportDataFlow();
    const exportVault = jest.fn(async () => new Uint8Array([1, 2, 3]));
    const reclassifyDecryptFailingDefaultEntries = jest.fn(() => 1);
    const showSaveDialog = jest.fn(async () => ({
      canceled: true,
    }));
    const writeFile = jest.fn();
    const getEntryCount = jest.fn(() => 12);

    const result = await runExportDataFlow('export-pass', {
      exportVault,
      reclassifyDecryptFailingDefaultEntries,
      showSaveDialog,
      writeFile,
      getEntryCount,
    });

    expect(showSaveDialog).toHaveBeenCalledTimes(1);
    expect(reclassifyDecryptFailingDefaultEntries).not.toHaveBeenCalled();
    expect(exportVault).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(getEntryCount).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      canceled: true,
    });
  });

  test('reclassifies broken Default entries to Error before export and still writes the file', async () => {
    const runExportDataFlow = await loadRunExportDataFlow();
    const events: string[] = [];
    const exportVault = jest.fn(async (password: string) => {
      events.push(`export:${password}`);
      return new Uint8Array([1, 2, 3]);
    });
    const reclassifyDecryptFailingDefaultEntries = jest.fn((targetCategory: string) => {
      events.push(`repair:${targetCategory}`);
      return 1;
    });
    const showSaveDialog = jest.fn(async () => {
      events.push('dialog');
      return {
        canceled: false,
        filePath: 'backup.enc',
      };
    });
    const writeFile = jest.fn((filePath: string, data: Uint8Array) => {
      events.push(`write:${filePath}:${Array.from(data).join(',')}`);
    });
    const getEntryCount = jest.fn(() => 12);

    const result = await runExportDataFlow('export-pass', {
      exportVault,
      reclassifyDecryptFailingDefaultEntries,
      showSaveDialog,
      writeFile,
      getEntryCount,
    });

    expect(reclassifyDecryptFailingDefaultEntries).toHaveBeenCalledWith('Error');
    expect(exportVault).toHaveBeenCalledWith('export-pass');
    expect(events).toEqual([
      'dialog',
      'repair:Error',
      'export:export-pass',
      'write:backup.enc:1,2,3',
    ]);
    expect(writeFile).toHaveBeenCalledWith('backup.enc', new Uint8Array([1, 2, 3]));
    expect(result).toEqual({
      success: true,
      filePath: 'backup.enc',
      count: 12,
    });
  });

  test('still exports normally when the repair moves zero entries', async () => {
    const runExportDataFlow = await loadRunExportDataFlow();
    const exportVault = jest.fn(async () => new Uint8Array([4, 5, 6]));
    const reclassifyDecryptFailingDefaultEntries = jest.fn(() => 0);
    const showSaveDialog = jest.fn(async () => ({
      canceled: false,
      filePath: 'backup.enc',
    }));
    const writeFile = jest.fn();
    const getEntryCount = jest.fn(() => 7);

    const result = await runExportDataFlow('export-pass', {
      exportVault,
      reclassifyDecryptFailingDefaultEntries,
      showSaveDialog,
      writeFile,
      getEntryCount,
    });

    expect(reclassifyDecryptFailingDefaultEntries).toHaveBeenCalledWith('Error');
    expect(exportVault).toHaveBeenCalledWith('export-pass');
    expect(writeFile).toHaveBeenCalledWith('backup.enc', new Uint8Array([4, 5, 6]));
    expect(result).toEqual({
      success: true,
      filePath: 'backup.enc',
      count: 7,
    });
  });
});
