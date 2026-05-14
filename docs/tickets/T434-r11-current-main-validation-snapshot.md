# T434 - R.11 current-main validation snapshot wording

Status: DONE

## Context

The R.11 completion audit points at
`docs/release/r11-current-main-validation-2026-05-14.md` as the pre-rewrite
full-matrix validation evidence. Later report-only audit tickets add new ticket
files, so the exact `validate:agent-contract` ticket count in that captured
report is not a live count.

## Goal

Clarify the audit, validation report, and T298 worklog so the T429 full-matrix
run is treated as a dated snapshot, while later report-only tickets rely on
their own targeted validation evidence.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- Regression tests must fail before the wording update and pass after it.
- No R.11 destructive commands are allowed.

## Required Subagents

None.

## TDD Requirements

- Extend the R.11 completion audit regression tests first.
- Confirm the new assertions fail because the snapshot wording is absent.
- Update only documentation and tests.

## Implementation Requirements

- Do not update the report by chasing the latest ticket count.
- Preserve the existing full-matrix command counts as captured evidence.
- Make clear that subsequent audit-hygiene tickets carry their own fresh
  validation evidence.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight` (expected red while R.11 blockers remain)

## Acceptance Criteria

- [x] RED assertions fail before implementation.
- [x] Current-main validation report identifies the full matrix as a captured
  snapshot, not live ticket-count evidence.
- [x] Completion audit references the snapshot without claiming it is the
  latest validation for every later audit-hygiene ticket.
- [x] T298 worklog points later report-only tickets to their own validation
  evidence.
- [x] Targeted tests and documentation validators pass.
- [x] No destructive R.11 action is performed.
