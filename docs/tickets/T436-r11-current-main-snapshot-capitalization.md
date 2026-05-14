# T436 - R.11 current-main snapshot capitalization

Status: DONE

## Context

The T429 current-main validation snapshot now correctly says later
audit-hygiene tickets carry their own validation evidence, but the sentence
starts with lowercase `later`.

## Goal

Make the snapshot wording read as normal prose and prevent the lowercase
paragraph opener from returning.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- Add a regression assertion before changing the report.
- No R.11 destructive commands are allowed.

## Required Subagents

None.

## TDD Requirements

- Update the R.11 completion audit regression to expect the capitalized
  sentence and reject the lowercase paragraph opener.
- Confirm RED before editing the report.

## Implementation Requirements

- Capitalize the sentence in
  `docs/release/r11-current-main-validation-2026-05-14.md`.
- Do not alter captured validation counts.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails on lowercase paragraph opener.
- [x] Snapshot report uses capitalized prose.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
