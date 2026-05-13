# T220 - Audit event query API

Status: DONE

## Context

T218 added the normalized append-only audit schema. T219 wired C4 scope and
credential audit events into a configured memory/file audit backend.

T220 exposes a filtered query contract for the backend and wires the existing
team audit WebUI HTTP surface to consume it without changing authorization
rules.

## Goal

Add query filters for tenant, actor, event type, and time range, then consume
them from the team audit endpoint.

## Required UI

None. This ticket only backs the existing WebUI account/team audit HTTP
surface.

## Required Data/API

- `queryAuditEventRecords(store, query)` filters audit records by:
  - tenant id
  - actor type/id
  - event type
  - inclusive `from`/`to` timestamp range
  - bounded result limit
- `/api/account/teams/:teamId/audit` uses the configured audit event store
  when available and still requires owner/admin membership.
- The team audit endpoint forces the tenant filter to the authorized team id.
- Returned payloads remain sanitized because records are read from the
  persisted `payloadJson`.

## Required Automations

None.

## Required Subagents

None for the implementation path. Existing plan and local code are sufficient.

## TDD Requirements

Before implementation:

1. Extend `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
   with a failing query-filter test.
2. Extend `packages/server-core/src/webui/__tests__/account-http.test.ts` with
   a failing team audit HTTP query test.
3. Run the targeted tests and confirm they fail for the missing query API /
   missing HTTP wiring.

## Implementation Requirements

- Do not add production dependencies.
- Preserve append-only behavior and defensive copies.
- Do not change team audit authorization semantics.
- Keep the account event history fallback working when no audit event store is
  configured.

## Validation Commands

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## Acceptance Criteria

- [x] Query helper filters by tenant, actor, event type, and time range.
- [x] Query helper returns defensive copies and bounded result counts.
- [x] Sanitized payloads stay sanitized through query results.
- [x] Team audit HTTP route uses the audit event store when configured.
- [x] Team audit HTTP route still denies unauthenticated and unauthorized
  callers.
- [x] Account event history fallback remains available.
- [x] Targeted query/API tests pass.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T220-audit-event-query-api.md`.
