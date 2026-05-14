# T298 - Rebrand git history rewrite

Status: BLOCKED
Phase: R.11 git history rewrite
Ticket: docs/tickets/T298-rebrand-git-history-rewrite.md

## 1. Task summary

Create the required R.11 closeout worklog path and record the current hard
stop state. The destructive history rewrite has not started.

## 2. Repo context discovered

The rebrand-sweep goal requires R.11 to run only after all hard prerequisites
are true. Current staged report-only preflight evidence after T380:

| Requirement | Evidence | Status |
| --- | --- | --- |
| No active `/goal` runs | `get_goal` still reports the rebrand-sweep goal active | Blocked |
| No open PRs | `gh pr list --state open --json number,title,headRefName,url --limit 200` returned `[]` | Green |
| `rebrand-v1` tag exists | Preflight reports pass | Green |
| Backup tag exists | Required by `bun run rebrand:r11-preflight --stage pre-rewrite`, after backup creation and before `git filter-repo` | Pre-rewrite blocked |
| Offline mirror exists | Required by `bun run rebrand:r11-preflight --stage pre-rewrite`, after backup creation and before `git filter-repo` | Pre-rewrite blocked |
| `git-filter-repo` available | Preflight reports pass after T371 PATH bridge | Green |
| R.11 closeout ticket exists | This ticket/worklog establishes the path | In progress |
| `main` synced with `origin/main` | Preflight reports `0 0` | Green |
| Worktree clean | Default preflight reports pass in the primary worktree | Green |

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/rebrand-r11-preflight.ts`
- `docs/tickets/T351-rebrand-r11-preflight-handoff.md`
- `docs/worklog/T351-rebrand-r11-preflight-handoff.md`
- `docs/tickets/T368-rebrand-r11-preflight-refresh.md`
- `docs/worklog/T368-rebrand-r11-preflight-refresh.md`

## 4. Tests added first

No code test was added. The RED validation is the R.11 report-only preflight:
it must fail before this ticket because the closeout path is absent and
destructive prerequisites are still missing.

## 5. Expected failing test output

Expected RED before this scaffold:

```text
r11-closeout-ticket  fail    docs/tickets/T298-rebrand-git-history-rewrite.md is missing.
red - 5 R.11 prerequisite(s) failing
```

This is a hard stop, not a defect to bypass.

## 6. Implementation changes

- Added `docs/tickets/T298-rebrand-git-history-rewrite.md` as `Status:
  BLOCKED`.
- Added this 11-section worklog as the future R.11 closeout evidence surface.
- Did not run `git filter-repo`.
- Did not create or push backup tags, backup branches, offline mirrors, or
  force-updated refs.

## 7. Validation commands run

- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

R.11 report-only preflight after scaffold creation:

```text
r11-closeout-ticket  pass    docs/tickets/T298-rebrand-git-history-rewrite.md exists.
red - 5 R.11 prerequisite(s) failing
error: script "rebrand:r11-preflight" exited with code 1
```

The non-zero exit remains expected. This pre-commit run still included
`worktree-clean` as a failure because the T298 scaffold files were uncommitted;
the post-commit rerun must verify that `worktree-clean` returns to pass and
the remaining blocker count drops to the true hard blockers.

Documentation validation:

```text
[agent-contract] ok: 11 skills, 336 tickets, 7 required docs
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

No build expected for this scaffold. The future destructive rewrite must run
the full post-rewrite build matrix before this ticket can become `DONE`.

### Current follow-up evidence, 2026-05-14T02:37:09Z

T375 through T380 refreshed the blocker state after PR #205 merged and after
the staged preflight split landed:

- GitHub reports no open PRs.
- GitHub fork count is `0`.
- `origin/main...HEAD` is `0 0`.
- `rebrand-v1` exists on `origin`.
- `pre-rebrand-history-rewrite-backup` does not exist on `origin`.
- `/tmp/rox-one-terminal-backup-2026-05-13.git` does not exist.
- The active Codex goal is still this rebrand sweep.
- The default pre-backup helper no longer requires backup artifacts before the
  backup procedure can create them.
- The explicit pre-rewrite helper still requires backup artifacts before any
  `git filter-repo` invocation.
- A lightweight history check still finds old `rox-agent` / `Rox Agents`
  strings in git history, so the final `git log -p --all` gate cannot pass
  before the authorized rewrite.

The latest default pre-backup preflight remains red on one blocker:

```text
no-active-goal       fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
red - 1 R.11 pre-backup prerequisite(s) failing
```

The latest explicit pre-rewrite preflight remains red on backup artifacts:

```text
backup-tag           fail    pre-rebrand-history-rewrite-backup ...
offline-mirror       fail    /tmp/rox-one-terminal-backup-2026-0...
red - 2 R.11 pre-rewrite prerequisite(s) failing
```

## 10. Remaining risks

R.11 pre-backup remains blocked by active goal state. Backup tag and offline
mirror creation must wait until that hard stop is truthfully cleared. After
backup creation, `bun run rebrand:r11-preflight --stage pre-rewrite` must pass
before any `git filter-repo` invocation.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| R.11 preflight is green before backup creation | Blocked | Default pre-backup gate fails only on active goal |
| Backup tag exists on origin | Blocked | Not created while preflight is red |
| Backup branch exists on origin | Blocked | Not created while preflight is red |
| Offline mirror exists | Blocked | Not created while pre-backup gate is red |
| `git filter-repo` command history is recorded | Blocked | `git filter-repo` has not run |
| Legal-preserve byte diffs are empty | Blocked | Cannot run before rewrite |
| Dockerfile upstream attribution URL remains intact | Blocked | Must verify after rewrite |
| Force-push completes with lease | Blocked | Not allowed while preflight is red |
| Post-rewrite validation matrix is green | Blocked | Not allowed while preflight is red |
| README coordination banner is handled if required | Blocked | Only required after force-push |
| Worklog is complete with command evidence | Blocked | This scaffold records current blockers only |
| Commit or force-push result is recorded | Blocked | No destructive result exists yet |
