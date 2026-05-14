# T485 - Post-merge closeout documentation reconciliation

Status: DONE

## Context

After PR #218 merged into `main`, read-only audits found documentation drift:
ADR 0007 still described the original single demo caller even though T213
migrated the full workspace RPC surface, ADR 0005 still described the
`kind: 'workspace'` arm as reserved, and T482/T483 still marked hosted PR #218
validation as pending.

## Goal

Reconcile closeout documentation with the current main branch without changing
runtime behavior or performing destructive R.11 operations.

## Required UI

None.

## Required Data/API

No data model or API changes.

## Required Automations

None.

## Required Subagents

Read-only verifier and code-reviewer agents supplied the stale-documentation
findings.

## TDD Requirements

- Treat the read-only audit findings as RED evidence for documentation drift.
- Run docs validation after the reconciliation.

## Implementation Requirements

- Update ADR 0007 so it describes the current full workspace RPC migration.
- Update ADR 0005 so it no longer contradicts ADR 0007's implementation state.
- Update T482/T483 hosted validation checkboxes now that PR #218 is merged.
- Do not modify runtime code in this ticket.
- Do not perform destructive R.11 operations.

## Validation Commands

- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun test`

## Acceptance Criteria

- [x] ADR 0007 no longer claims only `workspaces.GET` is wired.
- [x] ADR 0005 no longer claims the `kind: 'workspace'` arm is only reserved.
- [x] T482/T483 no longer leave PR #218 hosted repo-controlled checks pending.
- [x] No runtime code changes are made for this ticket.
- [x] No destructive R.11 action is performed.
