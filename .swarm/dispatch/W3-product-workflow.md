# Dispatch Packet: W3 Product Workflow

Phase: `EXECUTE`

Tickets: `T013-review-board`, `T014-validation-gates-engine`, `T015-multi-agent-pipeline-planner`, `T016-automation-presets`

## Objective

Move the existing shared product-workflow engines from `PARTIAL_CORE` to integrated user-visible flows without rewriting the already tested core modules.

## Current Evidence

- `T013`: `packages/shared/src/workbench/review-board.ts` and `review-board.test.ts` exist; `artifact-screen-state.ts` already consumes review-board logic.
- `T014`: `packages/shared/src/workbench/validation-gates.ts` and `validation-gates.test.ts` exist.
- `T015`: `packages/shared/src/workbench/agent-pipeline-planner.ts` and `agent-pipeline-planner.test.ts` exist.
- `T016`: `packages/shared/src/automations/presets.ts` and `automation-presets.test.ts` exist.

## Write Scope

- `apps/electron/src/renderer/components/workbench/**`
- `packages/shared/src/workbench/**`
- `packages/shared/src/automations/**`
- matching tests under `__tests__`
- `docs/worklog/T013-*`, `T014-*`, `T015-*`, `T016-*`
- `docs/tickets/T013-*`, `T014-*`, `T015-*`, `T016-*`

Shared files such as route registries, package exports, and global CSS are single-owner within this lane.

## Forbidden Scope

- No real LLM/API calls.
- No account/cloud/storage changes.
- No broad redesign of the Experience Layer visuals.
- Do not weaken existing shared tests.

## Required TDD

1. `T014`: red integration test for gate execution using real evidence records, not elapsed time.
2. `T013`: red UI/component or smoke test for structured review result rendering and persistence/handoff.
3. `T015`: red integration test for turning a spec/task into an executable pipeline plan visible to launcher/orchestrator code.
4. `T016`: red integration test for selecting/applying automation presets and saving a valid automation config.

## Expected Red Output

The first run should fail because current modules are mostly pure core engines and lack the consumer flow or persistence/route wiring required by acceptance.

## Validation Commands

- `bun test packages/shared/src/workbench/__tests__/review-board.test.ts packages/shared/src/workbench/__tests__/validation-gates.test.ts packages/shared/src/workbench/__tests__/agent-pipeline-planner.test.ts`
- `bun test packages/shared/src/automations/automation-presets.test.ts`
- targeted renderer tests for any changed workbench components
- `bun run typecheck:shared`
- `bun run typecheck:electron` when renderer code changes
- `bun run validate:agent-contract`
- `git diff --check`

## Acceptance

- Review Board has an integrated user-visible flow with structured findings, severity, evidence, and fix plan.
- Validation Gates consume actual evidence records and cannot be bypassed by paid capacity or elapsed time.
- Pipeline Planner has a launcher/orchestrator consumer that can display or execute the plan deterministically with fakes.
- Automation presets can be selected/applied through a consumer flow and produce valid automation config.
- Worklogs and ticket statuses are updated only after tests pass.
