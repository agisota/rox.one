# T381 - R.11 local path runbook repair

Status: DONE

## Context

The R.11 goal runbook still contains stale local checkout paths under
`/home/dev/rox/rox-one-terminal`, while the active checkout is
`/home/dev/craft/rox-one-terminal`.

## Goal

Repair the R.11 backup and rollback snippets so a future operator can run the
documented commands from this workspace without cloning or changing directories
through a non-existent local path.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the R.11 goal documentation regression test so stale local checkout
paths fail before an operator reaches the destructive history rewrite step.

## Required Subagents

None.

## TDD Requirements

Add the failing goal-document regression test first. Confirm it fails because
the current goal document still references `/home/dev/rox/rox-one-terminal`.

## Implementation Requirements

- Replace stale `/home/dev/rox/rox-one-terminal` references in the R.11 goal
  runbook with `/home/dev/craft/rox-one-terminal`.
- Keep the R.11 destructive-history blocker intact.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before the runbook path repair.
- [x] Regression test passes after the runbook path repair.
- [x] R.11 goal document no longer contains `/home/dev/rox/rox-one-terminal`.
- [x] R.11 goal document contains `file:///home/dev/craft/rox-one-terminal`.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T381-r11-local-path-runbook-repair.md`.
