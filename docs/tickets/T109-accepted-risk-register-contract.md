# T109 - Accepted Risk Register Contract

Status: DONE

## Context

T104 records the current dependency audit blocker and says public production can
only proceed after remediation, isolation, or a signed accepted-risk decision.
The dependency risk register mentions that gate, but there is no dedicated
accepted-risk register file or regression contract that makes the approval
schema reviewable.

## Goal

Add a release-level accepted-risk register contract for unresolved dependency
advisories. The contract must make the current decision explicit: no unresolved
public-production dependency risk is accepted yet.

## Required UI

No UI change.

## Required Data/API

- Add a release document under `docs/release/`.
- Do not change dependency versions, package manifests, or lockfiles.
- Keep public production blocked unless each unresolved advisory has a signed
  accepted-risk item plus production isolation evidence.

## Required Automations

- Extend the focused dependency risk register regression test to require the
  accepted-risk register and release-doc linkage.
- Keep docs validation green.

## Required Subagents

No subagent required: this is a bounded release/security documentation slice.

## TDD Requirements

Before implementation:

1. Extend the focused dependency risk register contract test.
2. Run it and confirm it fails while the accepted-risk register/linkage is
   missing.

## Implementation Requirements

- Define required approval fields: risk ID, dependency/advisory, affected path,
  severity, decision, owner, expiration, compensating control, rollback plan,
  and evidence.
- Include a current not-accepted row for the live dependency audit blocker.
- Link the accepted-risk register from the dependency risk register and
  production readiness matrix.
- Do not weaken the public-production blocked status.

## Validation Commands

- `bun test scripts/__tests__/dependency-risk-register-contract.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Contract test fails before accepted-risk register/linkage and passes after | DONE |
| Accepted-risk register exists with required approval fields | DONE |
| Current public-production dependency risk decision is explicitly not accepted | DONE |
| Dependency risk register links to the accepted-risk register | DONE |
| Production readiness matrix links to the accepted-risk register | DONE |
| Public-production blocked status remains explicit | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T109-accepted-risk-register-contract.md`.
