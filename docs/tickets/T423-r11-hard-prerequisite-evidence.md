# T423 - R.11 hard prerequisite evidence

Status: DONE

## Context

The R.11 completion audit records the current blocker set and operator-owned
unblock decisions, but it does not yet enumerate every one of the 11 hard
prerequisites from the goal file as pass/fail evidence.

## Goal

Add a durable evidence table that maps each R.11 hard prerequisite to current
evidence, so completion audits cannot rely on the aggregate preflight result
alone.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 completion-audit regression assertion.

## Required Subagents

None. This is a narrow documentation/test hardening task.

## TDD Requirements

Update the failing completion-audit assertion first and confirm it fails
because the audit lacks a hard-prerequisite evidence table.

## Implementation Requirements

- Add `R.11 Hard Prerequisite Evidence` to the audit.
- Cover all 11 hard prerequisites from the goal file.
- Preserve the current `NOT ACHIEVED` status.
- Do not create backup refs, backup branches, offline mirrors, rewritten
  history, force-pushes, branch cleanup, or tag mutations.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit assertion proves the hard-prerequisite table is
  absent.
- [x] Audit maps all 11 hard prerequisites to current pass/fail evidence.
- [x] Audit still says `NOT ACHIEVED`.
- [x] Targeted and documentation validation commands pass.

## Worklog

Update `docs/worklog/T423-r11-hard-prerequisite-evidence.md`.
