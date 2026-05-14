# T409 - R.11 completion audit

Status: DONE

## Context

The active rebrand-sweep goal cannot be marked complete until every global
stopping condition in the goal file is backed by concrete evidence. Recent
R.11 report-only gates show the rewrite remains blocked.

## Goal

Create a durable completion audit that maps the goal's explicit global
requirements to current artifacts, command evidence, and blockers.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Add a focused regression test that requires the completion-audit document to
exist and include the prompt-to-artifact checklist.

## Required Subagents

None. This is a bounded audit/documentation task.

## TDD Requirements

Add the failing audit-document test before writing the audit document.

## Implementation Requirements

- Add `docs/release/r11-completion-audit-2026-05-14.md`.
- Restate the active objective as concrete deliverables.
- Map every global stopping condition and R.11 gate to current evidence.
- Identify incomplete, weakly verified, or blocked items.
- Explicitly state that the active goal must not be marked complete yet.
- Do not create backup refs, backup branches, mirrors, rewritten history,
  force-pushes, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED audit-document test fails before implementation.
- [x] Completion audit document exists.
- [x] Audit document maps all global stopping conditions to evidence.
- [x] Audit document records current blockers and stop condition.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T409-r11-completion-audit.md`.
