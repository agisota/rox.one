# T105 - Release Handoff Current Evidence

Status: DONE

## Context

The private RC release docs still describe the current handoff as ending at
T097, but the branch now contains T098-T104 productionization evidence:
Experience tab proof, Electron smoke stabilization, ROX.ONE backend copy,
start-script aliasing, packaged-smoke exit proof, runtime artifact git hygiene,
and dependency audit risk registration.

## Goal

Reconcile the top-level release handoff docs with current git truth through
T104 without changing public-production status.

## Required UI

No UI change.

## Required Data/API

- Update release docs only.
- Keep public production blocked.
- Keep dated historical evidence honest: do not rewrite old command results as
  newly rerun full-suite proof.

## Required Automations

- Add a focused release-current-handoff contract test that fails while release
  docs omit T098-T104 and passes after reconciliation.

## Required Subagents

No subagent required: this is a bounded release documentation slice.

## TDD Requirements

Before implementation:

1. Add the focused release-current-handoff contract test.
2. Run it and confirm it fails on stale release docs.

## Implementation Requirements

- Link T104 dependency risk-register evidence where public-production blockers
  are listed.
- Do not touch dependency manifests, runtime artifacts, or source behavior.
- Preserve private RC versus public production boundary.

## Validation Commands

- `bun test scripts/__tests__/release-current-handoff-contract.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Release-current-handoff contract test fails before doc updates and passes after | DONE |
| Final RC doc lists T098-T104 with concrete commit hashes | DONE |
| Current state snapshot describes the T098-T104 continuation layer | DONE |
| Production readiness matrix acknowledges T104 dependency risk-register evidence | DONE |
| Public-production blocked status remains explicit | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T105-release-handoff-current-evidence.md`.
