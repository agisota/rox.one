# T388 - R.11 preflight fork review check

Status: DONE
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
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## 8. Passing test output summary

Targeted test after implementation:

```text
10 pass
0 fail
30 expect() calls
Ran 10 tests across 1 file.
```

Typecheck:

```text
bun run typecheck:shared
```

exited 0.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 353 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace validation:

```text
git diff --check
```

exited 0 with no output.

Post-push default pre-backup preflight, 2026-05-14T03:08:41Z:

```text
fork-review           pass    GitHub reports expected fork count ...
main-sync             pass    origin/main...main is 0 0.
worktree-clean        pass    git status --porcelain is empty.
red - 1 R.11 pre-backup prerequisite(s) failing
```

Post-push explicit pre-rewrite preflight:

```text
fork-review           pass    GitHub reports expected fork count ...
backup-tag            fail    pre-rebrand-history-rewrite-backup ...
backup-branch         fail    backup/pre-rebrand-history-rewrite-...
offline-mirror        fail    /tmp/rox-one-terminal-backup-2026-0...
red - 3 R.11 pre-rewrite prerequisite(s) failing
```

## 9. Build output summary

No build was run. This changes the report-only preflight script and test, not
product runtime behavior.

## 10. Remaining risks

R.11 remains blocked. Backup creation, `git filter-repo`, force-push,
post-rewrite validation, and `update_goal` remain unexecuted.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before implementation | Green | RED run showed false green and missing blocker count |
| Regression test passes after implementation | Green | Targeted test reports 10 pass, 0 fail |
| Preflight has a distinct fork-review row | Green | `fork-review` row added and tested |
| Live default preflight shows fork-review pass at expected count 0 | Green | Post-push pre-backup preflight shows `fork-review` pass |
| Documentation/rebrand validation remains green | Green | `typecheck`, `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit `ef55c77d` created and pushed for this implementation |
