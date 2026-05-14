# T439 - R.11 roadmap ledger validator

Status: DONE

## Context

T438 reconciled the R.9.5 row in `.swarm/master-roadmap-log.md` after the row
listed a phantom T299a ticket. The manual post-fix audit confirmed the current
rebrand ledger rows have matching ticket/worklog artifacts, but the permanent
`bun run validate:roadmap` gate does not yet enforce that `.swarm` ledger
contract.

## Goal

Extend the existing roadmap validator so a future phantom rebrand ledger ticket
or incomplete ticket/worklog shape fails closed before another R.11 audit uses
the ledger as closeout evidence.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- `bun run validate:roadmap` validates `.swarm/master-roadmap-log.md` rebrand
  rows.
- The validator must reject a rebrand ledger ticket with no matching ticket or
  worklog file.
- No R.11 destructive commands are allowed.

## Required Subagents

None. The change is isolated to an existing deterministic validator and test.

## TDD Requirements

- Add a regression that feeds the roadmap validator a malformed copy of the
  `.swarm` log containing `T299a`.
- Confirm the regression fails before implementation because the validator does
  not inspect the `.swarm` ledger yet.

## Implementation Requirements

- Extend `scripts/validate-roadmap-coherence.cjs` instead of adding a parallel
  validator.
- Keep the validator dependency-free.
- Validate only committed rebrand rows, not pending non-rebrand roadmap rows.
- Validate ticket file existence, worklog file existence, `Status: DONE`, and
  the 11-section worklog shape.

## Validation Commands

- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts`
- `bun run validate:roadmap`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED regression fails against a malformed `.swarm` rebrand ledger copy.
- [x] `bun run validate:roadmap` rejects missing rebrand ledger ticket/worklog
  artifacts.
- [x] Current `.swarm/master-roadmap-log.md` passes the extended validator.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
