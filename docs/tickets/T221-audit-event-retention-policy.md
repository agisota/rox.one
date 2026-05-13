# T221 - Audit event retention policy

Status: DONE

## Context

T218 added the append-only audit schema. T219 wired structured audit writer
fanout. T220 exposed filtered query APIs and wired the team audit HTTP surface.

T221 adds explicit retention evaluation without adding a hidden mutation API to
the storage backend.

## Goal

Add per-event-type retention policy evaluation that returns a retained,
re-anchored audit record set whose hash chain remains verifiable.

## Required UI

None.

## Required Data/API

- `applyAuditRetentionPolicy(records, policy)` evaluates per-event-type
  `retention_days` rules.
- Expired records are removed from the retained result only; the backend
  remains append-only.
- Retained records are re-anchored so `verifyAuditHashChain(retainedRecords)`
  passes after pruning.
- Retained records carry retention metadata describing the original hash
  linkage and retention timestamp.

## Required Automations

None.

## Required Subagents

None for this bounded policy implementation.

## TDD Requirements

Before implementation:

1. Extend `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
   with a failing retention test.
2. Prove per-event-type `retention_days` removes only expired records.
3. Prove the retained record set passes hash-chain verification.
4. Prove retained records carry re-anchoring metadata.

## Implementation Requirements

- Do not add production dependencies.
- Do not add update/delete methods to `AuditEventStorageBackend`.
- Preserve the canonical hash algorithm so `verifyAuditHashChain` validates
  retained records.
- Keep retention policy explicit and side-effect-free for this slice.

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

- [x] Per-event-type `retention_days` removes only expired matching records.
- [x] Retained records keep non-expired and longer-retention event types.
- [x] Retained records carry re-anchoring metadata.
- [x] `verifyAuditHashChain(retainedRecords)` passes after retention.
- [x] The storage backend remains append-only with no update/delete API.
- [x] Targeted retention tests pass.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T221-audit-event-retention-policy.md`.
