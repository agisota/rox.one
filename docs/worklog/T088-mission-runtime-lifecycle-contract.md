# T088 - MissionRun Lifecycle Contract Alignment Worklog

## 1. Task summary

Implement the approved T088 plan from
`.omx/context/rox-experience-mission-architecture-20260506T093506Z.md`.

The narrow goal is to align `MissionRun` lifecycle truth across:

- `ExperienceRuntimeStore`
- `DurableMissionScheduler`
- Deep Missions launch
- Mission Control finalization projection

Vocabulary for this ticket:

- `Mission` = product/domain work unit.
- `MissionRun` = concrete persisted runtime execution.
- `Deep Mission` = product-facing mode/subtype for long-running runs.

## 2. Repo context discovered

- Current branch is `mac/rox-production-ready-rc`.
- Runtime-local noise remains dirty and unrelated: `events.jsonl` and `.claude/`.
- `MissionRunStatusSchema` already supports `draft`, `queued`, `running`,
  `waiting_for_approval`, `paused`, `completed`, `failed`, and `cancelled`.
- `DurableMissionScheduler.launchMission()` persists launched runs as `queued`.
- `createDeepMissionLaunchPlan()` currently dispatches `mission.launched` with a
  `running` mission, creating a status mismatch with the scheduler.
- `ExperienceRuntimeStore.finalizeMission()` requires stored final artifact and
  passing gate evidence.
- `MissionControlState.canFinalize` currently derives from local blockers only,
  so it can overstate finalization readiness when no final artifact exists.

## 3. Files inspected

- `AGENTS.md`
- `.omx/context/rox-experience-mission-architecture-20260506T093506Z.md`
- `docs/tickets/T074-experience-runtime-store.md`
- `docs/tickets/T076-mission-control-runtime-binding.md`
- `docs/tickets/T087-final-product-rc-documentation-build.md`
- `docs/worklog/T087-final-product-rc-documentation-build.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/experience-state.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/__tests__/experience-layer.test.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
- `packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts`
- `packages/server-core/src/mission-scheduler/durable-mission-scheduler.ts`
- `packages/server-core/src/mission-scheduler/index.ts`
- `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`
- `packages/server-core/src/persistence/agent-workbench-persistence.ts`
- `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`
- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`

## 4. Tests added first

- `packages/shared/src/workbench/__tests__/mission-lifecycle.test.ts`
- Added scheduler projection/status assertions to
  `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`
- Tightened Deep Missions launch expectations in
  `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- Tightened Mission Control finalization readiness expectations in
  `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`

## 5. Expected failing test output

First targeted red run failed for the expected contract gaps:

```text
Cannot find module '../mission-lifecycle'
Expected: "queued"
Received: "running"
Expected: false
Received: true
```

After the architecture verification pass, two stricter red assertions were
added before the final scheduler fix:

```text
Expected: ["running"]
Received: ["queued"]

Expected: "fail"
Received: "pass"
```

These failures proved that the scheduler was still passing a stale queued
mission to checkpoint execution and that payload-only final artifact IDs could
bypass durable artifact proof.

## 6. Implementation changes

- Added `packages/shared/src/workbench/mission-lifecycle.ts` as the shared
  lifecycle contract for launch normalization, legal status transitions,
  executable/terminal status checks, finalization gates, and scheduler event
  projection.
- Exported the lifecycle contract from `packages/shared/src/workbench/index.ts`.
- Aligned `ExperienceRuntimeStore` so `mission.launched` normalizes a run to
  `queued` and `finalizeMission()` delegates to the shared finalization guard.
- Aligned Deep Missions launch projection so UI launch no longer marks a run as
  `running` before the durable scheduler has executed it.
- Aligned Mission Control `canFinalize` with the same artifact/gate evidence
  requirements used by runtime truth.
- Aligned `DurableMissionScheduler.tick()` so the persisted mission is promoted
  to `running` before checkpoint execution and finalization requires stored
  checkpoint artifact proof plus passing gate evidence.
- Kept tests fake-provider-safe; no real provider, LLM, browser, payment,
  storage, email, marketplace, or shortlink adapters are invoked by T088 tests.
- A read-only architecture verifier initially blocked the change on stale
  scheduler execution state and payload-only artifact proof. Both blockers now
  have red/green coverage.

## 7. Validation commands run

```text
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts packages/shared/src/workbench/__tests__/mission-lifecycle.test.ts apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts
```

Result: PASS.

```text
bun run validate:docs
```

Result: PASS.

```text
bun run typecheck:all
```

Result: PASS.

```text
bun run lint
```

Result: PASS with pre-existing React hook warnings in:

- `apps/electron/src/renderer/App.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`

```text
env HOME=/private/tmp/rox-bun-test-home bun test
```

Result: BLOCKED by 8 unrelated existing failures:

- `packages/server-core/src/sessions/refresh-connection-runtime.test.ts`
- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
- `apps/electron/src/main/handlers/__tests__/session-watcher.test.ts`
- `apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts`
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`

The targeted T088 tests pass under the same isolated `HOME`, so these failures
are recorded as non-T088 blockers.

```text
bun run electron:build
```

Result: PASS with Vite chunk-size warnings only.

```text
git diff --check
```

Result: PASS.

## 8. Passing test output summary

Targeted T088 suite:

```text
37 pass
0 fail
168 expect() calls
```

Full suite:

```text
4705 pass
13 skip
8 fail
1 snapshots
11635 expect() calls
Ran 4726 tests across 397 files
```

The 8 full-suite failures are outside the T088 changed surface and reproduce in
their own focused command. The visible causes are missing isolated-home
`config-defaults.json`, watcher notification expectations receiving no pushes,
and pre-existing factory/runtime payload setup issues.

## 9. Build output summary

`bun run electron:build` completed successfully:

- main build completed
- preload build completed
- renderer build completed
- resources/assets build completed
- only Vite chunk-size warnings were emitted

## 10. Remaining risks

- Durable production persistence/concurrency remains outside T088.
- `failed` and `cancelled` are schema-supported terminal states, but current
  scheduler flows do not emit all of them yet.
- Full `ExperienceRuntimeStore` decomposition is deferred.
- Full `bun test` remains blocked by 8 unrelated existing failures listed
  above.
- No real provider validation was run by design; T088 remains fake-provider-safe.
- Electron app launch/screenshot proof was not part of this narrow lifecycle
  contract ticket.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Vocabulary fixed | Done | Shared lifecycle contract + worklog |
| Launch status aligned to queued | Done | Deep Missions + runtime tests |
| Scheduler events project to canonical status | Done | Shared + server-core tests |
| Mission Control finalization guard strict | Done | Renderer test |
| Paid/elapsed bypass still blocked | Done | Existing `ExperienceRuntimeStore` finalization regressions |
| Targeted validation passes | Done | `37 pass, 0 fail` |
| Broad validation passes or blocker recorded | Done with unrelated blocker | Full `bun test` blocker recorded |
| Commit exists | Done | Lore commit for T088 |
