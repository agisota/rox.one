# T435 - R.11 current-main freshness wording cleanup

Status: DONE

## Context

T434 clarified that `docs/release/r11-current-main-validation-2026-05-14.md`
is a captured T429 full-matrix snapshot. One caveat sentence still calls the
report "freshness evidence", which can be misread as live validation evidence
after later audit-hygiene tickets land.

## Goal

Remove the remaining live-freshness wording from the current-main validation
snapshot while preserving its captured full-matrix evidence.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- Regression coverage must fail before the wording update.
- No destructive R.11 commands are allowed.

## Required Subagents

None.

## TDD Requirements

- Extend the R.11 completion audit regression test to reject `freshness
  evidence` in the current-main validation report.
- Confirm RED before updating the report.

## Implementation Requirements

- Replace the remaining freshness wording with captured-snapshot wording.
- Do not alter the captured T429 command counts.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails on the stale freshness wording.
- [x] Current-main validation report no longer calls the snapshot freshness
  evidence.
- [x] Targeted test and docs validators pass.
- [x] No destructive R.11 action is performed.
