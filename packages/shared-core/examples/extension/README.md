# Extension Bootstrap Templates

These files are wiring templates for a new `myPassword-extension` project.

## Files

- `background.template.ts`
  - Initializes shared-core adapters.
  - Exposes minimal `vault.unlock`, `vault.status`, and `vault.create-entry` message handlers.
- `content-fill.template.ts`
  - Implements controlled username/password filling for common login forms.
- `save-suggestion.template.ts`
  - Watches form submit and emits `vault.suggest-save` payloads.

## Integration Steps

1. Copy templates into the extension project `src/`.
2. Replace temporary wrapping-key generation in `background.template.ts` with persistent secure key bootstrap.
3. Connect `vault.suggest-save` to a review UI (popup or side panel) before writing entries.
4. Add site-allowlist checks before calling fill helpers on pages.

## Notes

- Templates intentionally keep behavior minimal and explicit.
- They are designed to be paired with `@mypassword/shared-core` adapters, not to replace full vault-service orchestration.
