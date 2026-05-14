# T388 - R.11 preflight fork review check

Status: DONE

## Context

The R.11 hard prerequisites require a fork review:
`gh api repos/agisota/rox-one-terminal/forks` and confirmation that the fork
count is expected. The report-only preflight currently checks open PRs, tags,
backup artifacts, closeout artifacts, sync, and worktree state, but it does not
check forks.

## Goal

Add a report-only fork-review row to the R.11 preflight. The default expected
fork count is `0`, with an explicit `ROX_R11_EXPECTED_FORKS=<n>` override for
future operator-approved backup fork scenarios.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Update `scripts/rebrand-r11-preflight.ts` and its tests so the preflight checks
the GitHub fork count against the expected value.

## Required Subagents

None.

## TDD Requirements

Add the failing evaluator test first. Confirm it fails because the current
preflight ignores fork-count mismatches.

## Implementation Requirements

- Add `forkCount`, `expectedForkCount`, and `forkReviewError` support to the
  R.11 preflight snapshot.
- Add a distinct `fork-review` report row.
- Collect fork count via
  `gh api repos/agisota/rox-one-terminal/forks --jq length`.
- Default expected forks to `0`; allow `ROX_R11_EXPECTED_FORKS=<n>`.
- Fail closed on fork query errors or invalid expected-forks values.
- Keep the preflight report-only; do not create refs, mirrors, rewritten
  history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before implementation.
- [x] Regression test passes after implementation.
- [x] Preflight has a distinct fork-review row.
- [x] Live default preflight shows fork-review pass at expected count 0.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T388-r11-preflight-fork-review-check.md`.
