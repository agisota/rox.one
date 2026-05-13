# Queryable Audit Storage Backend Design

- Status: accepted
- Date: 2026-05-16
- Phase: 1.5 C4 follow-on
- Tickets: T218, T219, T220, T221

## Objective

Make C4 and account audit events queryable without replacing the existing
structured logger path. The first durable contract is an append-only audit
record schema with tenant, actor, event type, severity, payload, request id, and
tamper-evident chain fields.

## Locked Decisions

1. **Existing logger calls remain.** Persistent audit writes fan out from the
   current structured logger/audit seams instead of replacing stderr/debug
   output.
2. **Append-only is the base invariant.** The audit store exposes append and
   query APIs. It does not expose update or delete; retention is implemented as
   explicit rotation/pruning policy in T221.
3. **Schema is backend-neutral.** Memory, file, sqlite, and future object-store
   backends share the same normalized record shape:
   `event_id`, `ts`, `actor`, `tenant_id`, `event_type`, `severity`,
   `payload_json`, `request_id`.
4. **Tamper evidence belongs to the stored record.** Each append stores
   `previous_event_hash` and `event_hash` computed over canonical record fields.
   Verification must fail if an earlier event is edited, removed, or reordered.
5. **Payloads are sanitized before persistence.** The persistent payload cannot
   contain common token, secret, password, cookie, authorization, or API-key
   material.

## Components

- `packages/server-core/src/audit/audit-event-store.ts` defines the normalized
  audit record, append-only backend interface, in-memory schema implementation,
  payload sanitizer, and hash-chain verifier.
- `packages/server-core/src/audit/index.ts` exports the audit storage contract.
- `packages/server-core/package.json` exposes `@craft-agent/server-core/audit`
  for later Phase 1.5 writer/query wiring.
- `packages/server-core/src/audit/__tests__/audit-event-store.test.ts` proves
  the T218 schema invariants.

## Ticket Boundaries

- **T218:** schema, in-memory append-only implementation, sanitizer, hash-chain
  verifier, docs, ADR.
- **T219:** writer fanout from structured logger/scope audit events into the
  persistent audit store.
- **T220:** query API filters by tenant, actor, event type, and time range for
  admin UI consumption.
- **T221:** retention policy and backend rotation behavior with hash-chain
  verification after retention.

## Out of Scope

- Replacing every logger call in the repo.
- Production sqlite or object-store persistence.
- Admin UI screens beyond the existing account/team audit HTTP surface.
- RBAC policy changes.

## Invariants

1. Every appended audit record has the required schema fields.
2. Append order is preserved and no mutation API exists on the backend
   interface.
3. Returned records are defensive copies.
4. Hash-chain verification passes for untouched records and fails after
   tampering.
5. Secret-looking payload material is redacted before storage.

## Validation

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`
