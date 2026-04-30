# T049 - Long-running Mission Scheduler Adapter

## Task summary

Implement the long-running mission scheduler adapter from the Experience Layer PRD.

## Reformulated task

Create a deterministic shared scheduler abstraction with fake provider behavior:

- due checkpoint execution
- checkpoint run events
- idempotency keys
- budget exhaustion pause
- cancelled mission skip

## Assumptions and boundaries

- This ticket implements fake deterministic shared logic, not production scheduler infrastructure.
- No real cron, queue, Temporal, browser, LLM, billing, storage, or email provider is called.
- Elapsed time alone does not complete a mission; due checkpoints produce events and still need gates/artifacts later.
- Budget exhaustion pauses the mission and blocks the checkpoint.
- Cancelled missions do not execute future checkpoints.

## ERD / schema view

```text
MissionSchedulerState
  missions[]
  checkpoints[]
  budgetRemainingCreditsByMissionId
  executedIdempotencyKeys[]
  events[]
    -> executeDueMissionCheckpoints(now)
```

## Sequence diagram

```text
Scheduler tick
  -> find due queued checkpoints
  -> skip cancelled/non-running missions
  -> check idempotency
  -> check budget
  -> execute fake checkpoint
  -> append run event
  -> mark checkpoint completed
```

## Component / screen map impact

- Adds shared `mission-scheduler-adapter`.
- No renderer screen changes.
- Exports adapter through `packages/shared/src/workbench/index.ts`.

## Repo context discovered

- Shared workbench modules live under `packages/shared/src/workbench`.
- Shared tests use Bun and direct module imports.
- T041 shared `MissionRun` and `MissionCheckpoint` types provide the scheduler model foundation.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/__tests__/agent-pipeline-planner.test.ts`

## Tests added first

- `packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts`
  - verifies due checkpoint creates a run event
  - verifies checkpoint execution is idempotent
  - verifies budget exhaustion pauses mission and blocks checkpoint
  - verifies cancelled mission does not execute future checkpoints

## Expected failing test output

Initial TDD run failed before implementation because the shared module did not exist:

```text
Cannot find module '../mission-scheduler-adapter'
```

## Implementation changes

- Added shared `packages/shared/src/workbench/mission-scheduler-adapter.ts`.
- Added deterministic fake scheduler state factory.
- Added `executeDueMissionCheckpoints` with:
  - due checkpoint detection
  - mission status guard
  - idempotency key tracking
  - budget exhaustion pause
  - checkpoint executed/budget exhausted events
- Exported the adapter from `packages/shared/src/workbench/index.ts`.

## Validation commands run

- `bun test packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts packages/shared/src/workbench/__tests__/experience-layer-registry.test.ts` - passed.
- `bun run typecheck:shared` - passed.
- `bun run lint:shared` - passed.
- `bun run validate:agent-contract` - passed.

## Passing test output summary

```text
bun test packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts packages/shared/src/workbench/__tests__/experience-layer-registry.test.ts
16 pass
0 fail
82 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No renderer/runtime build surface was changed. Shared typecheck and lint passed.

## Remaining risks

- This is a fake deterministic adapter, not production scheduler infrastructure.
- Checkpoint execution currently creates run events only; T051/E2E and later live integration own artifact/gate propagation.
- Date parsing expects valid ISO checkpoint due timestamps; production scheduler should validate persisted timestamps at write boundaries.

## Acceptance criteria matrix

- [x] Due checkpoint creates run event.
- [x] Checkpoint execution is idempotent.
- [x] Budget exhaustion pauses mission.
- [x] Cancelled mission does not execute future checkpoints.
- [x] Shared targeted tests pass.
- [x] Relevant broader validation passes.
- [ ] Scoped commit exists.
