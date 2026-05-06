# T082 - E2E Experience Journey

## 1. Task summary

Доказать полный Experience journey через общий runtime truth layer: действия пользователя должны проходить через typed events, replayable state, fake-provider-safe mission/scheduler/arena flow, evidence-backed VDI/quests and final deliverable verification.

## 2. Repo context discovered

- `scripts/e2e-core-scenarios.ts` already runs a fake-provider core suite, but it does not include the new `ExperienceRuntimeStore` journey.
- `scripts/validate-e2e-core-scenarios.ts` validates the E2E suite contract and fake provider guardrails.
- `packages/shared/src/workbench/experience-layer-e2e-scenario.ts` contains an older deterministic fake scenario around scheduler, swarm signals, VDI, quest progress, and audit events.
- T074-T081 added runtime events, selectors, mission mode prompt contracts, provider-gateway fake execution, global HUD feedback, and UI polish primitives.

## 3. Files inspected

- `scripts/e2e-core-scenarios.ts`
- `scripts/validate-e2e-core-scenarios.ts`
- `packages/shared/src/workbench/experience-layer-e2e-scenario.ts`
- `packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/mission-mode-prompt-registry.ts`
- `packages/shared/src/workbench/experience-layer.ts`

## 4. Tests added first

- Extend `experience-layer-e2e-scenario.test.ts` with a full runtime journey assertion:
  - raw prompt -> rewritten prompt -> spec -> TDD -> review gate
  - 24h deep mission draft/launch
  - checkpoint artifact/evidence
  - VDI update only after evidence/gate pass
  - Arena projections share the same truth
  - trusted package install/fork
  - final verified deliverable
  - deterministic replay and zero real provider calls

## 5. Expected failing test output

Red run target:

```text
Export named 'runExperienceRuntimeJourneyScenario' not found in module .../experience-layer-e2e-scenario.ts
```

Observed red run:

```text
0 pass
1 fail
SyntaxError: Export named 'runExperienceRuntimeJourneyScenario' not found in module .../experience-layer-e2e-scenario.ts
```

## 6. Implementation changes

- Added `runExperienceRuntimeJourneyScenario` to the shared Experience E2E scenario module.
- The scenario dispatches replayable `ExperienceEvent` records for raw prompt, rewrite, spec, TDD plan, review warning, mission draft/launch, checkpoint artifact, gate pass, checkpoint completion, final artifact, VDI update, swarm arena branch, trusted package install, package fork, and final mission verification.
- The scenario uses `ExperienceRuntimeStore` with `createInMemoryExperiencePersistenceAdapter` and verifies `replayExperienceEvents(adapter.events)` reconstructs the same final state.
- Added deterministic provider-call summary with zero external calls across browser, billing, LLM, marketplace, scheduler, shortlink, and storage.
- Added Command/Game/Arena projection truth comparison to prove presentation modes do not mutate runtime truth differently.
- Added deduped swarm signal evidence through `processSwarmSignals`.
- Added `experience-runtime-journey` to `scripts/e2e-core-scenarios.ts`.
- Updated `scripts/validate-e2e-core-scenarios.ts` so the E2E contract fails if the runtime journey scenario is removed.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts`
- `bun run validate:e2e-core-scenarios`
- `bun run e2e:core`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted Experience E2E test: `5 pass`, `0 fail`, `24 expect() calls`.
- `bun run validate:e2e-core-scenarios`: pass.
- `bun run e2e:core`: pass, `5` core scenarios:
  - `composer-artifacts`: pass
  - `experience-runtime-journey`: pass
  - `account-team-billing-storage`: pass
  - `server-smoke`: pass
  - `electron-startup-smoke`: pass

## 9. Build output summary

- `bun run typecheck:all`: pass after fixing mutable `requiredGateIds` typing in the scenario fixture.
- `bun run validate:docs`: pass.
- `bun run lint`: pass with three pre-existing React hook dependency warnings outside T082 scope.
- `bun run electron:build`: pass with pre-existing renderer chunk-size warnings.
- `git diff --check`: pass.

## 10. Remaining risks

- This T082 proof is a deterministic shared/runtime E2E scenario plus Electron startup smoke. It does not yet drive every Experience route through a real browser automation click path; final visual/manual evidence remains for T087.
- The app shell HUD still uses the current in-memory empty runtime wiring from T080 until a broader persisted renderer runtime provider is introduced.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Full fake-provider Experience journey covered | Pass | `runExperienceRuntimeJourneyScenario` + test |
| Core E2E runner includes journey | Pass | `experience-runtime-journey` scenario |
| E2E contract validator requires journey | Pass | `validate-e2e-core-scenarios.ts` |
| No real provider calls | Pass | Provider call summary assertions |
| Worklog complete | Pass | This file |
| Commit exists | Pending | Scoped Lore commit |
