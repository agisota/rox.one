# T413 - R.11 closeout context audit pointer

Status: DONE

## Context

The T298 R.11 closeout worklog now points its follow-up evidence section at
the durable completion audit, but its repo-context section still says the
current report-only preflight evidence is "after T402". That phrase is stale
after T409-T412 landed.

## Goal

Keep the T298 repo-context section aligned with the durable audit pointer
instead of anchoring it to an older ticket.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the R.11 preflight documentation regression test to reject the stale
T402 context phrase and require the current T409-T412 audit pointer.

## Required Subagents

None. This is a narrow documentation/test hygiene update.

## TDD Requirements

Add the failing regression test before editing the T298 worklog.

## Implementation Requirements

- Update `docs/worklog/T298-rebrand-git-history-rewrite.md` so the repo
  context points at `docs/release/r11-completion-audit-2026-05-14.md`.
- Replace stale T409-T411 wording with T409-T412 where it describes current
  audit ownership.
- Remove the stale "after T402" phrase from current evidence.
- Keep T298 `Status: BLOCKED`.
- Do not create backup refs, backup branches, mirrors, rewritten history,
  force-pushes, tag mutations, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED context audit-pointer test fails before implementation.
- [x] T298 repo context points to the durable R.11 completion audit.
- [x] T298 current evidence no longer says "after T402".
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T413-r11-closeout-context-audit-pointer.md`.
