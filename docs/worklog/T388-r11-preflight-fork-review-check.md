# T388 - R.11 preflight fork review check

Status: IN PROGRESS
Phase: R.11 preflight hardening
Ticket: docs/tickets/T388-r11-preflight-fork-review-check.md

## 1. Task summary

Add the R.11 fork-review prerequisite to the report-only preflight so it fails
closed when the GitHub fork count differs from the operator's expected count.

## 2. Repo context discovered

The R.11 runbook requires:

```text
No third-party forks expected to upstream. Confirm by listing
gh api repos/agisota/rox-one-terminal/forks and checking the count is what you
expect.
```

T298 had manually recorded fork count `0`, but the executable preflight did not
check forks.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`

## 4. Tests added first

Added evaluator coverage proving:

- a fork count mismatch fails the preflight;
- the all-blockers report includes a distinct `fork-review` failure row.

## 5. Expected failing test output

Initial RED run:

```text
Expected: false
Received: true
(fail) evaluateR11Preflight > fails closed when the fork count does not match the expected count

Expected length: 9
Received length: 8
(fail) evaluateR11Preflight > reports every blocker instead of stopping after the first red check
```

The failure confirmed the evaluator ignored fork-count mismatches.

## 6. Implementation changes

- Added `forkCount`, `expectedForkCount`, and `forkReviewError` to
  `R11PreflightSnapshot`.
- Added a distinct `fork-review` result row.
- Collected live fork count via
  `gh api repos/agisota/rox-one-terminal/forks --jq length`.
- Defaulted expected forks to `0`.
- Added `ROX_R11_EXPECTED_FORKS=<n>` override for future operator-approved
  backup fork scenarios.
- Failed closed on fork query errors and invalid expected-forks values.
- Did not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`

## 8. Passing test output summary

Targeted test after implementation:

```text
10 pass
0 fail
30 expect() calls
Ran 10 tests across 1 file.
```

## 9. Build output summary

No build was run yet. This changes the report-only preflight script and test,
not product runtime behavior.

## 10. Remaining risks

R.11 remains blocked. Backup creation, `git filter-repo`, force-push,
post-rewrite validation, and `update_goal` remain unexecuted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before implementation | Green | RED run showed false green and missing blocker count |
| Regression test passes after implementation | Green | Targeted test reports 10 pass, 0 fail |
| Preflight has a distinct fork-review row | Green | `fork-review` row added and tested |
| Live default preflight shows fork-review pass at expected count 0 | Pending | Live preflight not rerun yet |
| Documentation/rebrand validation remains green | Pending | Full docs/rebrand gates not run yet |
| Destructive R.11 actions are not executed | Green | No backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Pending | Commit not created yet |
