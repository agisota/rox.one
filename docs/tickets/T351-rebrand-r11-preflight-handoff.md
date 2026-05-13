# T351 - Rebrand R.11 preflight handoff

Status: DONE

## Context

The rebrand sweep goal's final R.11 phase is a destructive git-history rewrite.
After PR #143 merged, the non-destructive prerequisites were rechecked on
current `origin/main`. The destructive rewrite still cannot start inside the
active Codex goal because R.11 requires no active goal runs before
`git filter-repo`.

## Goal

Record the current R.11 preflight evidence and blocker set so the operator can
pause/clear goal mode and run the destructive rewrite with a fresh, explicit
R.11 closeout ticket.

## Required UI

None.

## Required Data/API

No runtime, data, or API changes.

## Required Automations

Use the actual CLI preflight checks from the R.11 contract and record their
outputs in the worklog.

## Required Subagents

None.

## TDD Requirements

No code test is required. The red condition is the R.11 prerequisite audit:
active goal state, missing backup tag, missing offline mirror, and absent
`T298-rebrand-git-history-rewrite`.

## Implementation Requirements

- Do not run `git filter-repo`.
- Do not create or push the R.11 backup tag/branch while prerequisites fail.
- Do not append an R.11 completion line to `.swarm/master-roadmap-log.md`.
- Keep this ticket documentation-only.

## Validation Commands

- `git status --short --branch`
- `git rev-list --left-right --count origin/main...HEAD`
- `gh pr list --state open --limit 50 --json number,title,url`
- `git ls-remote --tags origin rebrand-v1 pre-rebrand-history-rewrite-backup`
- `test -d /tmp/rox-one-terminal-backup-2026-05-13.git`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Current `main` is synced with `origin/main`.
- [x] Open PR list is empty.
- [x] Active goal state is recorded as the blocker that prevents R.11 start.
- [x] Missing backup tag and offline mirror are recorded.
- [x] Absence of `T298-rebrand-git-history-rewrite` is recorded.
- [x] No destructive R.11 command was run.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T351-rebrand-r11-preflight-handoff.md`.
