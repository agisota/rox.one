# T111 - Accepted Risk Guard Evidence Sync

Status: DONE

## Context

T110 added a public-untrusted custom endpoint guard after T109 created the
accepted-risk register. The dependency risk register now mentions T110, but the
accepted-risk register row for the current not-accepted dependency-audit risk
still lists only T106/T107/T108 as local guard evidence.

## Goal

Keep the accepted-risk release evidence aligned with the current guard set so
operators do not read stale public-production blocker context.

## Required UI

No UI change.

## Required Data/API

- Keep the current dependency risk decision as `Not accepted`.
- Keep public production blocked.
- Make the accepted-risk register reference the current T106/T107/T108/T110
  runtime guard evidence.
- Do not change dependency versions, package manifests, or lockfiles.

## Required Automations

- Add a contract test assertion that the accepted-risk register includes the
  current guard evidence sequence.
- Keep docs validation green.

## Required Subagents

No subagent required: this is a bounded release-evidence consistency slice.

## TDD Requirements

Before implementation:

1. Add the accepted-risk evidence-sync assertion.
2. Run the focused contract test and confirm it fails while T110 is missing
   from the accepted-risk row.

## Implementation Requirements

- Update only release evidence/docs needed for the contract.
- Do not weaken any public-production blocked language.

## Validation Commands

- `bun test scripts/__tests__/dependency-risk-register-contract.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Contract test fails before accepted-risk evidence sync and passes after | DONE |
| Accepted-risk row references T106/T107/T108/T110 guard evidence | DONE |
| Current dependency risk remains `Not accepted` | DONE |
| Public production remains blocked | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T111-accepted-risk-guard-evidence-sync.md`.
