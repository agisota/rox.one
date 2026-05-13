# T343 - Renderer observability audit-event import boundary

Status: DONE
Phase: post-rebase build repair
Ticket: docs/tickets/T343-renderer-observability-audit-event-import-boundary.md

## 1. Task summary

Repair the renderer build by keeping audit-log UI imports on the browser-safe
audit-event taxonomy instead of the Node-only observability producer barrel.

## 2. Repo context discovered

`bun run build` passed Electron main, preload, and the WhatsApp worker after
T342, then failed in the renderer Vite bundle. Vite externalised
`node:async_hooks` and `node:crypto` for browser compatibility, then Rollup
failed because the root observability barrel evaluated `correlation.ts` and
`audit-producer.ts`.

The renderer audit-log surface only needs serialisable audit-event types and
the `AUDIT_EVENT_KINDS` registry. It does not emit producer events or need
correlation propagation.

The root `@rox-one/shared/observability` barrel remains the server-side
producer surface for server-core handlers and tests.

## 3. Files inspected

- `packages/shared/src/observability/index.ts`
- `packages/shared/src/observability/audit-event.ts`
- `packages/shared/src/observability/correlation-id.ts`
- `packages/shared/src/observability/correlation.ts`
- `packages/shared/src/observability/audit-producer.ts`
- `packages/shared/package.json`
- `apps/electron/src/renderer/pages/settings/AuditLogSettingsPage.tsx`
- `apps/electron/src/renderer/components/settings/rbac/audit-log-state.ts`
- `apps/electron/src/renderer/components/settings/rbac/AuditLogPanel.tsx`
- `apps/electron/src/renderer/components/settings/rbac/__tests__/audit-log-state.test.ts`

## 4. Tests added first

No new test file was needed. The existing renderer build is the executable
contract for this browser import boundary.

## 5. Expected failing test output

`bun run build` failed during `electron:build:renderer` with:

- `Module "node:async_hooks" has been externalized for browser compatibility`
- `"AsyncLocalStorage" is not exported by "__vite-browser-external", imported by "packages/shared/src/observability/correlation.ts"`
- Vite also reported `node:crypto` externalisation through
  `packages/shared/src/observability/audit-producer.ts`.

## 6. Implementation changes

- Added the `@rox-one/shared/observability/audit-event` package export.
- Split the browser-safe `CorrelationId` brand and `asCorrelationId` validator
  into `correlation-id.ts`, leaving `correlation.ts` responsible only for Node
  `AsyncLocalStorage` propagation.
- Moved renderer audit-log runtime imports from the root observability barrel
  to the audit-event-only subpath.
- Left the root observability producer barrel unchanged for server code.

## 7. Validation commands run

- `bun run build` (red)
- `bun test packages/shared/src/observability/__tests__/correlation.test.ts packages/shared/src/observability/__tests__/audit-event.test.ts apps/electron/src/renderer/components/settings/rbac/__tests__/audit-log-state.test.ts`
- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `git diff --check`

## 8. Passing test output summary

- Targeted observability/audit-log bundle: 44 pass, 0 fail, 122 expect calls.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 3 existing React hook warnings and 0 errors.
- `bun test`: 5988 pass, 13 skip, 0 fail, 1 snapshot, 24614 expect calls.
- `git diff --check`: clean.

## 9. Build output summary

`bun run build` exited 0. Electron renderer completed after Vite transformed
5719 modules; the remaining output was the existing dynamic-import and
large-chunk warning set.

## 10. Remaining risks

The root observability barrel remains Node-only because it still exports the
producer and AsyncLocalStorage correlation helpers. Renderer code must continue
using browser-safe subpaths when it only needs event taxonomy.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Renderer avoids Node-only observability producer modules | Green | `bun run build` renderer stage exit 0 |
| Full build passes renderer bundle | Green | `bun run build` exit 0 |
| Audit-log reducer tests pass | Green | Targeted bundle: 44 pass, 0 fail |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
