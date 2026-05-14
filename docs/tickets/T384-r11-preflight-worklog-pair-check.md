# T384 - R.11 preflight worklog pair check

Status: DONE

## Context

The report-only R.11 preflight checks the exact
`docs/tickets/T298-rebrand-git-history-rewrite.md` ticket path, but it does not
check the matching `docs/worklog/T298-rebrand-git-history-rewrite.md` path.
The rebrand goal requires ticket and worklog evidence for closeout.

## Goal

Make the R.11 preflight fail closed unless both exact R.11 closeout artifacts
exist: the ticket and the matching 11-section worklog.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Update `scripts/rebrand-r11-preflight.ts` and its test so the report-only gate
checks the exact R.11 closeout worklog path.

## Required Subagents

None.

## TDD Requirements

Add the failing evaluator test first. Confirm it fails because the current
preflight ignores the worklog presence signal.

## Implementation Requirements

- Add a `r11CloseoutWorklogPresent` prerequisite to the R.11 preflight
  snapshot.
- Report it as its own preflight row.
- Collect it from
  `docs/worklog/T298-rebrand-git-history-rewrite.md`.
- Keep the preflight report-only; do not create refs, mirrors, rewritten
  history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before implementation.
- [x] Regression test passes after implementation.
- [x] Preflight has a distinct R.11 closeout worklog row.
- [x] Live default preflight still fails only on the active goal.
- [x] Live pre-rewrite preflight still fails on missing backup artifacts.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T384-r11-preflight-worklog-pair-check.md`.
