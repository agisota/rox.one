# T076 - Mission Control Live Scheduler Binding

## 1. Task summary

Подключить "Центр миссий" к runtime truth: launched mission должна
появляться из `ExperienceRuntimeState`, а checkpoint completion должен идти
через `ExperienceRuntimeStore` events с artifact/gate/ledger/audit evidence.

## 2. Repo context discovered

- `mission-control-state.ts` уже умеет строить UI state из
  `ExperienceTruthState`, но не принимает `ExperienceRuntimeState` напрямую.
- `transitionMissionCheckpoint()` локально меняет checkpoint state и пишет
  hardcoded `2026-04-30T00:00:00.000Z`, что не подходит для runtime mutation.
- `MissionControlRunDetail.tsx` пока вызывает локальный
  `transitionMissionCheckpoint()`; T076 начинает с runtime-safe state helpers,
  а полное screen action wiring должно оставаться через shared helper rather
  than direct presentation mutation.
- T074 `ExperienceRuntimeStore` already persists events through an adapter and
  rejects mission finalization without artifact/gate evidence.

## 3. Files inspected

- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`

## 4. Tests added first

Added failing tests to
`apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
before implementation.

Coverage:

- launched mission appears in Mission Control from `ExperienceRuntimeState`
- checkpoint completion persists artifact/gate/checkpoint/ledger events through
  `ExperienceRuntimeStore`
- duplicate checkpoint completion remains idempotent through stable event ids
- runtime finalization remains blocked without final artifact and gate evidence

## 5. Expected failing test output

Red state before implementation:

```text
SyntaxError: Export named 'completeMissionCheckpointThroughRuntime' not found in module
apps/electron/src/renderer/components/workbench/mission-control-state.ts
0 pass
1 fail
```

## 6. Implementation changes

- Added `createMissionControlStateFromRuntime()` to derive Mission Control from
  `ExperienceRuntimeState` via shared `selectActiveExperienceTruthState()`.
- Added `completeMissionCheckpointThroughRuntime()` runtime action helper.
- Runtime checkpoint completion now dispatches stable-id events for:
  `artifact.created`, `gate.passed`, `mission.checkpoint.completed`, and
  `ledger.entry.recorded`.
- Duplicate checkpoint execution is idempotent because event ids are stable and
  `ExperienceRuntimeStore` ignores already-processed event ids.
- Kept existing local `transitionMissionCheckpoint()` for legacy fixture tests,
  but T076 runtime path no longer depends on local-only mutation.

## 7. Validation commands run

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx
-> initial FAIL, missing runtime checkpoint helper export
-> PASS, 8 pass, 0 fail

bun test apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx
-> PASS, 19 pass, 0 fail

bun test packages/shared/src/workbench
-> PASS, 104 pass, 0 fail

bun run validate:docs
-> PASS

bun run typecheck:all
-> PASS

git diff --check
-> PASS

bun run lint
-> PASS with existing React hook dependency warnings in App.tsx and FreeFormInput.tsx

bun run electron:build
-> PASS
```

## 8. Passing test output summary

```text
Mission Control run detail:
8 pass, 0 fail

Renderer Experience integration subset:
19 pass, 0 fail

packages/shared/src/workbench:
104 pass, 0 fail
```

## 9. Build output summary

`bun run electron:build` completed successfully. Vite reported existing large
chunk warnings; build exited 0.

## 10. Remaining risks

- Broad `bun test` baseline remains blocked by the pre-existing
  `apps/cli/src/client.test.ts` WSS/TLS fixture failure recorded in T074.
- T076 is scoped to Mission Control runtime binding; provider orchestration and
  mission mode prompt contracts remain T079.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Launched mission appears in Mission Control | Done | `mission-control-run-detail.test.tsx` |
| Checkpoint completion updates truth | Done | `mission-control-run-detail.test.tsx` |
| Duplicate checkpoint execution idempotent | Done | `mission-control-run-detail.test.tsx` |
| Pending approval blocks expensive branch | Done | Existing test |
| Blocking security gate prevents final pass | Done | Existing test |
| Finalization requires final artifact and gates | Done | `mission-control-run-detail.test.tsx` |
| Audit trail records state changes | Done | `mission-control-run-detail.test.tsx` |
| Worklog complete | Done | This file |
| Commit exists | Done | Scoped Lore commit on `mac/rox-production-ready-rc` |
