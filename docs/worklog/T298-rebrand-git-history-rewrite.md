# T298 - Rebrand git history rewrite

Status: BLOCKED
Phase: R.11 git history rewrite
Ticket: docs/tickets/T298-rebrand-git-history-rewrite.md

## 1. Task summary

Create the required R.11 closeout worklog path and record the current hard
stop state. The destructive history rewrite has not started.

## 2. Repo context discovered

The rebrand-sweep goal requires R.11 to run only after all hard prerequisites
are true. Current staged report-only preflight evidence is summarized in the
durable audit at `docs/release/r11-completion-audit-2026-05-14.md`:

| Requirement | Evidence | Status |
| --- | --- | --- |
| No active `/goal` runs | `get_goal` still reports the rebrand-sweep goal active | Blocked |
| No open PRs | `gh pr list --state open --json number,title,headRefName,url --limit 200` returned `[]` | Green |
| Fork count reviewed | Preflight reports `fork-review` fail: GitHub reports 1 fork(s); expected 0 | Blocked |
| R.0-R.10 closeouts done | Preflight reports exact rebrand ticket/worklog closeouts present and done | Green |
| C4 Phase 1 closeout done | Preflight reports exact T223 closeout ticket done | Green |
| RBAC Phase 2 closeout done | Preflight reports exact T229 closeout ticket done | Green |
| `rebrand-v1` tag exists | Preflight reports pass | Green |
| Local `rebrand-v1` matches origin | Preflight reports fail | Blocked |
| `rebrand-v1` tag target is on `origin/main` | Preflight reports fail | Blocked |
| Backup tag exists | Required by `bun run rebrand:r11-preflight --stage pre-rewrite`, after backup creation and before `git filter-repo` | Pre-rewrite blocked |
| Backup branch exists | Required by `bun run rebrand:r11-preflight --stage pre-rewrite`, after backup creation and before `git filter-repo` | Pre-rewrite blocked |
| Offline mirror exists | Required by `bun run rebrand:r11-preflight --stage pre-rewrite`, after backup creation and before `git filter-repo` | Pre-rewrite blocked |
| Remote branches reviewed | Explicit pre-rewrite helper requires origin to expose only `main` and `backup/pre-rebrand-history-rewrite-2026-05-13`; origin currently has 139 non-main/non-R.11-backup branches | Pre-rewrite blocked |
| `git-filter-repo` available | Preflight reports pass after T371 PATH bridge | Green |
| R.11 closeout ticket exists | Exact files `docs/tickets/T298-rebrand-git-history-rewrite.md` and `docs/worklog/T298-rebrand-git-history-rewrite.md` exist with `Status: BLOCKED`; this is distinct from the unrelated `T298-rc-preflight` ticket | Green |
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

### Current follow-up evidence pointers

T409 and later audit-hygiene tickets keep the durable R.11 completion audit,
current-main validation evidence, and exact report-only blocker IDs in
`docs/release/r11-completion-audit-2026-05-14.md`. This T298 worklog remains
the destructive closeout surface; use the completion audit for the latest
report-only blocker matrix until R.11 is unblocked.

The T429 full-matrix snapshot is preserved in
`docs/release/r11-current-main-validation-2026-05-14.md`. It records
`bun test` as `6753 pass, 13 skip, 0 fail`; this is captured pre-rewrite
evidence for current `main`, not post-rewrite completion evidence or a live
ticket-count source; later audit-hygiene tickets carry their own fresh targeted validation evidence in their worklogs.

Earlier report-only tickets refreshed the blocker state after PR #205 merged,
after the staged preflight split landed, after the R.11 local path runbook
repair, after the pre-rewrite backup branch check landed, and after the
fork-review closeout-prerequisite, tag-on-main, local-tag-sync, and
remote-branch-review preflight rows landed, and after the report-only
history/legal-preserve gates were added and wired into the R.11 goal:

- GitHub reports no open PRs.
- GitHub fork review is currently blocked: GitHub reports 1 fork(s); expected
  0.
- `main` and `origin/main` are synchronized (`origin/main...HEAD` is `0 0`
  in clean post-push checks).
- `rebrand-v1` exists on `origin`.
- Local `rebrand-v1^{commit}` and origin `refs/tags/rebrand-v1^{}` currently
  differ.
- The `rebrand-v1` target is not currently on `origin/main` ancestry.
- `pre-rebrand-history-rewrite-backup` does not exist on `origin`.
- `backup/pre-rebrand-history-rewrite-2026-05-13` does not exist on `origin`.
- `/tmp/rox-one-terminal-backup-2026-05-13.git` does not exist.
- Origin currently has 139 non-main/non-R.11-backup branches, so the explicit
  pre-rewrite helper reports `remote-branch-review` as a blocker.
- `docs/release/rebrand-mapping-2026-05-13.md` has an R.11 pending closeout
  slot, but it cannot record a real R.11 closeout commit SHA until the
  destructive rewrite and post-rewrite validation succeed.
- The active Codex goal is still this rebrand sweep.
- The default pre-backup helper no longer requires backup artifacts before the
  backup procedure can create them.
- The explicit pre-rewrite helper still requires backup artifacts before any
  `git filter-repo` invocation.
- A lightweight history check still finds old `rox-agent` / `Rox Agents`
  strings in git history, so the final `git log -p --all` gate cannot pass
  before the authorized rewrite.
- The report-only `bun run rebrand:r11-history-scan` helper now wraps that
  history gate and currently exits red with bounded finding output.
- The report-only `bun run rebrand:r11-legal-preserve` helper now wraps the
  post-rewrite legal-preserve byte checks and Dockerfile source-label check. It
  currently exits red because the backup tag does not exist yet; Dockerfile
  attribution itself passes.
