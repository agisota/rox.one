# T412 - R.11 closeout worklog audit pointer

Status: DONE

## Context

The T298 R.11 closeout worklog still describes current evidence as "T375
through T408", but T409-T411 now provide the durable completion audit and
current-main validation evidence. The worklog should point to that audit
surface instead of freezing an older ticket range.

## Goal

Keep the T298 R.11 closeout worklog aligned with the durable completion audit
while preserving its `Status: BLOCKED` destructive-action stop.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Add a regression test that fails if the T298 worklog drifts back to the stale
T375-through-T408 evidence range.

## Required Subagents

None. This is a narrow documentation/test hygiene update.

## TDD Requirements

Add the failing regression test before editing the T298 worklog.

## Implementation Requirements

- Update `docs/worklog/T298-rebrand-git-history-rewrite.md` to point to
  `docs/release/r11-completion-audit-2026-05-14.md`.
- Remove the stale "T375 through T408" phrasing.
- Keep T298 `Status: BLOCKED`.
- Do not create backup refs, backup branches, mirrors, rewritten history,
  force-pushes, tag mutations, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED worklog audit-pointer test fails before implementation.
- [x] T298 worklog points to the durable R.11 completion audit.
- [x] T298 worklog no longer freezes current evidence as T375-through-T408.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T412-r11-closeout-worklog-audit-pointer.md`.
