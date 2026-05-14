# T369 - Rebrand R.11 preflight runner

Status: DONE
Phase: R.11 preflight runner
Ticket: docs/tickets/T369-rebrand-r11-preflight-runner.md

## 1. Task summary

Add a report-only runner for the destructive R.11 preflight so the blocker set
can be checked repeatedly without starting the rewrite.

## 2. Repo context discovered

The rebrand sweep goal remains blocked on R.11. T368 records fresh blockers:
active goal state, two open PRs, missing backup tag, missing offline mirror,
missing `git-filter-repo`, and missing R.11 closeout ticket.

The repo already has a similar report-only pattern in
`scripts/rc-preflight-runner.ts` and
`scripts/__tests__/rc-preflight-runner.test.ts`.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T368-rebrand-r11-preflight-refresh.md`
- `docs/worklog/T368-rebrand-r11-preflight-refresh.md`
- `scripts/rc-preflight-runner.ts`
- `scripts/__tests__/rc-preflight-runner.test.ts`
- `package.json`

## 4. Tests added first

Added `scripts/__tests__/rebrand-r11-preflight.test.ts` before implementing
`scripts/rebrand-r11-preflight.ts`.

## 5. Expected failing test output

Expected RED before implementation:

```text
Cannot find module '../rebrand-r11-preflight'
```

Actual RED:

```text
bun test scripts/__tests__/rebrand-r11-preflight.test.ts
error: Cannot find module '../rebrand-r11-preflight'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `scripts/rebrand-r11-preflight.ts`.
- Added `scripts/__tests__/rebrand-r11-preflight.test.ts`.
- Added root package script `rebrand:r11-preflight`.
- The runner exports pure `evaluateR11Preflight()` and
  `formatR11PreflightReport()` helpers for tests.
- The CLI collector checks open PRs, remote tags, offline mirror existence,
  `git-filter-repo`, R.11 ticket existence, main sync, worktree cleanliness,
  and a fail-closed `ROX_R11_NO_ACTIVE_GOAL=1` acknowledgement.
- The runner is report-only: it does not run `git filter-repo`, create refs,
  push refs, or mutate GitHub state.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Focused test:

```text
3 pass
0 fail
8 expect() calls
Ran 3 tests across 1 file.
```

Report-only runner on current blocked repo state:

```text
red — 7 R.11 prerequisite(s) failing
error: script "rebrand:r11-preflight" exited with code 1
```

The non-zero exit is expected because R.11 is still blocked.

## 9. Build output summary

No build expected. This is a scripts/docs validation helper and does not change
runtime application behavior.

## 10. Remaining risks

The runner is not a substitute for the destructive R.11 procedure. It only
reports whether the prerequisites are currently true. R.11 still requires a
separate closeout ticket, backup artifacts, legal-preserve byte-diffs, full
post-rewrite validation, and force-push with lease.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED test captured before implementation | Green | Focused test failed on missing module before implementation |
| Runner exists and has pure evaluation tests | Green | `scripts/rebrand-r11-preflight.ts`; focused test `3 pass` |
| Package script exists | Green | `package.json` contains `rebrand:r11-preflight` |
| Runner exits non-zero on current blocked repo state | Green | `bun run rebrand:r11-preflight` exited 1 with 7 failing prerequisites |
| Documentation validation passes | Green | `bun run validate:docs` exit 0; agent contract reports 333 tickets |
| Rebrand validation passes | Green | `bun run validate:rebrand` exit 0 |
| Whitespace diff check passes | Green | `git diff --check` exit 0 |
| Worklog complete | Green | 11-section worklog complete |
| Commit created | Green | Atomic Lore commit for T369 after validation |
