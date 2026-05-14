# T444 - R.11 preflight current branch guard

Status: DONE
Phase: R.11 report-only safety guard
Ticket: docs/tickets/T444-r11-preflight-current-branch-guard.md

## 1. Task summary

Add a report-only R.11 preflight row that fails closed unless the current
checkout is `main`.

## 2. Repo context discovered

`scripts/rebrand-r11-preflight.ts` already checks local/remote sync via
`git rev-list --left-right --count origin/main...main`, but that checks the
local `main` ref even if the operator is currently on another branch. The R.11
runbook commands assume the checkout is on `main` before backup and destructive
history-rewrite operations.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T298-rebrand-git-history-rewrite.md`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-r11-preflight.test.ts` with
`fails closed when the current checkout is not main`. The test passes a
snapshot for `chore/rebrand-R10-final-sweep-and-gate`, expects the evaluator to
return `allPassed: false`, and requires a failing `current-branch` row.

The aggregate blocker test was also updated to include `current-branch`, so the
preflight still proves it reports every blocker instead of stopping early.

## 5. Expected failing test output

Before implementation, the targeted test failed because the evaluator ignored
the non-main checkout:

```text
Expected: false
Received: true

(fail) evaluateR11Preflight > fails closed when the current checkout is not main
```

The aggregate blocker test also expected 15 blockers but received 14 because
`current-branch` did not exist yet.

## 6. Implementation changes

- Added `currentBranch` and `currentBranchIsMain` to the R.11 preflight
  snapshot.
- Added a `current-branch` report row that passes only when the current
  checkout is `main`.
- Collected the current branch with `git branch --show-current`.
- Preserved all existing report-only behavior; the script still only inspects
  state and never mutates refs, tags, mirrors, or history.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`: 26 pass,
  0 fail, 118 expect calls.
- `bun run validate:docs`: green; agent contract reports 409 tickets and
  7 required docs.
- `bun run validate:rebrand`: green.
- `bun run validate:roadmap`: green; reports 46 phases, 110 tickets across
  detail files, and 14 rebrand master-roadmap log rows.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 7 existing warnings and 0 errors.
- `git diff --check`: exit 0.

## 9. Build output summary

No build expected for this report-only script/test change.

## 10. Remaining risks

R.11 remains blocked on hard prerequisites. This ticket only adds a preflight
guard and does not authorize tag mutation, backup creation, mirror creation,
`git filter-repo`, force-push, or branch cleanup.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because `current-branch` is not yet checked | PASS | Targeted test failed with `Expected: false`, `Received: true` |
| Preflight reports `current-branch` pass on `main` | PASS | Passing snapshot defaults to `currentBranch: main`; targeted test suite passes |
| Preflight reports `current-branch` fail off `main` | PASS | Non-main snapshot produces a failing `current-branch` row |
| Existing R.11 blockers remain visible | PASS | Aggregate blocker test still verifies all blockers are reported |
| Targeted test and validators pass | PASS | Targeted test, docs/rebrand/roadmap validators, typecheck, lint, and diff-check passed |
| No destructive R.11 action is performed | PASS | No tag mutation, backup creation, mirror creation, filter-repo, force-push, or branch cleanup commands were run |
