# T387 - R.11 backup branch blocker refresh

Status: DONE

## Context

T386 added a report-only pre-rewrite check for the mandatory R.11 backup
branch. T298's blocker evidence still lists only backup tag and offline mirror
as pre-rewrite backup-artifact blockers.

## Goal

Refresh T298 so the R.11 closeout surface records the backup branch as a
pre-rewrite blocker alongside the backup tag and offline mirror.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No automation changes. This is a closeout evidence refresh.

## Required Subagents

None.

## TDD Requirements

Use the stale T298 marker as RED evidence: T298's current pre-rewrite summary
must still say `red - 2 R.11 pre-rewrite prerequisite(s) failing` before this
refresh.

## Implementation Requirements

- Add the backup branch row to T298's prerequisite matrix.
- Update T298's current follow-up evidence to T387.
- Record the live post-T386 pre-rewrite evidence with three blockers:
  `backup-tag`, `backup-branch`, and `offline-mirror`.
- Keep T298 `Status: BLOCKED`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `rg -n "red - 2 R\\.11 pre-rewrite" docs/worklog/T298-rebrand-git-history-rewrite.md`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] T298 records backup branch as a pre-rewrite blocker.
- [x] T298 current evidence label is refreshed to T387.
- [x] T298 records pre-rewrite red on three backup artifacts.
- [x] T298 remains `Status: BLOCKED`.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T387-r11-backup-branch-blocker-refresh.md`.
