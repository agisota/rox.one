# T415 - R.11 closeout audit pointer anti-drift

Status: DONE

## Context

T298 points readers to the durable R.11 completion audit, but it still names a
closed audit-hygiene ticket range. That range already drifted when T414 added
exact blocker-ID coverage, and future audit-hygiene commits should not require
another T298 wording update.

## Goal

Make the T298 closeout worklog point to the durable audit using stable wording
instead of a hardcoded audit-hygiene ticket range.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 closeout worklog documentation regression in
`scripts/__tests__/rebrand-r11-preflight.test.ts`.

## Required Subagents

None. This is a narrow documentation/test hardening task.

## TDD Requirements

Update the documentation regression first and confirm it fails while T298 still
contains the hardcoded range.

## Implementation Requirements

- Replace the hardcoded T409-T412 current-evidence pointer in T298 with stable
  wording.
- Keep T298 as `Status: BLOCKED`.
- Do not create backup refs, backup branches, offline mirrors, rewritten
  history, force-pushes, or tag mutations.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED regression test proves the hardcoded ticket range is still present.
- [x] T298 uses stable durable-audit pointer wording.
- [x] T298 remains `Status: BLOCKED`.
- [x] Targeted and documentation validation commands pass.

## Worklog

Update `docs/worklog/T415-r11-closeout-audit-pointer-anti-drift.md`.
