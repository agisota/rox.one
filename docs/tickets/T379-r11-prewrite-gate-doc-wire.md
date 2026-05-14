# T379 - R.11 pre-rewrite gate doc wire

Status: DONE

## Context

T378 split the R.11 preflight helper into the default pre-backup gate and the
explicit `--stage pre-rewrite` gate. The goal file still described only the
manual backup-artifact confirmation before `git filter-repo`.

## Goal

Wire the new pre-rewrite helper stage into the R.11 goal instructions so future
operators run the executable gate after backup creation and before
`git filter-repo`.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 documentation regression test to require the explicit
`bun run rebrand:r11-preflight --stage pre-rewrite` instruction.

## Required Subagents

None. The change is bounded to the goal file and the preflight regression test.

## TDD Requirements

Write the failing documentation regression first. The test must fail until the
goal file contains the exact pre-rewrite helper command.

## Implementation Requirements

- Add the post-backup `bun run rebrand:r11-preflight --stage pre-rewrite`
  instruction before the filter-repo plan.
- State that a non-zero pre-rewrite helper result stops R.11.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Documentation regression fails before the goal update.
- [x] Goal file names the exact pre-rewrite helper command.
- [x] Goal file stops operators on non-zero pre-rewrite helper result.
- [x] Targeted tests pass.
- [x] Documentation/rebrand validation remains green.
- [x] Commit created.

## Worklog

See `docs/worklog/T379-r11-prewrite-gate-doc-wire.md`.
