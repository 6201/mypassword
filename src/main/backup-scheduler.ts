import fs from 'fs';
import path from 'path';

export interface PeriodicBackupConfig {
  enabled: boolean;
  intervalMs: number;
  directory: string;
  password: string;
  retentionCount?: number;
}

export interface PeriodicBackupSchedulerDeps {
  exportVault(password: string): Promise<Uint8Array>;
  getConfig(): PeriodicBackupConfig;
  now?: () => Date;
}

export interface PeriodicBackupScheduler {
  start(): void;
  stop(): void;
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('-') + '-' + [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('-');
}

function cleanupOldBackups(directory: string, retentionCount?: number): void {
  if (!retentionCount || retentionCount <= 0) {
    return;
  }

  const backupFiles = (fs.readdirSync(directory) as string[])
    .filter(fileName => /^mypassword-backup-.*\.enc$/.test(fileName))
    .sort();

  const filesToRemove = backupFiles.slice(0, Math.max(0, backupFiles.length - retentionCount));
  for (const fileName of filesToRemove) {
    fs.rmSync(path.join(directory, fileName));
  }
}

export function createPeriodicBackupScheduler(deps: PeriodicBackupSchedulerDeps): PeriodicBackupScheduler {
  const now = deps.now ?? (() => new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  async function runBackup(): Promise<void> {
    const config = deps.getConfig();
    if (!config.enabled) {
      return;
    }

    const encryptedData = await deps.exportVault(config.password);
    fs.mkdirSync(config.directory, { recursive: true });
    const filePath = path.join(config.directory, `mypassword-backup-${formatTimestamp(now())}.enc`);
    fs.writeFileSync(filePath, Buffer.from(encryptedData));
    cleanupOldBackups(config.directory, config.retentionCount);
  }

  return {
    start() {
      const config = deps.getConfig();
      if (!config.enabled || config.intervalMs <= 0 || timer) {
        return;
      }
      timer = setInterval(() => {
        void runBackup();
      }, config.intervalMs);
    },
    stop() {
      if (!timer) {
        return;
      }
      clearInterval(timer);
      timer = null;
    },
  };
}
