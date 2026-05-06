# T074 - Experience Runtime Store + Event Bus

## 1. Task summary

Создать единый runtime truth слой Experience Layer: typed event bus, reducer,
persistence adapter seam, deterministic replay, selectors для экранов и
инварианты evidence/VDI/gate/paid-capacity.

## 2. Repo context discovered

- `packages/shared/src/workbench/experience-layer.ts` уже содержит базовые
  схемы миссий, checkpoints, quests, ledger, metrics и семантические guard'ы:
  paid entitlement не может закрыть validation gate, elapsed time не завершает
  mission без evidence.
- `packages/shared/src/workbench/experience-state.ts` уже умеет строить
  immutable projection для Command/Game/Arena, но принимает готовый truth state,
  а не поток событий.
- Renderer screens уже имеют `create*FromTruth` адаптеры для текущей общей
  truth-модели: Deep Missions, Mission Control, Progression, Quest Map, Arena,
  Agent Forge.
- `packages/server-core/src/persistence/agent-workbench-persistence.ts` уже
  содержит broader persistence contracts для missions, quests, metrics, ledger,
  но T074 нужен renderer/shared-safe adapter seam поверх event replay.
- Baseline `bun test` падает в `apps/cli/src/client.test.ts` на TLS/BoringSSL
  decode error в WSS mock server, до T074 implementation. T074 targeted tests
  должны быть отдельным evidence path.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/release/e2e-integration-plan-2026-05-06.md`
- `docs/release/final-rc-2026-05-06.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/experience-state.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/__tests__/experience-state-binding.test.ts`
- `apps/electron/src/renderer/components/workbench/deep-missions-state.ts`
- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`
- `apps/electron/src/renderer/components/workbench/progression-observatory-state.ts`
- `apps/electron/src/renderer/components/workbench/quest-map-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx`

## 4. Tests added first

Added `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
before implementation.

Coverage:

- typed event reducer updates runtime truth deterministically
- event replay reconstructs the same state
- duplicate event ids are idempotent
- Command/Game/Arena projections share one active mission truth
- paid entitlement updates capacity only, not VDI or gates
- quest completion requires artifact/gate evidence
- gate pass/warn/fail events without evidence do not become truth
- `ExperienceRuntimeStore.dispatch()` writes through persistence adapter
- rehydrated store reconstructs state from persisted snapshot/events

## 5. Expected failing test output

Initial red run:

```text
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
error: Cannot find module '../experience-runtime-store'
0 pass
1 fail
```

After first implementation pass, one test expectation was too order-sensitive:

```text
Expected: "reward"
Received: "success"
3 pass
1 fail
```

The assertion was corrected to require a reward notification to exist rather
than to be last after the ledger event.

## 6. Implementation changes

- Added `packages/shared/src/workbench/experience-runtime-store.ts`.
- Added `ExperienceEvent` typed schema for all required T074 event names:
  prompt, spec, TDD, review, gate, artifact, mission, checkpoint, agent package,
  quest, reward, and ledger events.
- Added `ExperienceRuntimeState` with missions, checkpoints, gates, artifacts,
  metrics, quest progress, ledger, agent packages, unlocks, notifications,
  capacity, active mission, and processed event ids.
- Added pure `replayExperienceEvents()` reducer with duplicate event
  idempotency.
- Added `ExperiencePersistenceAdapter` seam and in-memory fake adapter for
  deterministic tests.
- Added `createExperienceRuntimeStore()` whose dispatch path appends events and
  saves snapshots through the adapter.
- Added selectors:
  `selectActiveExperienceTruthState()` and
  `selectExperienceRuntimeProjection()` for existing Command/Game/Arena
  projection contracts.
- Exported the runtime store from `packages/shared/src/workbench/index.ts`.

## 7. Validation commands run

Baseline:

```text
git status --short --branch -> PASS, dirty pre-existing events.jsonl and .claude/
mise tasks -> PASS, no tasks printed
bun run validate:docs -> PASS
bun run validate:agent-contract -> PASS
bun run typecheck:all -> PASS
bun test -> FAIL, BoringSSL decode error in apps/cli/src/client.test.ts WSS mock server
```

Full baseline wrapper then continued:

```text
bun run electron:build -> PASS
git diff --check -> PASS
```

Targeted T074:

```text
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
-> PASS, 4 pass, 0 fail

bun test packages/shared/src/workbench/__tests__/experience-state-binding.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
-> PASS, 13 pass, 0 fail

bun run typecheck:shared
-> initial FAIL on test helper type extraction for gate events; fixed helper
-> PASS

bun test packages/shared/src/workbench
-> PASS, 104 pass, 0 fail

bun run typecheck:all
-> PASS

bun run validate:docs
-> PASS

bun run lint
-> PASS, existing hook dependency warnings only:
   apps/electron/src/renderer/App.tsx
   apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx

bun run electron:build
-> PASS

git diff --check
-> PASS
```

## 8. Passing test output summary

Current T074 scoped test evidence:

```text
packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts:
4 pass, 0 fail

packages/shared/src/workbench:
104 pass, 0 fail
```

## 9. Build output summary

Baseline `bun run electron:build` passed before T074 changes. Post-change broad
`bun run electron:build` also passed after T074 changes.

## 10. Remaining risks

- Broad baseline test suite has a pre-existing TLS fixture/runtime failure not
  caused by T074. It must remain documented unless fixed in a separate scoped
  ticket.
- T074 can add shared runtime truth and selectors, but full UI launch/control
  flows belong to T075-T080.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Event reducer updates truth deterministically | Done | `experience-runtime-store.test.ts` |
| Replay reconstructs same state | Done | `experience-runtime-store.test.ts` |
| Duplicate events idempotent where required | Done | `experience-runtime-store.test.ts` |
| Command/Game/Arena projections share truth | Done | `experience-runtime-store.test.ts`, existing `experience-state-binding.test.ts` |
| Paid entitlement cannot increase VDI or complete gates | Done | `experience-runtime-store.test.ts` |
| Artifact/gate evidence required for progression | Done | `experience-runtime-store.test.ts` |
| Persistence adapter is not bypassed | Done | `experience-runtime-store.test.ts` |
| Worklog complete | Done | This file |
| Commit exists | Done | Scoped Lore commit on `mac/rox-production-ready-rc` |
