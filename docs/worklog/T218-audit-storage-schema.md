# T218 - Audit storage schema

## 1. Task summary

Add the Phase 1.5 append-only audit storage schema and in-memory implementation
that future writer/query/retention tickets can reuse.

## 2. Repo context discovered

- ADR 0007 deferred queryable audit storage after C4.
- `packages/server-core/src/webui/account-events.ts` already has account event
  history types, in-memory append/list behavior, and payload redaction.
- `packages/server-core/src/persistence/agent-workbench-persistence.ts` has an
  `audit` seam currently typed to account events.
- C4 scope audit emitters currently log through structured debug output in
  `packages/shared/src/config/storage-scope-auth.ts` and
  `packages/shared/src/config/storage-internal.ts`.
- Phase 1.5 needs a lower-level generic audit store before wiring those
  emitters.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `packages/shared/src/utils/debug.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/credentials/backends/secure-storage.ts`
- `packages/server-core/src/webui/account-events.ts`
- `packages/server-core/src/webui/__tests__/account-events.test.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/persistence/agent-workbench-persistence.ts`
- `packages/server-core/package.json`

## 4. Tests added first

- Added `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
  before production audit storage code.

## 5. Expected failing test output

Initial red run before implementation:

```text
bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts
error: Cannot find module '../audit-event-store'
0 pass
1 fail
1 error
```

The failure was expected: the test imported the missing T218 audit schema
module before any production implementation existed.

## 6. Implementation changes

- Added `packages/server-core/src/audit/audit-event-store.ts` with
  `AuditEventInput`, `AuditEventRecord`, `AuditEventStorageBackend`,
  `InMemoryAuditEventStore`, `serializeAuditPayload`, and
  `verifyAuditHashChain`.
- Added append-only in-memory storage with defensive copies and no mutation
  APIs.
- Added recursive payload redaction for token, secret, password, cookie,
  authorization, and API-key material.
- Added canonical hash-chain fields:
  `previousEventHash` and `eventHash`.
- Exported the audit module from `packages/server-core/src/audit/index.ts`,
  `packages/server-core/src/index.ts`, and `@rox-agent/server-core/audit`.
- Added the Phase 1.5 design spec, implementation plan, and ADR 0008.

## 7. Validation commands run

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted audit schema test:

```text
bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts
4 pass
0 fail
14 expect() calls
```

- Full suite:

```text
bun test
5072 pass
13 skip
0 fail
1 snapshots
12713 expect() calls
5085 tests
455 files
```

- `cd packages/server-core && bunx tsc --noEmit`, `bun run typecheck`,
  `bun run lint`, `bun run validate:agent-contract`, `bun run validate:docs`,
  and `git diff --check` completed with exit code 0.

## 9. Build output summary

`bun run build` completed with exit code 0. The Electron build completed main,
preload, renderer, resources, and assets. Vite emitted existing large-chunk
warnings, with no build failure.

## 10. Remaining risks

- T218 defines the storage schema only. Writer fanout, query APIs, and retention
  policy are intentionally left for T219, T220, and T221.
- This is an in-memory schema implementation. Durable file/sqlite/object-store
  behavior remains follow-up work.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Append-only audit schema exists | Pass | `AuditEventStorageBackend` exposes append and read-only listing only |
| Records include the Phase 1.5 columns | Pass | Targeted schema test asserts actor, tenant, event type, severity, payload JSON, request id, timestamp, and event id |
| Hash-chain verification detects tampering | Pass | Targeted test mutates payload JSON and `verifyAuditHashChain` returns false |
| List results are defensive copies | Pass | Targeted test mutates a listed actor and the stored record remains unchanged |
| Payload secrets are redacted before storage | Pass | Targeted test proves token/API-key strings are absent from `payloadJson` |
| Targeted audit schema tests pass | Pass | `4 pass`, `0 fail`, `14 expect() calls` |
| Full relevant validation passes or blocker documented | Pass | Typecheck, lint, docs, agent-contract, diff check, full suite, and build pass |
| Worklog complete | Pass | All 11 required sections filled |
| Commit created | Pass | This task will be committed with the T218 changes |
