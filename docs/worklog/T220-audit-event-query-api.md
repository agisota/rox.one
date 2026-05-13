# T220 - Audit event query API

## 1. Task summary

Expose filtered audit event queries and wire the existing team audit WebUI HTTP
surface to the queryable audit backend.

## 2. Repo context discovered

- T219 moved the canonical audit storage implementation into
  `packages/shared/src/audit` and has server-core re-export it.
- The T220 plan names `packages/server-core/src/audit/audit-event-store.ts` as
  the query API surface, so the server-core layer can add query helpers while
  keeping shared storage append-only.
- `/api/account/teams/:teamId/audit` already enforces owner/admin RBAC and
  currently reads from `AccountEventHistory` when configured.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-16-audit-storage-backend-design.md`
- `docs/superpowers/plans/2026-05-16-audit-storage-backend.md`
- `docs/decision-records/audit-harness/0008-audit-storage-backend.md`
- `packages/server-core/src/audit/audit-event-store.ts`
- `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/account-events.ts`

## 4. Tests added first

- Extended `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
  before implementation to prove query filters by tenant, actor type/id, event
  type, and inclusive time range while preserving sanitized payloads and
  defensive copies.
- Extended `packages/server-core/src/webui/__tests__/account-http.test.ts`
  before implementation to prove `/api/account/teams/:teamId/audit` consumes a
  configured audit event store, forces the authorized tenant, preserves
  redaction, and keeps viewer RBAC denial.

## 5. Expected failing test output

- Red run:
  `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
  exited 1.
- Audit store test failed with `Export named 'queryAuditEventRecords' not found
  in module .../packages/server-core/src/audit/audit-event-store.ts`.
- WebUI test failed with `Expected length: 1 Received length: 0`, proving the
  team audit route ignored the configured audit store before implementation.

## 6. Implementation changes

- Added `AuditEventQuery` and `queryAuditEventRecords()` to the server-core
  audit surface. The helper filters by tenant, actor type/id, event type, and
  inclusive timestamp range, sorts newest-first, clamps limits to 500, and
  returns defensive record copies.
- Added `accountAuditEventStore` to `WebuiHandlerOptions`.
- Updated `/api/account/teams/:teamId/audit` to prefer the configured audit
  event store, force `tenantId` to the authorized team id, honor query params
  for `actorId`, `actorType`, `eventType`, `from`, `to`, and `limit`, and map
  stored audit records to the existing account-cabinet event response shape.
- Preserved the existing `AccountEventHistory` fallback when no audit event
  store is configured.
- Fixed a TypeScript-only test issue by passing `query.toString()` into
  `new Request(...)` after server-core `tsc` rejected a `URL` instance.

## 7. Validation commands run

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted audit/WebUI suite: 27 pass, 0 fail, 180 expect calls.
- `cd packages/server-core && bunx tsc --noEmit`: exit 0 after the
  `URL`-to-string test fix.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:docs`: exit 0, including `agent-contract` with 177
  tickets.
- `git diff --check`: exit 0.
- Full `bun test`: 5077 pass, 13 skip, 0 fail, 1 snapshot, 12740 expect calls,
  5090 tests across 456 files in 69.79s.

## 9. Build output summary

- `bun run build`: exit 0. Existing Vite chunk-size warnings remained, with no
  build failure.

## 10. Remaining risks

- T220 adds query filters and HTTP consumption only. Retention policy remains
  T221.
- The team audit HTTP route exposes the in-memory/file audit backend through a
  configured option only; production persistence beyond file remains reserved.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Query helper filters by tenant, actor, event type, and time range | Pass | Audit store targeted test verifies all filters together |
| Query helper returns defensive copies and bounded result counts | Pass | Audit store targeted test mutates a returned record and rereads clean state; helper clamps limit |
| Sanitized payloads stay sanitized through query results | Pass | Audit store and WebUI tests assert `raw-token` is absent and `[redacted]` remains |
| Team audit HTTP route uses the audit event store when configured | Pass | WebUI targeted test gets one matching audit-store event |
| Team audit HTTP route still denies unauthenticated and unauthorized callers | Pass | Existing team audit test plus new viewer denial regression |
| Account event history fallback remains available | Pass | Existing account event history tests passed in targeted and full suites |
| Targeted query/API tests pass | Pass | 27 pass, 0 fail in targeted audit/WebUI suite |
| Full relevant validation passes or blocker documented | Pass | server-core tsc, typecheck, lint, docs, diff, full test, and build exited 0 |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This atomic T220 Lore commit records the change |
