# T397 - R.11 tag prerequisite doc wire

Status: DONE

## Context

T393 and T395 added report-only preflight rows for `rebrand-tag-on-main` and
`rebrand-tag-local-sync`. The executable helper now fails closed when origin's
`rebrand-v1` target is off `origin/main` or when the local tag target differs
from origin, but the canonical R.11 hard-prerequisite list still only says the
tag exists.

## Goal

Wire the new tag-target prerequisites into the canonical R.11 goal text and
the spine references so the runbook matches the executable preflight gate.

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
goal file names both tag-target prerequisites:

- origin's `rebrand-v1` target is on `origin/main`;
- local `rebrand-v1` matches origin.

## Implementation Requirements

- Update the R.11 hard-prerequisite list in the rebrand-sweep goal.
- Update spine text that says R.11 has exactly nine hard prerequisites.
- Do not change any R.11 command sequence.
- Do not re-point `rebrand-v1`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before documentation update.
- [x] Regression test passes after documentation update.
- [x] R.11 hard-prerequisite list includes tag-on-main.
- [x] R.11 hard-prerequisite list includes local/remote tag sync.
- [x] Spine text no longer says the stale "nine hard prerequisites" count.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T397-r11-tag-prereq-doc-wire.md`.
