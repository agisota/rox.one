# T218 - Audit storage schema

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench
Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-tenant storage isolation
- validation gates
- queryable audit trail

Phase 1.5 starts the queryable audit storage backend that C4 deferred.

## Goal

Add a backend-neutral append-only audit storage schema with defensive copies,
payload redaction, and hash-chain verification.

## Required UI

None.

## Required Data/API

- `AuditEventInput` for appending normalized events.
- `AuditEventRecord` with `eventId`, `ts`, `actor`, `tenantId`, `eventType`,
  `severity`, `payloadJson`, `requestId`, `previousEventHash`, and `eventHash`.
- `AuditEventStorageBackend` with append and read-only list behavior.
- `InMemoryAuditEventStore` as the first schema implementation.
- `verifyAuditHashChain(records)` for tamper-evidence checks.

## Required Automations

None in T218. Writer fanout is T219.

## Required Subagents

Read-only explorer mapped the existing account/audit seams before
implementation.

## TDD Requirements

Before implementation:

1. Add `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`.
2. Prove appended records include the Phase 1.5 schema fields.
3. Prove hash-chain verification detects mutation.
4. Prove returned records are defensive copies.
5. Prove secret-looking payload fields are redacted before persistence.
6. Run the targeted test and confirm it fails for the missing implementation.

## Implementation Requirements

- Use only Node built-ins; do not add production dependencies.
- Keep existing account event APIs unchanged.
- Do not wire production logger fanout in T218.
- Keep payload redaction conservative and recursive.

## Validation Commands

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## Acceptance Criteria

- [x] Append-only audit schema exists.
- [x] Records include the Phase 1.5 columns.
- [x] Hash-chain verification detects tampering.
- [x] List results are defensive copies.
- [x] Payload secrets are redacted before storage.
- [x] Targeted audit schema tests pass.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T218-audit-storage-schema.md`.
