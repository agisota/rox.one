# T426 - R.11 legal preserve inventory

Status: DONE

## Context

The R.11 completion audit records that the legal-preserve gate is red because
the required backup tag is missing, but it does not preserve a durable report
with the exact failing and passing legal-preserve rows.

## Goal

Create a read-only legal-preserve inventory for the R.11 blocker.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 completion-audit regression assertion so the audit
points to the durable legal-preserve inventory.

## Required Subagents

None. This is a narrow report-only audit artifact.

## TDD Requirements

Add the failing completion-audit assertion first and confirm it fails because
the legal-preserve inventory does not exist yet.

## Implementation Requirements

- Add `docs/release/r11-legal-preserve-inventory-2026-05-14.md`.
- Record the legal-preserve source command.
- Record the three failing legal-file rows and the passing Dockerfile
  attribution row.
- Make clear that the backup tag is missing and must not be created from this
  blocked report-only run.
- Do not mutate refs, tags, branches, backups, mirrors, or history.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run rebrand:r11-legal-preserve`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit assertion proves the legal-preserve inventory is
  absent.
- [x] Legal-preserve report records the three failing legal-file rows.
- [x] Legal-preserve report records the passing Dockerfile attribution row.
- [x] Targeted, legal-preserve, and documentation validation commands produce
  the expected results.

## Worklog

Update `docs/worklog/T426-r11-legal-preserve-inventory.md`.
