# T066 - Durable Mission Scheduler

## 1. Task summary

Implement the durable scheduler layer for long-running ROX ONE missions. T049
created deterministic shared scheduler logic; T066 must bind mission execution to
repository-backed `MissionRun`, `MissionCheckpoint`, idempotency, scheduler events,
budget/capacity gates, approval gates, and final evidence checks.

## 2. Repo context discovered

- `packages/shared/src/workbench/experience-layer.ts` owns the mission truth
  schemas: `MissionRun`, `MissionCheckpoint`, gate results, VDI, quest evidence,
  and the rule that elapsed time alone cannot complete a mission.
- `packages/shared/src/workbench/mission-scheduler-adapter.ts` is an older fake
  in-memory adapter from T049. It is intentionally not durable.
- `packages/server-core/src/persistence/agent-workbench-persistence.ts` already
  exposes `MissionRunRepository` with mission, checkpoint, scheduler event, and
  checkpoint idempotency methods from T065.
- T066 should add a server-core durable scheduler service on top of those
  repository contracts, not replace the shared fake adapter.
- Baseline before T066 was green:
  - `bun run validate:docs`
  - `bun run typecheck:all`
  - `bun test`
  - `bun run electron:build`
  - `git diff --check`

## 3. Files inspected

- `package.json`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`
- `packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts`
- `packages/shared/src/workbench/experience-layer-e2e-scenario.ts`
- `packages/server-core/src/persistence/index.ts`
- `packages/server-core/src/persistence/agent-workbench-persistence.ts`
- `packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts`
- `docs/tickets/T049-long-running-mission-scheduler-adapter.md`
- `docs/worklog/T049-long-running-mission-scheduler-adapter.md`
- `docs/integration/shared-file-lock.md`

## 4. Tests added first

- `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`
  - mission persists before execution
  - checkpoint jobs recover after restart
  - duplicate checkpoint execution is idempotent
  - elapsed time alone cannot complete mission
  - final completion requires artifact and gate evidence
  - budget/capacity denial blocks expansion
  - human approval pending blocks 100-agent swarm expansion
  - real checkpoint providers are refused in deterministic tests
- `packages/server-core/src/mission-scheduler/__tests__/mission-scheduler-export.test.ts`
  - durable scheduler contract is exposed through
    `@craft-agent/server-core/mission-scheduler`

## 5. Expected failing test output

Initial red run failed for the expected reason because the durable scheduler
module did not exist yet:

```text
Cannot find module '../durable-mission-scheduler'
0 pass
1 fail
1 error
```

A second red check was added for the public package surface before the export
was created:

```text
Cannot find module '@craft-agent/server-core/mission-scheduler'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/server-core/src/mission-scheduler/durable-mission-scheduler.ts`.
- Added repository-backed `DurableMissionScheduler` with:
  - `launchMission()` persisting `MissionRun` and generated checkpoints before execution;
  - `tick()` recovering due queued checkpoints from the repository;
  - checkpoint idempotency via `recordExecutedCheckpoint()` /
    `hasExecutedCheckpoint()`;
  - budget checks before checkpoint execution;
  - explicit refusal of `kind: "real"` checkpoint executors unless a caller opts in;
  - `finalizeMission()` that delegates to shared mission completion rules and
    adds gate-evidence enforcement;
  - `evaluateBranchExpansion()` for budget, capacity, and human approval gates.
- Added `packages/server-core/src/mission-scheduler/index.ts`.
- Added the package export `@craft-agent/server-core/mission-scheduler`.
- Created `docs/tickets/T066-durable-mission-scheduler.md`.
- Created `docs/integration/shared-file-lock.md` before touching shared files so
  later lanes have an explicit ownership map.

## 7. Validation commands run

- `git status --short --branch` - baseline recorded.
- `bun run validate:docs` - passed before T066.
- `bun run typecheck:all` - passed before T066.
- `bun test` - passed before T066: 4645 pass, 13 skip, 0 fail.
- `bun run electron:build` - passed before T066.
- `git diff --check` - passed before T066.
- `bun test packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts` - red before implementation, then passed.
- `bun test packages/server-core/src/mission-scheduler/__tests__/mission-scheduler-export.test.ts` - red before export, then passed.
- `bun test packages/server-core/src/mission-scheduler/__tests__/mission-scheduler-export.test.ts packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts` - passed.
- `bun test packages/server-core/src/mission-scheduler/__tests__/mission-scheduler-export.test.ts packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts packages/server-core/src/persistence/__tests__/agent-workbench-persistence.test.ts packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts` - passed.
- `bun run validate:docs` - passed after implementation.
- `bun run typecheck:all` - passed after implementation.
- `git diff --check` - passed after implementation.
- `bun test` - passed after implementation.
- `bun run electron:build` - passed after implementation.

## 8. Passing test output summary

- Durable scheduler targeted tests: 8 pass, 0 fail.
- Mission scheduler export test: 1 pass, 0 fail.
- Scheduler/persistence/shared mission focused suite: 24 pass, 0 fail.
- Full suite: 4654 pass, 13 skip, 0 fail, 1 snapshot,
  11817 `expect()` calls across 388 files.

## 9. Build output summary

`bun run electron:build` passed after T066. The build emitted existing Vite
chunk-size and Jotai deprecation warnings only; no T066-specific build failure
was observed.

## 10. Remaining risks

- Production queue backend is still future work; T066 creates the durable service
  contract over repository state with deterministic tests.
- Real provider orchestration is intentionally left to T067.
- The scheduler is durable over the current repository contract, but it is not
  yet wired into a production queue backend or UI live state. T068 owns real
  Experience Layer binding.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Mission persists before execution | PASS | `durable-mission-scheduler.test.ts` |
| Checkpoint jobs recover after restart | PASS | `durable-mission-scheduler.test.ts` |
| Duplicate checkpoint execution is idempotent | PASS | `durable-mission-scheduler.test.ts` |
| Elapsed time alone cannot complete mission | PASS | `durable-mission-scheduler.test.ts` |
| Final completion requires evidence | PASS | `durable-mission-scheduler.test.ts` |
| Budget/capacity denial blocks expansion | PASS | `durable-mission-scheduler.test.ts` |
| Human approval pending blocks 100-agent swarm expansion | PASS | `durable-mission-scheduler.test.ts` |
| Scheduler does not call real providers | PASS | `durable-mission-scheduler.test.ts` |
| Package export exists | PASS | `mission-scheduler-export.test.ts` |
| Targeted tests pass | PASS | 9 pass, 0 fail |
| Focused integration tests pass | PASS | 24 pass, 0 fail |
| Full test suite passes | PASS | 4654 pass, 13 skip, 0 fail |
| Typecheck passes | PASS | `bun run typecheck:all` |
| Electron build passes | PASS | `bun run electron:build` |
| Worklog complete | PASS | This file |
| Scoped commit exists | PASS | This scoped T066 commit |
