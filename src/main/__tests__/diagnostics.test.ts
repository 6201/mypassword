import DatabaseLib from 'better-sqlite3';
import { Database } from '../database';
import { registerDiagnosticIpcHandlers } from '../diagnostics';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => process.cwd())
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => false)
  }
}));

describe('diagnostic IPC handlers', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(new DatabaseLib(':memory:'));
  });

  afterEach(() => {
    db.close();
  });

  test('registers a read-only decrypt failure scanner handler', async () => {
    const healthyId = db.addPassword({
      title: 'Healthy Entry',
      username: 'healthy@example.com',
      password: 'healthy-secret',
    });
    const brokenId = db.addPassword({
      title: 'Broken Entry',
      username: 'broken@example.com',
      password: 'broken-secret',
    });
    db.updatePasswordCiphertext(brokenId, {
      password: 'enc:v1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });

    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMainLike = {
      handle: jest.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      }),
    };

    registerDiagnosticIpcHandlers(ipcMainLike, () => db);

    expect(ipcMainLike.handle).toHaveBeenCalledWith(
      'diagnostics:scan-password-decrypt-failures',
      expect.any(Function)
    );

    const handler = handlers.get('diagnostics:scan-password-decrypt-failures');
    expect(handler).toBeDefined();

    await expect(handler?.({})).resolves.toEqual({
      totalEntries: 2,
      failingEntryIds: [String(brokenId)],
    });
    expect(db.getPasswordSecret(healthyId)).toBe('healthy-secret');
  });
});
