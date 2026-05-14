# T422 - R.11 operator unblock checklist

Status: DONE

## Context

The active R.11 goal remains blocked by hard destructive-preflight
prerequisites. The durable completion audit records current blockers, but it
does not yet separate agent-safe report-only status from operator-owned unblock
decisions.

## Goal

Add an explicit operator-owned unblock checklist to the durable R.11 completion
audit so resumed runs cannot confuse documented blockers with authorization to
mutate tags, create backup refs, rewrite history, force-push, or clean remote
branches.

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
the audit lacks an operator-owned unblock checklist.

## Implementation Requirements

- Add a durable `Operator-Owned Unblock Checklist` section to the audit.
- Make clear that the checklist is not authorization for this active run.
- Preserve the `NOT ACHIEVED` status and destructive-action prohibition.
- Do not create backup refs, backup branches, offline mirrors, rewritten
  history, force-pushes, branch cleanup, or tag mutations.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit test proves the operator-unblock section is absent.
- [x] Audit lists operator-owned unblock decisions for active goal state, tag
  reconciliation, remote branch review, backup artifacts, legal-preserve, and
  history scan.
- [x] Audit states the checklist does not authorize destructive work in the
  current run.
- [x] Targeted and documentation validation commands pass.

## Worklog

Update `docs/worklog/T422-r11-operator-unblock-checklist.md`.
