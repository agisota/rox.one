# T351 - Rebrand R.11 preflight handoff

Status: DONE
Phase: R.11 preflight handoff
Ticket: docs/tickets/T351-rebrand-r11-preflight-handoff.md

## 1. Task summary

Record the current R.11 preflight state after PR #143 merged the
post-rebase validation repairs into `origin/main`. This is a documentation-only
handoff for the destructive history rewrite; it does not execute R.11.

## 2. Repo context discovered

The rebrand sweep detail file requires R.11 to run only after every hard
prerequisite is true. Current evidence is mixed:

- `main` is synced with `origin/main`.
- `gh pr list --state open` returns an empty list after stale PR #119 was
  closed and PR #143 was merged.
- The active Codex goal is still running, which directly violates the R.11
  prerequisite "No active codex `/goal` runs."
- The required `pre-rebrand-history-rewrite-backup` tag is not present on
  origin.
- The required offline mirror at
  `/tmp/rox-one-terminal-backup-2026-05-13.git` is missing.
- `docs/tickets/T298-rc-preflight.md` explicitly says the future
  `T298-rebrand-git-history-rewrite` closeout is not yet created.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.swarm/master-roadmap-log.md`
- `docs/tickets/T298-rc-preflight.md`
- `docs/worklog/T298-rc-preflight.md`
- `docs/tickets/T351-rebrand-r11-preflight-handoff.md`
- `docs/worklog/T351-rebrand-r11-preflight-handoff.md`

## 4. Tests added first

No code test was added. The red check is the R.11 preflight audit against the
actual repository and goal state.

## 5. Expected failing test output

The R.11 preflight is expected to fail before this handoff:

```text
get_goal: status active
git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup
  returns only refs/tags/rebrand-v1
test -d /tmp/rox-one-terminal-backup-2026-05-13.git
  returns missing
docs/tickets/T298-rc-preflight.md:
  T298-rebrand-git-history-rewrite ... not yet created
```

Those are blockers by the R.11 contract, not implementation defects to work
around.

## 6. Implementation changes

- Added `docs/tickets/T351-rebrand-r11-preflight-handoff.md`.
- Added this 11-section worklog.
- Did not run `git filter-repo`.
- Did not create the R.11 backup tag/branch or push any force-updated refs.
- Did not append an R.11 completion line to `.swarm/master-roadmap-log.md`.

## 7. Validation commands run

- `git status --short --branch`
- `git rev-list --left-right --count origin/main...HEAD`
- `gh pr list --state open --limit 50 --json number,title,url`
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`
- `test -d /tmp/rox-one-terminal-backup-2026-05-13.git`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

- `git status --short --branch`: `## main...origin/main` before creating the
  handoff branch.
- `git rev-list --left-right --count origin/main...HEAD`: `0 0` before
  creating the handoff branch.
- `gh pr list --state open --limit 50 --json number,title,url`: `[]`.
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`:
  only `refs/tags/rebrand-v1` is present.
- Offline mirror check: missing.
- `bun run validate:docs`: pass.
- `bun run validate:rebrand`: pass.
- `git diff --check`: pass.

## 9. Build output summary

No build was required. This ticket is documentation-only and does not change
runtime/source behavior.

## 10. Remaining risks

R.11 remains unstarted. The next operator or agent must pause/clear the active
goal, create the required R.11 closeout ticket, create the backup tag/branch
and offline mirror, run `git filter-repo`, perform legal-preserve byte-diffs,
run the full validation matrix, and force-push with lease only if every check
passes.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Current `main` is synced with `origin/main` | Green | `git rev-list --left-right --count origin/main...HEAD` returned `0 0` before handoff branch |
| Open PR list is empty | Green | `gh pr list --state open` returned `[]` |
| Active goal state is recorded as R.11 blocker | Green | `get_goal` reported `status: active` |
| Missing backup tag and offline mirror are recorded | Green | Remote tag query lacks backup tag; mirror path is missing |
| Absence of `T298-rebrand-git-history-rewrite` is recorded | Green | Existing T298 rc-preflight ticket says the R.11 closeout is not yet created |
| No destructive R.11 command was run | Green | No `filter-repo`, backup tag push, or force-push executed |
| Documentation validation passes | Green | `bun run validate:docs` exit 0 |
| Rebrand validation passes | Green | `bun run validate:rebrand` exit 0 |
| Whitespace check passes | Green | `git diff --check` exit 0 |
| Worklog complete | Green | 11-section worklog complete |
| Commit created | Green | Atomic commit after validation |
