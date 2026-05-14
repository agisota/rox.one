# T408 - R.11 blocker evidence refresh

Status: DONE
Phase: R.11 blocker evidence
Ticket: docs/tickets/T408-r11-blocker-evidence-refresh.md

## 1. Task summary

Refresh T298's R.11 blocker evidence after the report-only legal-preserve
runner and goal-wire commits landed.

## 2. Repo context discovered

At slice start, `main` and `origin/main` were synchronized and the worktree was
clean. The default pre-backup R.11 preflight still exited red on active goal
state, `rebrand-tag-local-sync`, and `rebrand-tag-on-main`. The explicit
pre-rewrite preflight still exited red on those tag blockers plus missing
backup artifacts and 139 non-main/non-R.11-backup origin branches. The
legal-preserve runner still exited red because the backup tag does not exist,
while the Dockerfile attribution row passes.

## 3. Files inspected

- `docs/worklog/T298-rebrand-git-history-rewrite.md`
- `docs/tickets/T298-rebrand-git-history-rewrite.md`
- `docs/worklog/T406-r11-legal-preserve-runner.md`
- `docs/worklog/T407-r11-legal-preserve-goal-wire.md`
- `scripts/rebrand-r11-preflight.ts`
- `scripts/rebrand-r11-legal-preserve.ts`

## 4. Tests added first

No new code test was needed for this evidence-only refresh. The RED checks were
the existing report-only R.11 gates.

## 5. Expected failing test output

Pre-backup preflight remains red:

```text
no-active-goal          fail
rebrand-tag-local-sync  fail
rebrand-tag-on-main     fail
red - 3 R.11 pre-backup prerequisite(s) failing
```

Pre-rewrite preflight remains red:

```text
rebrand-tag-local-sync  fail
rebrand-tag-on-main     fail
backup-tag              fail
backup-branch           fail
offline-mirror          fail
remote-branch-review    fail
red - 6 R.11 pre-rewrite prerequisite(s) failing
```

Legal-preserve runner remains red:

```text
legal-file-LICENSE             fail
legal-file-NOTICE              fail
legal-file-TRADEMARK.md        fail
dockerfile-source-attribution  pass
red - 3 R.11 legal-preserve check(s) failing
```

## 6. Implementation changes

- Updated T298's current follow-up evidence timestamp and summary.
- Recorded the current clean R.11 blocker state for synchronized `main` and
  `origin/main`.
- Recorded that T406 and T407 now provide and document
  `bun run rebrand:r11-legal-preserve`.
- Preserved T298 as `Status: BLOCKED`.
- Did not run `git filter-repo`, create backup artifacts, create mirrors,
  force-push, or call `update_goal`.

## 7. Validation commands run

- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run rebrand:r11-legal-preserve`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Documentation validation:

```text
[agent-contract] ok: 11 skills, 373 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /home/dev/craft/rox-one-terminal/docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace:

```text
git diff --check
exit 0
```

## 9. Build output summary

No build was run. This is an evidence-only documentation refresh.

## 10. Remaining risks

R.11 remains blocked. The failing gates are expected and must not be bypassed.
Backup creation, history rewrite, legal-preserve pass, and force-push require a
separate unblock state.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Current R.11 default preflight evidence is recorded | Green | Section 5 and T298 record the 3-blocker pre-backup result |
| Current R.11 pre-rewrite evidence is recorded | Green | Section 5 and T298 record the 6-blocker pre-rewrite result |
| Current legal-preserve runner evidence is recorded | Green | Section 5 and T298 record the 3-row legal-file failure plus Dockerfile pass |
| T298 remains blocked | Green | T298 stays `Status: BLOCKED` |
| Relevant validation passes | Green | Section 8 records docs/rebrand validation and diff-check |
| Commit created | Green | Lore commit created for this evidence refresh |
