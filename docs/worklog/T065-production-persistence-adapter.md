# T065 - Production Persistence Adapter Contracts Worklog

## 1. Task summary

Create a typed persistence adapter seam for account, team, ledger, storage, sync, mission, quest, metric, audit, and agent package state before wiring production database adapters.

## 2. Repo context discovered

T065 did not exist as a canonical ticket. Existing runtime already has several interface + in-memory pairs: account teams, usage ledger, audit events, managed cloud workspaces, team chat, DV.net billing intents, object storage, local/cloud sync, and workspace sync. The Experience Layer truth model lives in `packages/shared/src/workbench/experience-layer.ts` and already enforces evidence-backed mission, quest, ledger, metric, and package schemas.

## 3. Files inspected

- `packages/server-core/src/accounts/types.ts`
- `packages/server-core/src/accounts/postgres-store.ts`
- `packages/server-core/src/webui/account-teams.ts`
- `packages/server-core/src/webui/account-ledger.ts`
- `packages/server-core/src/webui/account-events.ts`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`
- `packages/server-core/src/webui/account-billing.ts`
- `packages/server-core/src/webui/team-chat.ts`
- `packages/server-core/src/storage/object-storage.ts`
- `packages/server-core/src/sync/local-cloud-sync.ts`
- `packages/server-core/src/sync/workspace-sync-service.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`
- `packages/shared/src/workbench/spec-compiler.ts`

## 4. Tests added first

- `packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts`

The test was written before implementation and asserted one aggregate adapter contract:
- account registration, session lifecycle, team creation, ledger, audit, cloud workspace, storage quota, sync file, workspace sync, billing intent, and team chat stores are reachable from one adapter;
- mission runs persist checkpoints and scheduler events with checkpoint idempotency;
- quest progress and XP ledger entries reject missing artifact/gate evidence through shared schemas;
- metrics persist Quality Score, Execution Readiness, VDI, risk, cost, noise, and capacity snapshots;
- package visibility keeps private/team packages isolated while built-in/public packages remain discoverable.

## 5. Expected failing test output

Initial red run:

```text
bun test packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts
error: Cannot find module '../agent-workbench-persistence'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/server-core/src/persistence/agent-workbench-persistence.ts`.
- Added `packages/server-core/src/persistence/index.ts`.
- Exported `./persistence` from `packages/server-core/package.json`.
- Introduced typed repository contracts for mission runs, quest progress, metric snapshots, and agent packages.
- Introduced `AgentWorkbenchPersistenceAdapter` as the aggregate runtime persistence seam across existing account/team/ledger/audit/storage/sync/webui stores plus new mission/quest/metric/package repositories.
- Added deterministic in-memory implementations for tests/local development:
  - `InMemoryAccountStore`
  - `InMemoryMissionRunRepository`
  - `InMemoryQuestProgressRepository`
  - `InMemoryMetricSnapshotRepository`
  - `InMemoryAgentPackageRepository`
- Kept production DB wiring out of scope. Existing `PostgresAccountStore` remains the current production-style account reference implementation, but no new production adapter is connected by this ticket.

## 7. Validation commands run

```text
bun test packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts
bun test packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-cloud-workspaces.test.ts packages/server-core/src/webui/__tests__/account-billing.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts
bun run validate:docs
bun run typecheck:all
bun run lint
bun run validate:docs && bun test
git diff --check
bun run electron:build
```

## 8. Passing test output summary

Targeted persistence contract:

```text
4 pass
0 fail
25 expect() calls
```

Relevant neighboring account/storage/sync/experience tests:

```text
55 pass
0 fail
218 expect() calls
```

Full test suite:

```text
4644 pass
13 skip
0 fail
1 snapshots
11777 expect() calls
Ran 4657 tests across 386 files.
```

`bun run validate:docs`, `bun run typecheck:all`, `bun run lint`, and `git diff --check` passed. `bun run lint` reported 3 existing React hook dependency warnings in renderer files and 0 errors.

## 9. Build output summary

`bun run electron:build` passed:

```text
main/preload/renderer/resources/assets built successfully
```

The renderer build still emits the existing Vite warning about chunks larger than 500 kB after minification. No build failure.

## 10. Remaining risks

- Production database adapters for the new aggregate persistence seam are intentionally deferred. T065 only defines the contract and deterministic in-memory adapter.
- The new in-memory account store is for tests/local contract validation only and should not replace `PostgresAccountStore` in production without a dedicated ticket.
- T066/T068 must bind durable mission scheduler and Experience Layer UI to this seam; T065 does not wire runtime screens.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Contract tests cover account CRUD/session basics | PASS | `agent-workbench-persistence.test.ts` |
| Contract tests cover team, ledger, audit, storage, and sync | PASS | `agent-workbench-persistence.test.ts` plus neighboring store tests |
| Contract tests cover mission runs/checkpoints/events | PASS | `agent-workbench-persistence.test.ts` |
| Contract tests cover quest/ledger evidence enforcement | PASS | `agent-workbench-persistence.test.ts` |
| Contract tests cover metrics and package visibility | PASS | `agent-workbench-persistence.test.ts` |
| Adapter exported from server-core persistence path | PASS | `packages/server-core/src/persistence/index.ts`, `packages/server-core/package.json` |
| Existing tests still pass | PASS | `bun run validate:docs && bun test`, `bun run typecheck:all`, `bun run electron:build` |
