# T371 - Rebrand R.11 git-filter-repo PATH bridge

Status: DONE
Phase: R.11 tooling preflight
Ticket: docs/tickets/T371-rebrand-r11-git-filter-repo-path.md

## 1. Task summary

Make the existing local `git-filter-repo` executable visible to the current
Codex PATH so the R.11 report-only preflight no longer reports missing tooling.

## 2. Repo context discovered

The active goal is still
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`. R.11 is a
destructive history rewrite and cannot start while any hard prerequisite fails.
The report-only preflight currently passes `rebrand-tag`, `main-sync`, and
`worktree-clean`, but fails on active goal acknowledgement, open PRs, backup
tag, offline mirror, missing `git-filter-repo`, and missing R.11 closeout
ticket.

Prompt-to-artifact checklist for the active objective:

| Requirement | Current evidence | Status |
| --- | --- | --- |
| R.0-R.10 closeouts done | Prior rebrand commits exist; not sufficient for R.11 start by itself | Weakly verified |
| T223 done | Prior branch history includes Phase 1 closeout evidence; not rechecked in this slice | Weakly verified |
| T229 done and merged on main | Not verified in this slice | Missing |
| No open PRs | `gh pr list` shows PR #189 and #171 | Blocked |
| No active `/goal` | `get_goal` shows this goal is active | Blocked |
| Fork review complete | Not checked in this slice | Missing |
| `rebrand-v1` tag exists | `bun run rebrand:r11-preflight` reports pass | Green |
| Clean worktree | `bun run rebrand:r11-preflight` reports pass after T370 | Green |
| `main` synced with `origin/main` | `bun run rebrand:r11-preflight` reports `0 0` | Green |
| Backup tag exists | preflight reports missing `pre-rebrand-history-rewrite-backup` | Blocked |
| Offline mirror exists | preflight reports missing `/tmp/rox-one-terminal-backup-2026-05-13.git` | Blocked |
| `git-filter-repo` available | `git filter-repo --version` fails before this slice | Blocked |
| R.11 closeout ticket exists | preflight reports missing `docs/tickets/T298-rebrand-git-history-rewrite.md` | Blocked |
| Legal-preserve diffs pass | Cannot run before filter-repo and backup tag | Blocked |
| Force-push completed | Not started; prohibited while preflight is red | Blocked |
| Post-rewrite validation green | Not started; prohibited while preflight is red | Blocked |

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `docs/tickets/T370-rebrand-r11-preflight-runner-doc-wire.md`
- `docs/worklog/T370-rebrand-r11-preflight-runner-doc-wire.md`
- `scripts/rebrand-r11-preflight.ts`

## 4. Tests added first

No repository test was added because this slice changes only the local command
discovery path. The validation check is command-first: `git filter-repo
--version` must fail before the PATH bridge and pass after it.

## 5. Expected failing test output

Expected RED before the PATH bridge:

```text
git: 'filter-repo' is not a git command. See 'git --help'.
```

Actual preflight RED before the PATH bridge:

```text
git-filter-repo      fail    git-filter-repo is missing from PATH
red - 6 R.11 prerequisite(s) failing
```

## 6. Implementation changes

- Added a user-local symlink from `/home/dev/.bun/bin/git-filter-repo` to the
  already-installed `/home/dev/.local/bin/git-filter-repo`.
- Confirmed `/home/dev/.bun/bin` is already on PATH in this Codex shell.
- Did not install a production dependency.
- Did not run `git filter-repo` against the repository, create backup refs,
  create an offline mirror, or force-push.

## 7. Validation commands run

- `command -v git-filter-repo`
- `git filter-repo --version`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Tooling check:

```text
/home/dev/.bun/bin/git-filter-repo
fb3de42e4281
```

R.11 report-only preflight after the PATH bridge:

```text
git-filter-repo      pass    git-filter-repo is on PATH.
red - 6 R.11 prerequisite(s) failing
error: script "rebrand:r11-preflight" exited with code 1
```

The non-zero exit remains expected. This pre-commit run still included
`worktree-clean` as a failure because the T371 ticket/worklog were uncommitted;
the post-commit rerun must verify that `worktree-clean` returns to pass.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 335 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Rebrand validation:

```text
rebrand validation passed: no forbidden tokens outside the allowlist
```

Whitespace check:

```text
git diff --check
```

exited 0 with no output.

## 9. Build output summary

No build expected. This is a local tooling PATH bridge and docs/worklog update;
it does not change runtime source behavior.

## 10. Remaining risks

This does not unblock R.11. The active goal, open PRs, backup artifacts, fork
review, R.11 closeout ticket, legal-preserve diffs, and post-rewrite full
validation still block the destructive rewrite.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED tooling check captured before the PATH bridge | Green | `git filter-repo --version` failed before symlink |
| `git-filter-repo` is discoverable on PATH | Green | `command -v git-filter-repo` returns `/home/dev/.bun/bin/git-filter-repo` |
| `git filter-repo --version` exits 0 | Green | Version output `fb3de42e4281` |
| R.11 preflight shows the tooling prerequisite passing and remains red on other blockers | Green | `git-filter-repo` pass; preflight still exits 1 |
| Documentation validation passes | Green | `bun run validate:docs` exit 0; agent contract reports 335 tickets |
| Rebrand validation passes | Green | `bun run validate:rebrand` exit 0 |
| Whitespace diff check passes | Green | `git diff --check` exit 0 |
| Worklog complete | Green | 11-section worklog complete |
| Commit created | Green | Atomic Lore commit for T371 after validation |
