# Decision 0008: Queryable Audit Storage Backend

- Status: accepted
- Date: 2026-05-16
- Implements: Phase 1.5 of the Agent Workbench Suite master roadmap

## Context

C4 intentionally emitted audit signals through the existing structured logger.
That kept the storage-isolation slice small, but it left operators without a
queryable audit store for scope forgery, downgrade, credential-scope, and future
RBAC events.

## Decision

Add a backend-neutral audit storage contract in server-core. The canonical
stored record has these columns:

- `event_id`
- `ts`
- `actor`
- `tenant_id`
- `event_type`
- `severity`
- `payload_json`
- `request_id`

The store is append-only at the interface boundary. Records also carry
`previous_event_hash` and `event_hash` so compliance tooling can detect edits,
removals, and reordering.

Structured logger output remains active. Persistent writes are added as fanout
from existing audit emitters in follow-up tickets instead of replacing debug
output.

## Consequences

- Tests can prove the storage contract independently before wiring production
  emitters.
- Future memory, file, sqlite, and object-store backends can share the same
  normalized record shape.
- Retention cannot silently delete events. Retention must be explicit policy
  work that preserves a verifiable chain for retained records.

## Follow-Up Tickets

- T218 implements the schema contract.
- T219 wires writer fanout.
- T220 exposes filtered query APIs.
- T221 implements retention policy.

## Verification Gates

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
