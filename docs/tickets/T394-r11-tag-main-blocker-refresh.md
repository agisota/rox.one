# T394 - R.11 tag main blocker refresh

Status: DONE

## Context

T393 added a report-only preflight check that proves the remote `rebrand-v1`
tag target is on `origin/main` ancestry. Post-push preflight shows the tag
exists but is not currently on `origin/main`.

## Goal

Record the new `rebrand-tag-on-main` blocker in T393 and T298 without
re-pointing tags or performing any destructive R.11 action.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

No automation changes. This is a documentation-only evidence refresh.

## Required Subagents

None.

## TDD Requirements

Use the post-push preflight output from T393 as evidence. The default preflight
must show `rebrand-tag-on-main` failing alongside the active-goal blocker.

## Implementation Requirements

- Mark T393 ticket/worklog `Status: DONE`.
- Record post-push `rebrand-tag-on-main` evidence in T393.
- Refresh T298's blocker matrix and current evidence.
- Do not re-point `rebrand-v1`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] T393 ticket is `Status: DONE`.
- [x] T393 worklog is `Status: DONE`.
- [x] T298 records `rebrand-tag-on-main` as a blocker.
- [x] T298 remains `Status: BLOCKED`.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T394-r11-tag-main-blocker-refresh.md`.
