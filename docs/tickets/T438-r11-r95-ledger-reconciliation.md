# T438 - R.11 R.9.5 ledger reconciliation

Status: DONE

## Context

T437 hardened the R.11 preflight around the actual R.9.5 ticket pair,
T298a/T300a. The `.swarm/master-roadmap-log.md` R.9.5 line still lists
`T298a,T299a,T300a`, but current repo evidence and git history do not contain a
T299a ticket or worklog.

## Goal

Reconcile the R.9.5 ledger so every durable closeout artifact names the same
actual ticket pair before any future R.11 destructive window.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- Add a failing regression that catches the phantom T299a ledger entry.
- No R.11 destructive commands are allowed.

## Required Subagents

None.

## TDD Requirements

- Extend the R.11 preflight regression to assert the R.9.5 ledger line names
  `T298a,T300a` and not `T299a`.
- Confirm RED before editing `.swarm/master-roadmap-log.md`.

## Implementation Requirements

- Update only the R.9.5 line in `.swarm/master-roadmap-log.md`.
- Do not create a T299a artifact.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight` (expected red while existing hard blockers remain)

## Acceptance Criteria

- [x] RED assertion fails on the stale R.9.5 ledger line.
- [x] `.swarm/master-roadmap-log.md` R.9.5 line names `T298a,T300a`.
- [x] No T299a ticket/worklog is created.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
