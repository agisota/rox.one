# T050 - Swarm Signal Processor

## Task summary

Implement the Swarm Signal Processor from the Experience Layer PRD.

## Reformulated task

Create deterministic shared logic for:

- duplicate claim clustering
- accepted contribution creation
- XP ledger events for accepted evidence-backed contributions
- unsupported claim penalty
- minority report retention

## Assumptions and boundaries

- This ticket is pure shared logic, not real swarm execution.
- Unsupported claims are rejected and penalized.
- Duplicate clusters keep one contribution with a reduced uniqueness score.
- XP ledger events require evidence-backed accepted contributions.
- Minority reports are retained when evidence-backed and severe.
- No real LLM, scheduler, billing, storage, browser, or external provider is called.

## ERD / schema view

```text
SwarmSignal[]
  -> clusters[]
  -> Contribution[]
  -> ProgressLedger[]
  -> minorityReports[]
  -> noisePenalty
```

## Sequence diagram

```text
Signals arrive
  -> normalize claims
  -> cluster duplicates
  -> reject unsupported claims
  -> create accepted contributions
  -> create XP ledger events
  -> retain severe evidence-backed minority reports
```

## Component / screen map impact

- Adds shared `swarm-signal-processor`.
- No renderer screen changes.
- Exports processor through `packages/shared/src/workbench/index.ts`.

## Repo context discovered

- T041 shared models define `Contribution`, `ProgressLedger`, severities, and evidence requirements.
- Shared tests use Bun and direct module imports.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts`

## Tests added first

- `packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts`
  - verifies duplicate claims are clustered deterministically
  - verifies accepted evidence-backed contributions create XP ledger events
  - verifies unsupported claims are rejected and penalized
  - verifies evidence-backed severe minority reports are retained

## Expected failing test output

Initial TDD run failed before implementation because the shared module did not exist:

```text
Cannot find module '../swarm-signal-processor'
```

## Implementation changes

- Added shared `packages/shared/src/workbench/swarm-signal-processor.ts`.
- Added deterministic claim normalization and duplicate clustering.
- Added contribution creation with uniqueness score, accepted/rejected state, unsupported-claim rejection, and resulting artifact references.
- Added XP ledger event creation for accepted evidence-backed contributions.
- Added noise penalty for unsupported claims.
- Added severe evidence-backed minority report retention.
- Exported the processor from `packages/shared/src/workbench/index.ts`.

## Validation commands run

- `bun test packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts` - passed.
- `bun run typecheck:shared` - passed.
- `bun run lint:shared` - passed.
- `bun run validate:agent-contract` - passed.

## Passing test output summary

```text
bun test packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts packages/shared/src/workbench/__tests__/mission-scheduler-adapter.test.ts packages/shared/src/workbench/__tests__/experience-layer.test.ts
15 pass
0 fail
66 expect() calls
```

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 42 tickets, 7 required docs
```

## Build output summary

No renderer/runtime build surface was changed. Shared typecheck and lint passed.

## Remaining risks

- Clustering is deterministic text normalization, not semantic embedding clustering.
- XP amount is fixed by severity and should be revisited when the product economy is finalized.
- Live swarm execution and agent-run persistence are intentionally out of scope.

## Acceptance criteria matrix

- [x] Duplicate claims clustered.
- [x] Accepted contribution increments XP.
- [x] Unsupported claim penalized.
- [x] Minority report retained.
- [x] Shared targeted tests pass.
- [x] Relevant broader validation passes.
- [ ] Scoped commit exists.
