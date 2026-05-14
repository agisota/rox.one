# T368 - Rebrand R.11 preflight refresh

Status: DONE

## Context

The active goal still points at
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`.
That goal cannot be marked complete until the destructive R.11 history rewrite
has run and passed its post-rewrite validation matrix.

T351 previously recorded an R.11 handoff, but its evidence is now stale: the
fresh PR preflight no longer matches T351's "open PR list is empty" evidence.

## Goal

Refresh the R.11 preflight blocker evidence without starting the destructive
history rewrite. The output is an explicit handoff showing which hard
prerequisites currently fail.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use the R.11 prerequisite commands from the rebrand-sweep goal and record the
fresh outputs in the worklog.

## Required Subagents

None.

## TDD Requirements

No code test is required. The red check is the R.11 prerequisite audit against
actual repo, GitHub, goal, tag, mirror, and tooling state.

## Implementation Requirements

- Do not run `git filter-repo`.
- Do not create or push the R.11 backup tag/branch while prerequisites fail.
- Do not force-push any ref.
- Do not append an R.11 completion line to `.swarm/master-roadmap-log.md`.
- Keep this ticket documentation-only.

## Validation Commands

- `get_goal`
- `gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName`
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`
- `test -d /tmp/rox-one-terminal-backup-2026-05-13.git`
- `command -v git-filter-repo`
- `git rev-list --left-right --count origin/main...main`
- `git status --porcelain`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Fresh active-goal state is recorded.
- [x] Fresh open-PR blocker list is recorded.
- [x] Missing backup tag and offline mirror are recorded.
- [x] Missing `git-filter-repo` tooling is recorded.
- [x] The current `main` sync state is recorded.
- [x] No destructive R.11 command was run.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T368-rebrand-r11-preflight-refresh.md`.
