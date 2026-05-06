import type { VaultService } from '@mypassword/shared-core';
import { importOnePasswordEntriesThroughCore } from '../onepassword-core-import';
import type { OnePasswordEntry } from '../onepassword-importer';

function createService(overrides: Partial<VaultService> = {}): VaultService {
  return {
    initialize: jest.fn(),
    getLockState: jest.fn(),
    setLockPassword: jest.fn(),
    updateLockConfig: jest.fn(),
    lockNow: jest.fn(),
    unlock: jest.fn(),
    listSummaries: jest.fn().mockResolvedValue([]),
    searchSummaries: jest.fn(),
    getPlaintextPassword: jest.fn(),
    createEntry: jest.fn().mockResolvedValue('new-id'),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    listCategories: jest.fn(),
    addCategory: jest.fn(),
    renameCategory: jest.fn(),
    deleteCategory: jest.fn(),
    exportVault: jest.fn(),
    importVault: jest.fn(),
    ...overrides,
  } as unknown as VaultService;
}

describe('1Password core import orchestration', () => {
  test('imports 1Password entries through vault service createEntry', async () => {
    const service = createService();
    const entries: OnePasswordEntry[] = [{
      title: 'GitHub',
      username: 'dev@example.com',
      password: 'gh-secret',
      url: 'https://github.com',
      notes: 'dev account',
      tags: 'work,git',
      category: 'Imported',
    }];

    await expect(importOnePasswordEntriesThroughCore(service, entries)).resolves.toEqual({
      imported: 1,
      skipped: 0,
      updated: 0,
    });

    expect(service.createEntry).toHaveBeenCalledWith({
      title: 'GitHub',
      username: 'dev@example.com',
      plaintextPassword: 'gh-secret',
      url: 'https://github.com',
      notes: 'dev account',
      tags: 'work,git',
      category: 'Imported',
    });
  });

  test('skips duplicate 1Password entries by username and title/url', async () => {
    const service = createService({
      listSummaries: jest.fn().mockResolvedValue([
        {
          id: '1',
          title: 'GitHub',
          username: 'dev@example.com',
          url: 'https://github.com',
          urls: ['https://github.com'],
        },
      ]),
    });
    const entries: OnePasswordEntry[] = [{
      title: 'GitHub',
      username: 'dev@example.com',
      password: 'gh-secret',
      url: 'https://github.com',
    }];

    await expect(importOnePasswordEntriesThroughCore(service, entries)).resolves.toEqual({
      imported: 0,
      skipped: 1,
      updated: 0,
    });

    expect(service.createEntry).not.toHaveBeenCalled();
  });
});
