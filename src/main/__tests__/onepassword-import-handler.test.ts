import { registerOnePasswordImportHandler } from '../onepassword-import-handler';
import type { OnePasswordEntry } from '../onepassword-importer';

describe('1Password import handler', () => {
  test('imports parsed CSV entries through vault service orchestration', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMainLike = {
      handle: jest.fn((channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener);
      }),
    };
    const listSummaries = jest.fn().mockResolvedValue([]);
    const createEntry = jest.fn().mockResolvedValue('created-id');
    const showOpenDialog = jest.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['C:/imports/sample.csv'],
    });
    const readFileSync = jest.fn().mockReturnValue('title,url,username,password\nGitHub,https://github.com,dev@example.com,gh-secret\n');
    const parseCsv = jest.fn<OnePasswordEntry[], [string]>().mockReturnValue([
      {
        title: 'GitHub',
        username: 'dev@example.com',
        password: 'gh-secret',
        url: 'https://github.com',
      },
    ]);

    registerOnePasswordImportHandler({
      ipcMainLike,
      ensureUnlocked: () => undefined,
      getVaultService: () => ({ listSummaries, createEntry }),
      showOpenDialog,
      readFileSync,
      parseOnePasswordCSV: parseCsv,
      parseOnePassword1PIF: jest.fn(),
      parseOnePassword1PUX: jest.fn(),
      getBasename: (value: string) => value.split('/').pop() || value,
      getExtension: () => '.csv',
    });

    const handler = handlers.get('import-from-1password');
    expect(handler).toBeDefined();

    await expect(handler?.({})).resolves.toEqual({
      success: true,
      imported: 1,
      skipped: 0,
      updated: 0,
      filename: 'sample.csv',
    });

    expect(parseCsv).toHaveBeenCalled();
    expect(createEntry).toHaveBeenCalledWith({
      title: 'GitHub',
      username: 'dev@example.com',
      plaintextPassword: 'gh-secret',
      url: 'https://github.com',
      notes: undefined,
      tags: undefined,
      category: undefined,
    });
  });
});
