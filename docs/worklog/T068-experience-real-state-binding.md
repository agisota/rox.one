# T068 - Experience Layer Real-State Binding

## 1. Task summary

Bind the Experience Layer UI surfaces to one shared truth-state contract after
T066 durable scheduler and T067 provider gateway introduced stable runtime
seams.

## 2. Repo context discovered

- `packages/shared/src/workbench/experience-layer.ts` already owns mission,
  checkpoint, quest, package, metric, ledger, entitlement, and presentation
  schemas.
- `packages/shared/src/workbench/mission-scheduler-adapter.ts` owns a
  deterministic fake scheduler state, but UI screens currently use separate
  local demo-state factories.
- Experience screens already accept `initialState` props, which gives T068 a
  low-risk path: add `truthState` props and shared projection helpers without
  removing deterministic fallbacks.
- `MissionControlRunDetail`, `ProgressionObservatory`, `QuestMapSkillTree`,
  `AgentForgeTeamRegistry`, `ArenaBuilderScreen`, and `DeepMissionsScreen`
  are the key UI surfaces.

## 3. Files inspected

- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`
- `packages/shared/src/workbench/index.ts`
- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts`
- `apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx`
- `apps/electron/src/renderer/components/workbench/quest-map-state.ts`
- `apps/electron/src/renderer/components/workbench/QuestMapSkillTree.tsx`
- `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`
- `apps/electron/src/renderer/components/workbench/AgentForgeTeamRegistry.tsx`
- `apps/electron/src/renderer/components/workbench/arena-builder-state.ts`
- `apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx`
- `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`
- `apps/electron/src/renderer/components/workbench/DeepMissionsScreen.tsx`

## 4. Tests added first

- `packages/shared/src/workbench/__tests__/experience-state-binding.test.ts`
  - proves Command/Game/Arena projections use the same mission truth.
  - proves presentation mode cannot mutate validation/evidence/ledger semantics.
  - proves checkpoint and metric snapshots must belong to the selected mission.
  - proves completed quests require artifact/gate evidence.
  - proves paid entitlement ledger entries do not raise VDI.
- `apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`
  - proves Mission Control renders checkpoint truth updates.
  - proves Progression Observatory reads metric snapshots from truth.
  - proves Quest Map reads quest progress from evidence-backed truth.
  - proves Agent Forge respects package visibility/trust state.
  - proves every affected screen still renders deterministic fallback state when
    no truth state is supplied.

## 5. Expected failing test output

The tests were run before implementation and failed for the expected missing
module/export reason:

```text
packages/shared/src/workbench/__tests__/experience-state-binding.test.ts:
error: Cannot find module '../experience-state'

apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx:
SyntaxError: Export named 'createExperienceTruthState' not found in module
packages/shared/src/workbench/index.ts

0 pass
2 fail
```

## 6. Implementation changes

- Added `packages/shared/src/workbench/experience-state.ts` with
  `ExperienceTruthStateSchema`, `createExperienceTruthState`, and
  `projectExperienceTruthView`.
- Exported the shared truth-state helpers from
  `packages/shared/src/workbench/index.ts`.
- Added screen-specific projection helpers:
  - `createMissionControlStateFromTruth`
  - `createProgressionStateFromTruth`
  - `createQuestMapStateFromTruth`
  - `createAgentForgeStateFromTruth`
  - `createArenaBuilderStateFromTruth`
  - `createDeepMissionEntryStateFromTruth`
- Added optional `truthState` props to:
  - `MissionControlRunDetail`
  - `ProgressionObservatory`
  - `QuestMapSkillTree`
  - `AgentForgeTeamRegistry`
  - `ArenaBuilderScreen`
  - `DeepMissionsScreen`
- Kept existing deterministic fallback factories intact for no-runtime/demo
  rendering and test stability.
- Preserved the invariant that Command/Game/Arena changes presentation only;
  evidence, gates, ledger, and VDI semantics remain immutable shared truth.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-state-binding.test.ts apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`
- `bun test packages/shared/src/workbench/__tests__/experience-layer.test.ts packages/shared/src/workbench/__tests__/experience-layer-security.test.ts packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx`
- `bun run validate:docs`
- `bun run typecheck:all`
- `bun test`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted T068 tests: `6 pass`, `0 fail`, `43 expect() calls`.
- Broader Experience regression set: `47 pass`, `0 fail`,
  `172 expect() calls`.
- Full repository test run: `4667 pass`, `13 skip`, `0 fail`,
  `1 snapshot`, `11880 expect() calls`, `4680 tests across 392 files`.
- Docs validation passed with `11 skills`, `70 tickets`, and all required
  architecture/sync/release docs present.
- Typecheck passed.
- `git diff --check` passed.

## 9. Build output summary

`bun run electron:build` passed after rebuilding main, preload, renderer,
resources, and assets. The build still emits existing Vite chunk-size warnings
and deprecated Jotai Babel plugin warnings; no T068 build failure was produced.

## 10. Remaining risks

- UI surfaces are now able to render shared mission truth, but live backend
  subscription and full mission-store event wiring remain T072 RC scope.
- Existing deterministic fallback state remains intentionally available; T069
  should polish the visual presentation without creating a second truth source.
- T068 does not introduce real provider calls; provider orchestration remains
  behind the T067 gateway contract.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Shared `ExperienceTruthState` tests pass | PASS | Targeted T068 shared tests passed. |
| UI real-state binding tests pass | PASS | Targeted T068 UI tests passed. |
| Fallback state still renders | PASS | UI tests cover fallback renders for all affected screens. |
| Worklog complete | PASS | This worklog records discovery, red output, implementation, validation, build, and risks. |
| Scoped commit exists | PASS | Commit created after validation. |
