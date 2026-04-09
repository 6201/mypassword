# Mobile Bootstrap Templates

These files are wiring templates for a new `myPassword-mobile` project.

## Files

- `vault-runtime.template.ts`
  - Builds a minimal runtime (`unlock`, `listEntries`, `createEntry`, `status`) from shared-core adapters.
- `storage-provider.template.ts`
  - Wraps AsyncStorage/SQLite KV-like APIs into `AsyncKeyValueStorage`.
- `secure-key-provider.template.ts`
  - Provides a minimal secure key provider shape for keystore integration.

## Integration Steps

1. Copy templates into the mobile project.
2. Replace static secure key provider with iOS Keychain / Android Keystore-backed implementation.
3. Inject real storage provider (AsyncStorage/SQLite/MMKV) into `createMobileVaultRuntime`.
4. Map runtime errors to UI states (`LOCK_PASSWORD_REQUIRED`, `DEVICE_KEY_UNAVAILABLE`, `LOCK_REQUIRED`).

## Notes

- Templates are intentionally minimal and focused on runtime wiring.
- They are suitable for PoC validation before full screen-level integration.
