# T425 - R.11 history scan inventory

Status: DONE

## Context

The R.11 completion audit records the bounded history-scan blocker count, but
does not preserve a durable sanitized inventory of the first findings that make
the blocker red.

## Goal

Create a report-only, sanitized history-scan inventory for the R.11 blocker
without adding new historical legacy-token patch lines.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 completion-audit regression assertion so the audit
points to the sanitized history-scan inventory.

## Required Subagents

None. This is a narrow report-only audit artifact.

## TDD Requirements

Add the failing completion-audit assertion first and confirm it fails because
the history-scan inventory does not exist yet.

## Implementation Requirements

- Add `docs/release/r11-history-scan-inventory-2026-05-14.md`.
- Record the bounded command, red status, 9 matches observed at the cutoff, and
  8 listed findings before truncation.
- Preserve commit and path evidence while sanitizing token and line text.
- Do not mutate refs, tags, branches, backups, mirrors, or history.
- Do not add new raw legacy-token strings that would increase the history-scan
  blocker.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `REBRAND_R11_HISTORY_MAX_FINDINGS=8 bun run rebrand:r11-history-scan`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit assertion proves the history-scan inventory is
  absent.
- [x] History-scan report records 9 matches observed at the cutoff and 8 listed
  sanitized findings.
- [x] History-scan report preserves commit/path evidence without raw
  legacy-token strings.
- [x] Targeted, history-scan, and documentation validation commands produce the
  expected results.

## Worklog

Update `docs/worklog/T425-r11-history-scan-inventory.md`.
