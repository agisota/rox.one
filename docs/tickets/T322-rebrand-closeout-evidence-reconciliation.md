# T322 - Rebrand closeout evidence reconciliation

Status: DONE

## Context

After T321 repaired the roadmap coherence validator, the R.10 closeout
evidence still used placeholder wording such as `this closeout commit`
and did not list the T321 commit in the release mapping ledger.

## Goal

Make the rebrand closeout evidence concrete: every R.10 and R.10
follow-up commit in the mapping/worklog must be named by SHA, and the
release mapping must record the T321 roadmap-gate repair.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Add a docs-contract assertion to the R.10 closeout gate test so future
closeout evidence cannot regress to placeholder commit wording.

## Required Subagents

None.

## TDD Requirements

Extend `scripts/__tests__/rebrand-permanent-gate.test.ts` first so it
requires concrete closeout SHAs and T321 evidence. Confirm the test fails
before updating the docs.

## Implementation Requirements

1. Replace placeholder closeout commit wording with concrete SHAs.
2. Record T321 in the closeout phase ledger.
3. Keep T296/T321 worklogs consistent with the evidence.
4. Do not change runtime behavior.

## Validation Commands

- `bun test scripts/__tests__/rebrand-closeout-gates.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `git diff --check`

## Acceptance Criteria

- [x] The new docs-contract test fails before implementation.
- [x] The release mapping includes T321 and `d0b2528`.
- [x] The T296 worklog no longer uses `this closeout commit`.
- [x] Rebrand/docs/agent-contract gates stay green.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T322-rebrand-closeout-evidence-reconciliation.md`.
