# T399 - R.11 backup branch stop condition wire

Status: DONE

## Context

T386 made the backup branch a required pre-rewrite artifact, and T398 updated
the R.11 runbook prose before the pre-rewrite helper. The R.11 stopping
conditions still mention only the backup tag and backup mirror, while the
pre-rewrite gate requires the backup branch too.

## Goal

Make the R.11 phase stopping condition and global stopping condition include
the backup branch alongside the backup tag and offline mirror.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the focused R.11 goal documentation regression in
`scripts/__tests__/rebrand-r11-preflight.test.ts`.

## Required Subagents

None.

## TDD Requirements

Write the failing documentation regression first. It must fail until the R.11
goal file includes the backup branch in both the phase stopping condition and
the global stopping condition.

## Implementation Requirements

- Update only R.11 stopping-condition text.
- Do not change R.11 commands.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not re-point `rebrand-v1`.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before documentation update.
- [x] Regression test passes after documentation update.
- [x] R.11 phase stopping condition includes backup branch.
- [x] Global stopping condition includes backup branch.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T399-r11-backup-branch-stop-condition-wire.md`.
