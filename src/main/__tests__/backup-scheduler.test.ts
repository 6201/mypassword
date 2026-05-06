import fs from 'fs';
import path from 'path';
import { createPeriodicBackupScheduler } from '../backup-scheduler';

describe('periodic backup scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as never);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('writes an encrypted backup file on each scheduled tick', async () => {
    const exportVault = jest.fn<Promise<Uint8Array>, [string]>().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const scheduler = createPeriodicBackupScheduler({
      exportVault,
      getConfig: () => ({
        enabled: true,
        intervalMs: 60_000,
        directory: 'C:/backups',
        password: 'backup-pass',
      }),
      now: () => new Date('2026-05-06T08:09:10.000Z'),
    });

    scheduler.start();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(exportVault).toHaveBeenCalledWith('backup-pass');
    expect(fs.mkdirSync).toHaveBeenCalledWith('C:/backups', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('C:/backups', 'mypassword-backup-2026-05-06-08-09-10.enc'),
      Buffer.from([1, 2, 3])
    );
  });

  test('removes older backup files beyond retention count after writing a new backup', async () => {
    const exportVault = jest.fn<Promise<Uint8Array>, [string]>().mockResolvedValue(new Uint8Array([1, 2, 3]));
    jest.spyOn(fs, 'readdirSync').mockReturnValue([
      'mypassword-backup-2026-05-06-08-00-00.enc',
      'mypassword-backup-2026-05-06-08-05-00.enc',
      'mypassword-backup-2026-05-06-08-09-10.enc',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    jest.spyOn(fs, 'rmSync').mockImplementation(() => undefined);

    const scheduler = createPeriodicBackupScheduler({
      exportVault,
      getConfig: () => ({
        enabled: true,
        intervalMs: 60_000,
        directory: 'C:/backups',
        password: 'backup-pass',
        retentionCount: 2,
      }),
      now: () => new Date('2026-05-06T08:09:10.000Z'),
    });

    scheduler.start();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(fs.rmSync).toHaveBeenCalledWith(
      path.join('C:/backups', 'mypassword-backup-2026-05-06-08-00-00.enc')
    );
  });
});
