# T414 - R.11 completion audit blocker IDs

Status: DONE

## Context

The R.11 completion audit records the current report-only blocker matrix, but
some blocker rows are described in prose rather than by the exact executable
preflight IDs. Future resumed goal runs should be able to compare the audit
against `bun run rebrand:r11-preflight`, `bun run rebrand:r11-legal-preserve`,
and `bun run rebrand:r11-history-scan` without inferring names from prose.

## Goal

Tighten the completion-audit regression test and audit document so the current
blocker section lists the exact report-only blocker IDs while preserving the
`NOT ACHIEVED` stop condition and avoiding any destructive R.11 action.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 completion-audit test only.

## Required Subagents

None. This is a narrow documentation/test hardening task.

## TDD Requirements

Add the failing assertion before editing the audit document.

## Implementation Requirements

- Keep the completion audit marked `NOT ACHIEVED`.
- Keep `update_goal` forbidden in the audit.
- Record exact blocker IDs for default pre-backup, explicit pre-rewrite,
  legal-preserve, and history-scan report-only gates.
- Do not create backup refs, backup branches, offline mirrors, rewritten
  history, force-pushes, or tag mutations.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit test proves exact blocker IDs are missing.
- [x] Completion audit lists exact current blocker IDs.
- [x] Completion audit still says `NOT ACHIEVED` and forbids `update_goal`.
- [x] Targeted and documentation validation commands pass.

## Worklog

Update `docs/worklog/T414-r11-completion-audit-blocker-ids.md`.
