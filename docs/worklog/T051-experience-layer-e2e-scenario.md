# T051 - Experience Layer E2E Scenario

## Task summary

Implement a deterministic fake end-to-end Experience Layer scenario that creates a mission, selects agents, launches a fake run, advances a checkpoint, accepts a swarm contribution, passes validation gates, records audit/ledger evidence, and completes quest progress without real LLM, billing, storage, browser, marketplace, or scheduler providers.

## Repo context discovered

- Shared Experience Layer models live in `packages/shared/src/workbench/experience-layer.ts`.
- Fake long-running checkpoint execution lives in `packages/shared/src/workbench/mission-scheduler-adapter.ts`.
- Swarm contribution dedupe/scoring lives in `packages/shared/src/workbench/swarm-signal-processor.ts`.
- Shared exports are collected in `packages/shared/src/workbench/index.ts`.
- Existing shared tests use `bun:test` and colocated `packages/shared/src/workbench/__tests__/*.test.ts`.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/mission-scheduler-adapter.ts`
- `packages/shared/src/workbench/swarm-signal-processor.ts`
- `packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts`
- `packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts`
- `packages/shared/src/workbench/index.ts`

## Tests added first

- `packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts`

## Expected failing test output

- `bun test packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts`
- Failed as expected because `../experience-layer-e2e-scenario` did not exist:
  - `error: Cannot find module '../experience-layer-e2e-scenario'`

## Implementation changes

- Added `packages/shared/src/workbench/experience-layer-e2e-scenario.ts`.
- Exported the new scenario runner from `packages/shared/src/workbench/index.ts`.
- Implemented a deterministic fake scenario that:
  - launches the fake mission scheduler;
  - advances the 6h checkpoint;
  - accepts an evidence-backed swarm contribution;
  - records pass gate results;
  - computes VDI;
  - completes quest progress with artifact/gate evidence;
  - records audit and ledger evidence;
  - reports zero real provider calls.

## Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts`
- `bun run typecheck:shared`
- `bun run lint:shared`
- `bun run validate:agent-contract`

## Passing test output summary

- Targeted shared test suite: 12 pass, 0 fail.
- Shared typecheck: passed.
- Shared lint: passed.
- Agent contract validation: passed.

## Build output summary

- No runtime build was required because T051 only adds shared pure scenario logic and tests.
- Shared TypeScript validation passed via `bun run typecheck:shared`.
- Build surface is unchanged.

## Remaining risks

- This is a service-level fake E2E scenario, not a browser-routed Playwright journey. Browser routing can be added after the app shell exposes committed routes for these new surfaces.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Fake mission scenario creates mission and selected agents | Pass | `runFakeExperienceLayerScenario()` creates the fake mission and evidence chain from deterministic fixtures. |
| Fake scheduler advances checkpoint deterministically | Pass | Test asserts repeated scenario runs produce identical checkpoint events. |
| Swarm contribution is accepted with evidence | Pass | Test asserts accepted contribution ledger event with `artifact:mission-run-1-signal-1`. |
| Validation gate passes with evidence | Pass | Scenario emits `schema` and `logic_check` pass gate results with evidence refs. |
| Quest progress completes with artifact/gate evidence | Pass | Test asserts completed quest progress with artifact and gate refs. |
| Audit and ledger assertions included | Pass | Test asserts audit sequence and XP/unlock ledger evidence. |
| No real LLM/billing/storage/browser/marketplace providers called | Pass | Test asserts all external provider call counters are zero. |
| Tests pass | Pass | Targeted shared test suite: 12 pass, 0 fail. |
| Validation commands pass | Pass | `typecheck:shared`, `lint:shared`, and `validate:agent-contract` passed. |
| Scoped commit exists | Pass | `d78ade7` |
