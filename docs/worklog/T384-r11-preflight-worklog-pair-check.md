# T384 - R.11 preflight worklog pair check

Status: IN PROGRESS
Phase: R.11 preflight hardening
Ticket: docs/tickets/T384-r11-preflight-worklog-pair-check.md

## 1. Task summary

Make the report-only R.11 preflight fail closed unless the exact R.11 closeout
ticket and its matching worklog both exist.

## 2. Repo context discovered

The active goal still points at the ROX.ONE rebrand sweep and R.11 remains
blocked by active goal state. The preflight already checked the exact
`docs/tickets/T298-rebrand-git-history-rewrite.md` ticket, but it did not
check the matching `docs/worklog/T298-rebrand-git-history-rewrite.md` file.

The rebrand goal requires one worklog per ticket and T298 is the R.11 closeout
evidence surface, so a ticket-only check was weaker than the goal contract.

## 3. Files inspected

- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`

## 4. Tests added first

Added a failing evaluator test:

```text
evaluateR11Preflight > fails closed when the exact R.11 closeout worklog is missing
```

The test set `r11CloseoutTicketPresent: true` and
`r11CloseoutWorklogPresent: false`, then expected preflight to fail on a
distinct `r11-closeout-worklog` row.

## 5. Expected failing test output

Initial RED run:

```text
Expected: false
Received: true
(fail) evaluateR11Preflight > fails closed when the exact R.11 closeout worklog is missing
```

The failure confirmed the current evaluator ignored the worklog presence signal.

## 6. Implementation changes

- Added `r11CloseoutWorklogPresent` to `R11PreflightSnapshot`.
- Added a distinct `r11-closeout-worklog` report row.
- Collected the live value from
  `docs/worklog/T298-rebrand-git-history-rewrite.md`.
- Updated existing evaluator test snapshots to include the new prerequisite.
- Updated the all-blockers test to expect eight failures and include the new
  row in formatted output.
- Did not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Did not call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`

## 8. Passing test output summary

Targeted test after implementation:

```text
8 pass
0 fail
23 expect() calls
Ran 8 tests across 1 file.
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
| Regression test fails before implementation | Green | RED run returned `Expected: false / Received: true` |
| Regression test passes after implementation | Green | Targeted test reports 8 pass, 0 fail |
| Preflight has a distinct R.11 closeout worklog row | Green | `r11-closeout-worklog` row added and tested |
| Live default preflight still fails only on active goal | Pending | Live preflight not rerun yet |
| Live pre-rewrite preflight still fails on missing backup artifacts | Pending | Live pre-rewrite preflight not rerun yet |
| Documentation/rebrand validation remains green | Pending | Full docs/rebrand gates not run yet |
| Destructive R.11 actions are not executed | Green | No backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Pending | Commit not created yet |
