# T232 - RBAC audit-log surface (M.2 closeout)

Status: DONE
Phase: M.2

## Context

T246 (PR #99 on `main`) wired `AuditProducer.emit` into the RBAC admin
handlers (`roles.grant` / `roles.revoke`) and into the mission
scheduler (`Start` / `Complete` / `Fail`). T232 is the M.2 closeout
ticket: a read-only admin surface that consumes audit events, groups
them by day, filters by event kind / actor / time range, and
paginates the result.

## Scope

- `apps/electron/src/renderer/components/settings/rbac/audit-log-state.ts` —
  pure reducer over the audit-event list: filter + group + paginate.
- `apps/electron/src/renderer/components/settings/rbac/AuditLogPanel.tsx` —
  presentational panel showing paginated event groups with filter
  controls. Reads from an injected `AuditEventSource` interface
  (T232b will add the real RPC; T232 stubs an in-memory source for
  tests).
- `apps/electron/src/renderer/pages/settings/AuditLogSettingsPage.tsx` —
  page wrapper mounting at `/settings/audit-log`.
- Settings registry wiring (5 files): `index.ts`, `settings-pages.ts`,
  `menu-schema.ts`, `settings-registry.ts`, `SettingsIcons.tsx`.
- 2 i18n keys across all 8 locales: `settings.auditLog.title` +
  `settings.auditLog.description`.
- Unit coverage for the pure reducer with bun:test.

## Out of scope (T232b)

- Real RPC handler that serves audit events from the M.1.5 storage.
- Renderer telemetry consumer subscription.

## Validation

- `bun test` on the reducer passes.
- `bun run lint:i18n:parity` — pass (8 locales).
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T232b** — wire the real RPC handler to the audit storage substrate.
- **T232c** — renderer telemetry consumer via IPC.
