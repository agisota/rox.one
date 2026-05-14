# T370 - Rebrand R.11 preflight runner doc wire

Status: DONE

## Context

T369 added a report-only `bun run rebrand:r11-preflight` runner for R.11 hard
prerequisites. The canonical rebrand-sweep goal still lists only manual
commands, so future R.11 attempts can miss the executable gate.

## Goal

Wire the new report-only runner into the canonical R.11 instructions in
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`.

## Required UI

None.

## Required Data/API

None.

## Required Automations

Extend the focused R.11 preflight test so it asserts the canonical goal file
mentions `bun run rebrand:r11-preflight`.

## Required Subagents

None.

## TDD Requirements

Write the failing documentation contract test first, confirm it fails, then
update the goal file.

## Implementation Requirements

- Keep the R.11 runner report-only.
- Do not start R.11.
- Do not create backup tags, backup branches, or offline mirrors.
- Do not run `git filter-repo`.
- Do not force-push.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED documentation contract test captured before goal update.
- [x] Rebrand-sweep R.11 hard prerequisites mention the runner.
- [x] Focused R.11 preflight tests pass.
- [x] Runner still exits non-zero on current blocked repo state.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T370-rebrand-r11-preflight-runner-doc-wire.md`.
