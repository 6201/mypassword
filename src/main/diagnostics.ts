import type { Database } from './database';

export interface IpcMainLike {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

export function registerDiagnosticIpcHandlers(
  ipcMainLike: IpcMainLike,
  getDatabase: () => Database
): void {
  ipcMainLike.handle('diagnostics:scan-password-decrypt-failures', async () => {
    return getDatabase().scanPasswordDecryptFailures();
  });
}
