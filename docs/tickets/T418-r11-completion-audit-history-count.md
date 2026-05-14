# T418 - R.11 completion audit history count

Status: DONE

## Context

The durable R.11 completion audit records that the history scan is red, but its
current blocker section does not preserve the concrete count from the
report-only `rebrand:r11-history-scan` helper. Fresh evidence reports 9
forbidden-token patch lines outside the legal-preserve allowlist.

## Goal

Record the current history-scan finding count in the durable R.11 completion
audit.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 completion-audit regression test.

## Required Subagents

None. This is a narrow documentation/test hardening task.

## TDD Requirements

Add the failing completion-audit assertion first and confirm it fails because
the audit lacks the current history-scan finding count.

## Implementation Requirements

- Record `9 forbidden-token patch lines` in the audit's current blocker
  section.
- Keep the completion audit marked `NOT ACHIEVED`.
- Do not create backup refs, backup branches, offline mirrors, rewritten
  history, force-pushes, or tag mutations.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit test proves the history count is missing.
- [x] Completion audit records the current history-scan finding count.
- [x] Completion audit still says `NOT ACHIEVED`.
- [x] Targeted and documentation validation commands pass.

## Worklog

Update `docs/worklog/T418-r11-completion-audit-history-count.md`.
