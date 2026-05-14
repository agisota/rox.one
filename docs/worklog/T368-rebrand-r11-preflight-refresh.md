# T368 - Rebrand R.11 preflight refresh

Status: DONE
Phase: R.11 preflight refresh
Ticket: docs/tickets/T368-rebrand-r11-preflight-refresh.md

## 1. Task summary

Refresh the R.11 prerequisite audit for the active rebrand-sweep goal. The
change is documentation-only and records the current blocker set; it does not
start the destructive history rewrite.

## 2. Repo context discovered

The active goal is still:

```text
follow the instructions in
  docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

The rebrand-sweep goal's global stopping condition includes R.11:
`T298-rebrand-git-history-rewrite`, backup artifacts, `rebrand-v1` re-pointed
after rewrite, full post-rewrite validation, and a zero-forbidden-token
history scan. Those requirements are not satisfied.

Fresh blockers:

- Active goal state is still `active`, which violates R.11 hard prerequisite
  "No active codex `/goal` runs."
- Two open PRs exist on GitHub:
  - `#189 feat(a11y): per-route ErrorBoundary for 14 remaining page routes`
    from `feat/per-route-error-boundaries` to `main`.
  - `#171 feat(security): remove unsafe-inline from CSP script-src across
    renderer HTMLs` from `feat/csp-remove-unsafe-inline-script` to `main`.
- `pre-rebrand-history-rewrite-backup` is absent on origin.
- `/tmp/rox-one-terminal-backup-2026-05-13.git` is absent.
- `git-filter-repo` is not installed in this environment.
- `docs/tickets/T298-rebrand-git-history-rewrite.md` is still absent; the
  existing `T298` slot is `T298-rc-preflight.md`.

Non-blocking current state:

- Local `main` is synced with `origin/main`: `0 0`.
- Working tree is clean before this documentation update.
- `rebrand-v1` exists on origin and locally.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.swarm/master-roadmap-log.md`
- `docs/tickets/T298-rc-preflight.md`
- `docs/tickets/T298a-rebrand-allowlist-expansion.md`
- `docs/tickets/T351-rebrand-r11-preflight-handoff.md`
- `docs/worklog/T351-rebrand-r11-preflight-handoff.md`

## 4. Tests added first

No code test was added. The failing "test" is the prerequisite audit itself:
R.11 must not begin until every hard prerequisite in the goal file is true.

## 5. Expected failing test output

The fresh audit still fails:

```text
get_goal: status active
gh pr list --state open --limit 200:
  #189 feat/per-route-error-boundaries -> main
  #171 feat/csp-remove-unsafe-inline-script -> main
git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup:
  returns only refs/tags/rebrand-v1
test -d /tmp/rox-one-terminal-backup-2026-05-13.git:
  missing
command -v git-filter-repo:
  missing
docs/tickets/T298-rebrand-git-history-rewrite.md:
  missing
```

Those are R.11 contract blockers, not defects to bypass.

## 6. Implementation changes

- Added `docs/tickets/T368-rebrand-r11-preflight-refresh.md`.
- Added this 11-section worklog.
- Did not run `git filter-repo`.
- Did not create or push backup tags, backup branches, or force-updated refs.
- Did not append an R.11 completion line to `.swarm/master-roadmap-log.md`.

## 7. Validation commands run

Pre-edit audit:

- `get_goal`
- `gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName`
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`
- `test -d /tmp/rox-one-terminal-backup-2026-05-13.git`
- `command -v git-filter-repo`
- `git rev-list --left-right --count origin/main...main`
- `git status --porcelain`
- `bun run validate:agent-contract`
- `bun run validate:rebrand`
- `git diff --check`

Post-edit validation:

- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Pre-edit positive checks:

- `git rev-list --left-right --count origin/main...main`: `0 0`.
- `git status --porcelain`: empty.
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`:
  `refs/tags/rebrand-v1` is present.
- `bun run validate:agent-contract`: pass.
- `bun run validate:rebrand`: pass.
- `git diff --check`: pass.

Pre-edit blocker checks:

- `get_goal`: active.
- `gh pr list`: two open PRs, `#189` and `#171`.
- `pre-rebrand-history-rewrite-backup`: absent from the remote tag query.
- Offline mirror path: absent.
- `git-filter-repo`: absent.
- R.11 closeout ticket: absent.

Post-edit validation results:

- `bun run validate:docs`: pass; agent contract reports 332 tickets, 7
  required docs.
- `bun run validate:rebrand`: pass; no forbidden tokens outside the allowlist.
- `git diff --check`: pass.

## 9. Build output summary

No build was required. This is a documentation-only blocker refresh and does
not change runtime/source behavior.

## 10. Remaining risks

The rebrand-sweep goal remains incomplete. R.11 cannot start until the active
goal is paused or cleared, open PRs are merged or closed, backup artifacts are
created, `git-filter-repo` is available, and a real
`T298-rebrand-git-history-rewrite` closeout path is established without
breaking the existing `T298-rc-preflight` ticket.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Fresh active-goal state is recorded | Green | `get_goal` reported the rebrand-sweep goal as `active` |
| Fresh open-PR blocker list is recorded | Green | `gh pr list` returned PRs `#189` and `#171` |
| Missing backup tag and offline mirror are recorded | Green | Remote tag query lacks backup tag; mirror path is missing |
| Missing `git-filter-repo` tooling is recorded | Green | `command -v git-filter-repo` returned no path |
| Current `main` sync state is recorded | Green | `git rev-list --left-right --count origin/main...main` returned `0 0` |
| No destructive R.11 command was run | Green | No filter-repo, backup tag push, or force-push executed |
| Documentation validation passes | Green | `bun run validate:docs` exit 0; agent contract reports 332 tickets |
| Rebrand validation passes | Green | `bun run validate:rebrand` exit 0 |
| Whitespace diff check passes | Green | `git diff --check` exit 0 |
| Worklog complete | Green | 11-section worklog present |
| Commit created | Green | Atomic Lore commit for T368 after validation |
