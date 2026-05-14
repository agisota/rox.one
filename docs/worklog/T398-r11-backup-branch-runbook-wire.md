# T398 - R.11 backup branch runbook wire

Status: DONE
Phase: R.11 preflight documentation
Ticket: docs/tickets/T398-r11-backup-branch-runbook-wire.md

## 1. Task summary

Align the canonical R.11 pre-rewrite runbook paragraph with the executable
pre-rewrite helper's backup-artifact rows.

## 2. Repo context discovered

The explicit pre-rewrite helper checks:

- `backup-tag`;
- `backup-branch`;
- `offline-mirror`.

The R.11 backup procedure creates all three artifacts, but the paragraph that
introduces `bun run rebrand:r11-preflight --stage pre-rewrite` says only the
backup tag and offline mirror must exist. That can lead an operator to miss
the mandatory backup branch when reading the prose.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `scripts/rebrand-r11-preflight.ts`
- `docs/tickets/T386-r11-preflight-backup-branch-check.md`
- `docs/worklog/T386-r11-preflight-backup-branch-check.md`

## 4. Tests added first

Added the documentation regression to
`scripts/__tests__/rebrand-r11-preflight.test.ts` before editing the goal
file. It asserts the R.11 runbook says the backup tag, backup branch, and
offline mirror must all exist before any `git filter-repo` invocation.

## 5. Expected failing test output

RED run:

```text
(fail) R.11 goal documentation > documents every backup artifact enforced by the pre-rewrite gate
Expected to contain: "The backup tag, backup branch, and offline mirror must **all** exist before any filter-repo invocation."

14 pass
1 fail
47 expect() calls
```

The failure proved the runbook prose still omitted the backup branch from the
pre-rewrite artifact requirement.

## 6. Implementation changes

- Updated the R.11 pre-rewrite paragraph to say the backup tag, backup branch,
  and offline mirror must all exist before any `git filter-repo` invocation.
- Added the backup branch remote verification command to that paragraph:
  `git ls-remote --heads origin backup/pre-rebrand-history-rewrite-2026-05-13`.
- Did not change the backup command sequence.
- Did not create backup refs, mirrors, rewritten history, force-push, re-point
  `rebrand-v1`, or call `update_goal`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted test:

```text
15 pass
0 fail
49 expect() calls
```

Documentation/rebrand/whitespace validation is run after this worklog update.

## 9. Build output summary

No build was run. This is a documentation/test alignment slice.

## 10. Remaining risks

R.11 remains blocked by active goal state, local/remote tag drift, off-main
`rebrand-v1`, and missing backup artifacts. This ticket does not execute any
destructive R.11 command.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Regression test fails before documentation update | Green | RED run showed the runbook omitted backup branch from the prose |
| Regression test passes after documentation update | Green | Targeted test reports 15 pass, 0 fail |
| R.11 runbook names backup tag, backup branch, and offline mirror before pre-rewrite | Green | Goal file paragraph updated |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No tag rewrite, backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit created for this ticket |
