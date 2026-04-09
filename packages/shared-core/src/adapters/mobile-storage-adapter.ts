import { ExtensionStorageAdapter } from './extension-storage-adapter';

// Mobile uses the same storage contract; runtime wiring injects a SQLite-backed JsonStorage implementation.
export class MobileStorageAdapter extends ExtensionStorageAdapter {}
