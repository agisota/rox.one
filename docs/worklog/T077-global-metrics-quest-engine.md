# T077 - Global VDI / Quality / Readiness / Quest Engine

## 1. Task summary

Сделать VDI, Quality, Readiness и quest progression общим runtime-слоем, который выводится из Experience events и доказательств, а не из локальных декоративных fixtures.

## 2. Repo context discovered

- `packages/shared/src/workbench/experience-runtime-store.ts` уже содержит typed events, replay reducer, metric snapshots и persistence adapter seam.
- `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts` читает `metricSnapshots` из `ExperienceTruthState`, но дефолтные данные остаются локальными.
- `apps/electron/src/renderer/components/workbench/quest-map-state.ts` содержит локальный короткий quest graph из 3 квестов, не полный обязательный граф T077.
- `QuestMapSkillTree` и `ProgressionObservatory` уже принимают `truthState`, поэтому интеграция может быть сделана через общий shared engine без изменения presentation truth.

## 3. Files inspected

- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/index.ts`
- `apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx`
- `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts`
- `apps/electron/src/renderer/components/workbench/QuestMapSkillTree.tsx`
- `apps/electron/src/renderer/components/workbench/quest-map-state.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx`

## 4. Tests added first

- Shared runtime test for required ROX quest graph titles and deterministic progression under replay.
- Renderer quest map test that requires all required quest graph nodes to be visible from shared state.

## 5. Expected failing test output

Red run:

```text
SyntaxError: Export named 'EXPERIENCE_QUEST_GRAPH' not found in module
packages/shared/src/workbench/experience-runtime-store.ts

SyntaxError: Export named 'EXPERIENCE_QUEST_GRAPH' not found in module
packages/shared/src/workbench/index.ts
```

## 6. Implementation changes

- Added shared `EXPERIENCE_QUEST_GRAPH` with the full required 14-node ROX quest chain.
- Added runtime quest projection in `ExperienceRuntimeStore` so replayed typed events derive quest progress deterministically.
- Kept quest completion evidence-bound through `QuestProgressSchema`; inferred completions always carry `artifact:` or `gate:` evidence refs.
- Kept paid entitlement capacity-only; metric snapshots still require evidence and active mission truth.
- Replaced the local 3-item Quest Map fixture with the shared graph and Russian-first labels/descriptions.
- Updated real-state binding fixture to use the shared quest id so Command/Game/Arena presentation still reads the same truth.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts apps/electron/src/renderer/components/workbench/__tests__/quest-map-skill-tree.test.tsx`
- `bun test packages/shared/src/workbench apps/electron/src/renderer/components/workbench`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted T077 tests: `10 pass`, `0 fail`.
- Workbench shared + renderer subset: `176 pass`, `0 fail`, `1 snapshots`, `920 expect() calls`.
- `typecheck:all`: passed.

## 9. Build output summary

- `electron:build`: passed. Existing renderer bundle-size warnings remain non-fatal.
- `lint`: passed with existing React hook warnings in `App.tsx` and `FreeFormInput.tsx`; no lint errors.
- `validate:docs`: passed after adding the required `Status: DONE` line to the ticket.
- `git diff --check`: passed.

## 10. Remaining risks

- `quest-resolve-blocker` and `quest-share-verified-session` remain graph nodes until T084/T086 add concrete share/security event contracts.
- Runtime quest inference currently covers prompt/spec/TDD/review/mission/checkpoint/finalization/agent install/fork events; future share provider events should map into the same engine instead of adding local UI state.
- Existing lint warnings unrelated to T077 remain in `App.tsx` and `FreeFormInput.tsx`.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Progress and Quest Map reflect real app actions | Pass | Runtime events derive quest progress; Quest Map reads `EXPERIENCE_QUEST_GRAPH` |
| Gamification is not cosmetic | Pass | Shared reducer projects quest progress and metric snapshots from evidence-bearing events |
| Quest completion requires evidence | Pass | Targeted tests and `QuestProgressSchema` reject unsupported evidence |
| Paid capacity does not increase VDI | Pass | Existing runtime and progression tests remain passing |
| Worklog complete | Pass | This file |
| Commit exists | Pending | Pending commit |
