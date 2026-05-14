# T403 - R.11 remote branch blocker refresh

Status: DONE

## Context

T402 added a report-only `remote-branch-review` row to the explicit
`--stage pre-rewrite` R.11 preflight. The main R.11 closeout surface,
`docs/worklog/T298-rebrand-git-history-rewrite.md`, still described the latest
evidence as "after T395" and still reported the pre-rewrite blocker count as
five. That made the closeout worklog stale relative to the executable
preflight.

## Goal

Refresh the T298 R.11 blocker evidence so it records the T402 remote branch
blocker and the current six-blocker explicit pre-rewrite state.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Use read-only validation only. Do not delete remote branches, prune refs, create
backup artifacts, run `git filter-repo`, force-push, or call `update_goal`.

## Required Subagents

None. This is a bounded documentation/evidence refresh.

## TDD Requirements

Use a failing grep-style documentation check first to prove T298 lacks the T402
remote-branch evidence before editing it.

## Implementation Requirements

- Update T298's staged blocker table from T395 to T402.
- Add the explicit pre-rewrite remote branch blocker to T298.
- Update the current follow-up evidence and pre-rewrite blocker count from five
  to six.
- Add the remote branch review criterion to the T298 closeout ticket.
- Preserve `Status: BLOCKED` on T298.

## Validation Commands

- `if rg -n "after T402|remote-branch-review|139 non-main" docs/worklog/T298-rebrand-git-history-rewrite.md docs/tickets/T298-rebrand-git-history-rewrite.md; then exit 1; else echo "RED: T298 lacks T402 remote branch blocker evidence"; fi`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `rg -n "after T402|remote-branch-review|139 non-main|red - 6 R.11 pre-rewrite" docs/worklog/T298-rebrand-git-history-rewrite.md docs/tickets/T298-rebrand-git-history-rewrite.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED documentation check proves T298 lacked T402 remote branch evidence.
- [x] T298 records the T402 remote branch blocker.
- [x] T298 records the current explicit pre-rewrite count as six blockers.
- [x] T298 closeout ticket includes remote branch review.
- [x] T298 remains `Status: BLOCKED`.
- [x] Destructive R.11 actions are not executed.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T403-r11-remote-branch-blocker-refresh.md`.
