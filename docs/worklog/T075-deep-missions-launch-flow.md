# T075 - Deep Missions Real Form + Launch Flow

## 1. Task summary

Сделать экран "Долгие миссии" реальной формой создания миссии: editable draft,
draft persistence, launch через общий `ExperienceRuntimeStore`, fake-safe
scheduler seam и честные UI состояния.

## 2. Repo context discovered

- `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`
  содержит preset model, validation и checkpoint preview, но не создает launch
  events и не имеет persistence/scheduler seam.
- `DeepMissionsScreen.tsx` показывает миссию как read-only brief; кнопки
  `onSaveDraft` / `onLaunchMission` получают локальный state, но экран не
  содержит настоящих editable controls для всех полей.
- T074 добавил `ExperienceRuntimeStore`, deterministic replay и persistence
  adapter; T075 должен использовать его как единственный truth вход для
  `mission.drafted` и `mission.launched`.
- `packages/shared/src/workbench/mission-scheduler-adapter.ts` уже содержит
  deterministic fake scheduler behavior for checkpoint execution, но launch
  seam для Deep Missions draft еще отсутствует.

## 3. Files inspected

- `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`
- `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`
- `packages/shared/src/workbench/experience-layer.ts`

## 4. Tests added first

Added failing tests to
`apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
before T075 implementation.

Coverage:

- editable form fields render with Russian labels
- empty form cannot launch
- invalid budget cannot launch
- valid launch persists a draft and emits `mission.drafted` +
  `mission.launched`
- scheduler seam is invoked deterministically
- launch keeps mission running and does not finalize it
- runtime finalization without artifact/gate evidence is rejected

## 5. Expected failing test output

Red state before implementation:

```text
SyntaxError: Export named 'createFakeDeepMissionSchedulerAdapter' not found in module
apps/electron/src/renderer/components/workbench/deep-missions-state.ts
0 pass
1 fail
```

## 6. Implementation changes

- Added launch/persistence/scheduler contracts in
  `deep-missions-state.ts`:
  `DeepMissionDraftPersistenceAdapter`, `DeepMissionSchedulerAdapter`,
  fake deterministic adapters, and `createDeepMissionLaunchPlan()`.
- Added launch event generation for `mission.drafted` and
  `mission.launched`; both dispatch through `ExperienceRuntimeStore`.
- Added deterministic mission/checkpoint materialization from the editable
  draft and injected clock.
- Added launch state model: `empty`, `invalid`, `ready`, `launching`,
  `launched`, `blocked`, `failed`.
- Converted `DeepMissionsScreen` brief area from read-only cards to editable
  Russian-first form fields for title, objective, raw input, mode, layer,
  duration, cadence, budget cap, token cap, storage cap, agent count, and VDI
  target.
- Kept launch fake-safe: tests use in-memory draft persistence, fake scheduler,
  and in-memory runtime persistence only.

## 7. Validation commands run

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx
-> initial FAIL, missing T075 launch/scheduler exports
-> PASS, 7 pass, 0 fail

bun test apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx
-> PASS, 16 pass, 0 fail

bun test packages/shared/src/workbench
-> PASS, 104 pass, 0 fail

bun run validate:docs
-> PASS

bun run typecheck:all
-> initial FAIL on missing typed checkpoints in a test event and stale status omit signature
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
Deep Missions entry screen:
7 pass, 0 fail

Renderer Experience integration subset:
16 pass, 0 fail

packages/shared/src/workbench:
104 pass, 0 fail
```

## 9. Build output summary

`bun run electron:build` completed successfully after renderer changes. Vite
reported existing large chunk warnings; build exited 0.

## 10. Remaining risks

- Broad `bun test` baseline remains blocked by the pre-existing
  `apps/cli/src/client.test.ts` WSS/TLS fixture failure recorded in T074.
- T075 can make launch real, but Mission Control live scheduler binding remains
  T076.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Empty form cannot launch | Done | `deep-missions-screen.test.tsx` |
| Invalid budget cannot launch | Done | `deep-missions-screen.test.tsx` |
| Valid form emits draft and launch events | Done | `deep-missions-screen.test.tsx` |
| Preset changes duration/cadence/agent count | Done | Existing test |
| Launch does not complete mission | Done | `deep-missions-screen.test.tsx` |
| Final success requires evidence | Done | `deep-missions-screen.test.tsx` |
| UI states render correctly | Done | `deep-missions-screen.test.tsx` |
| Worklog complete | Done | This file |
| Commit exists | Done | Scoped Lore commit on `mac/rox-production-ready-rc` |
