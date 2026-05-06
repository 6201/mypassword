import { configurePeriodicBackupScheduler } from '../backup-scheduler-config';

describe('periodic backup scheduler configuration', () => {
  test('starts scheduler with settings-backed config when periodic backup is enabled', () => {
    const start = jest.fn();
    const schedulerFactory = jest.fn().mockReturnValue({ start, stop: jest.fn() });
    const exportVault = jest.fn();

    configurePeriodicBackupScheduler({
      createScheduler: schedulerFactory,
      getVaultService: () => ({ exportVault }),
      getSetting: (key: string) => {
        if (key === 'backup.periodic.enabled.v1') return 'true';
        if (key === 'backup.periodic.intervalMs.v1') return '60000';
        if (key === 'backup.periodic.directory.v1') return 'C:/backups';
        if (key === 'backup.periodic.password.v1') return 'backup-pass';
        if (key === 'backup.periodic.retentionCount.v1') return '5';
        return null;
      },
    });

    expect(schedulerFactory).toHaveBeenCalledWith(expect.objectContaining({
      exportVault,
      getConfig: expect.any(Function),
    }));

    const deps = schedulerFactory.mock.calls[0][0];
    expect(deps.getConfig()).toEqual({
      enabled: true,
      intervalMs: 60000,
      directory: 'C:/backups',
      password: 'backup-pass',
      retentionCount: 5,
    });
    expect(start).toHaveBeenCalled();
  });
});