- The R.11 goal now points operators at
  `bun run rebrand:r11-legal-preserve` instead of the older manual `/tmp`
  byte-diff snippets.
- The R.11 offline mirror and rollback snippets now point at the current
  checkout path, `/home/dev/craft/rox-one-terminal`, and the regression test
  fails if `/home/dev/rox/rox-one-terminal` returns.
- The exact R.11 closeout ticket/worklog pair exists and remains
  `Status: BLOCKED`; do not confuse it with the unrelated, already-complete
  `T298-rc-preflight` release-readiness ticket.
- The explicit pre-rewrite helper now checks all three mandatory backup
  artifacts from the runbook: backup tag, backup branch, and offline mirror.
- The report-only helper now checks fork count against
  `ROX_R11_EXPECTED_FORKS` (default `0`), and the latest run reports
  `fork-review` fail because GitHub reports 1 fork(s); expected 0.
- The helper now checks exact R.0-R.10 rebrand ticket/worklog closeouts, exact
  T223 C4 Phase 1 closeout status, and exact T229 RBAC Phase 2 closeout
  status before any R.11 backup or rewrite action.
- The helper now checks whether the remote `rebrand-v1` target is on
  `origin/main` ancestry; the latest run reports it is not.
- The helper now checks whether local `rebrand-v1` and origin `rebrand-v1`
  peel to the same commit; the latest run reports they do not.
- The helper now checks stale remote branch state in explicit pre-rewrite mode;
  the latest run reports 139 branches outside `main` and the R.11 backup
  branch.

The latest post-push default pre-backup preflight reports four blockers:

```text
no-active-goal       fail    Missing ROX_R11_NO_ACTIVE_GOAL=1 ac...
fork-review          fail    GitHub reports 1 fork(s); expected 0.
rebrand-tag-local-sync fail  Local rebrand-v1 target differs fro...
rebrand-tag-on-main  fail    rebrand-v1 target is missing from o...
main-sync            pass    origin/main...main is 0 0.
worktree-clean       pass    git status --porcelain is empty.
rebrand-closeouts    pass    R.0-R.10 tickets are Status: DONE a...
phase1-closeout      pass    docs/tickets/T223-c4-followups-clos...
phase2-rbac-closeout pass    docs/tickets/T229-rbac-integration-...
red — 4 R.11 pre-backup prerequisite(s) failing
```

The latest explicit pre-rewrite preflight remains red on tag drift,
tag-on-main, backup artifacts, and stale remote branches:

```text
rebrand-tag-local-sync fail  Local rebrand-v1 target differs fro...
rebrand-tag-on-main  fail    rebrand-v1 target is missing from o...
backup-tag           fail    pre-rebrand-history-rewrite-backup ...
backup-branch        fail    backup/pre-rebrand-history-rewrite-...
offline-mirror       fail    /tmp/rox-one-terminal-backup-2026-0...
remote-branch-review fail    origin has 139 non-main/non-R.11-ba...
fork-review          fail    GitHub reports 1 fork(s); expected 0.
main-sync            pass    origin/main...main is 0 0.
worktree-clean       pass    git status --porcelain is empty.
rebrand-closeouts    pass    R.0-R.10 tickets are Status: DONE a...
phase1-closeout      pass    docs/tickets/T223-c4-followups-clos...
phase2-rbac-closeout pass    docs/tickets/T229-rbac-integration-...
red — 7 R.11 pre-rewrite prerequisite(s) failing
```

The latest legal-preserve runner remains blocked on the missing backup tag but
proves that Dockerfile attribution is currently intact:

```text
legal-file-LICENSE             fail
legal-file-NOTICE              fail
legal-file-TRADEMARK.md        fail
dockerfile-source-attribution  pass
red - 3 R.11 legal-preserve check(s) failing
```

## 10. Remaining risks

R.11 pre-backup remains blocked by active goal state, fork count drift,
local/remote `rebrand-v1` tag drift, and the off-main `rebrand-v1` target.
Backup tag,
backup branch, offline mirror creation, and remote branch cleanup/review must
wait until those hard stops are truthfully cleared and a separate R.11 unblock
path authorizes them. After backup creation, `bun run rebrand:r11-preflight
--stage pre-rewrite` must pass before any `git filter-repo` invocation.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| R.11 preflight is green before backup creation | Blocked | Default pre-backup gate fails on active goal, `fork-review`, `rebrand-tag-local-sync`, and `rebrand-tag-on-main` |
| Backup tag exists on origin | Blocked | Not created while preflight is red |
| Backup branch exists on origin | Blocked | Not created while preflight is red |
| Offline mirror exists | Blocked | Not created while preflight is red |
| Remote branches reviewed before rewrite | Blocked | Explicit pre-rewrite gate fails on 139 non-main/non-R.11-backup origin branches |
| `git filter-repo` command history is recorded | Blocked | `git filter-repo` has not run |
| Legal-preserve runner passes | Blocked | `bun run rebrand:r11-legal-preserve` exits red until the backup tag exists and the post-rewrite files match it |
| Force-push completes with lease | Blocked | Not allowed while preflight is red |
| Post-rewrite validation matrix is green | Blocked | Not allowed while preflight is red |
| README coordination banner is handled if required | Blocked | Only required after force-push |
| Mapping report records R.11 closeout SHA | Blocked | `docs/release/rebrand-mapping-2026-05-13.md` carries only an R.11 pending slot until the rewrite completes |
| `git log -p --all` history scan is clean | Blocked | `bun run rebrand:r11-history-scan` exits red until the authorized rewrite runs |
| Worklog is complete with command evidence | Blocked | This scaffold records current blockers only |
| Commit or force-push result is recorded | Blocked | No destructive result exists yet |
