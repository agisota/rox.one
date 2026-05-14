# T399 - R.11 backup branch stop condition wire

Status: DONE
Phase: R.11 preflight documentation
Ticket: docs/tickets/T399-r11-backup-branch-stop-condition-wire.md

## 1. Task summary

Align the R.11 stopping conditions with the executable backup-artifact gate by
including the mandatory backup branch.

## 2. Repo context discovered

The explicit pre-rewrite helper checks `backup-tag`, `backup-branch`, and
`offline-mirror`. After T398, the runbook paragraph before the helper names all
three artifacts, but the R.11 stopping condition still says "Backup tag and
backup mirror both exist" and the global stopping condition only mentions the
backup tag plus offline mirror.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-r11-preflight.test.ts`
- `scripts/rebrand-r11-preflight.ts`

## 4. Tests added first

Added the documentation regression to
`scripts/__tests__/rebrand-r11-preflight.test.ts` before editing the goal
file. It asserts:

- the R.11 phase stopping condition says backup tag, backup branch, and backup
  mirror all exist;
- the global stopping condition says the backup tag and backup branch exist on
  `origin`.

## 5. Expected failing test output

RED run:

```text
(fail) R.11 goal documentation > includes the backup branch in R.11 stopping conditions
Expected to contain: "- Backup tag, backup branch, and backup mirror all exist."

15 pass
1 fail
50 expect() calls
```

The failure proved the stopping conditions still omitted the backup branch.

## 6. Implementation changes

- Updated the R.11 phase stopping condition to require backup tag, backup
  branch, and backup mirror.
- Updated the global stopping condition to require both the
  `pre-rebrand-history-rewrite-backup` tag and
  `backup/pre-rebrand-history-rewrite-2026-05-13` branch on `origin`.
- Did not change R.11 commands.
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
16 pass
0 fail
51 expect() calls
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
| Regression test fails before documentation update | Green | RED run showed phase stopping condition omitted backup branch |
| Regression test passes after documentation update | Green | Targeted test reports 16 pass, 0 fail |
| R.11 phase stopping condition includes backup branch | Green | Goal file phase stopping condition updated |
| Global stopping condition includes backup branch | Green | Goal file global stopping condition updated |
| Documentation/rebrand validation remains green | Green | `validate:docs`, `validate:rebrand`, and `git diff --check` passed |
| Destructive R.11 actions are not executed | Green | No tag rewrite, backup, mirror, filter-repo, force-push, or update_goal action was run |
| Commit created | Green | Lore commit created for this ticket |
