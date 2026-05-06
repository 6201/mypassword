import { createPeriodicBackupScheduler, type PeriodicBackupScheduler, type PeriodicBackupSchedulerDeps } from './backup-scheduler';
import { PERIODIC_BACKUP_DIRECTORY_KEY, PERIODIC_BACKUP_ENABLED_KEY, PERIODIC_BACKUP_INTERVAL_MS_KEY, PERIODIC_BACKUP_PASSWORD_KEY, PERIODIC_BACKUP_RETENTION_COUNT_KEY } from './backup-settings';

interface ConfigurePeriodicBackupSchedulerDeps {
  createScheduler?: (deps: PeriodicBackupSchedulerDeps) => PeriodicBackupScheduler;
  getVaultService(): { exportVault(password: string): Promise<Uint8Array> };
  getSetting(key: string): string | null;
}

export function configurePeriodicBackupScheduler(deps: ConfigurePeriodicBackupSchedulerDeps): PeriodicBackupScheduler {
  const factory = deps.createScheduler ?? createPeriodicBackupScheduler;
  const vaultService = deps.getVaultService();
  const scheduler = factory({
    exportVault: vaultService.exportVault,
    getConfig: () => ({
      enabled: deps.getSetting(PERIODIC_BACKUP_ENABLED_KEY) === 'true',
      intervalMs: Number(deps.getSetting(PERIODIC_BACKUP_INTERVAL_MS_KEY) || '0'),
      directory: deps.getSetting(PERIODIC_BACKUP_DIRECTORY_KEY) || '',
      password: deps.getSetting(PERIODIC_BACKUP_PASSWORD_KEY) || '',
      retentionCount: Number(deps.getSetting(PERIODIC_BACKUP_RETENTION_COUNT_KEY) || '5'),
    }),
  });

  scheduler.start();
  return scheduler;
}
