# T104 - Dependency Audit Risk Register

Status: DONE

## Context

Public production remains blocked by dependency audit and external security
review. Earlier security work recorded that `bun audit` failed with known
vulnerable transitive packages, but the current RC release docs do not contain a
dedicated accepted-risk register that operators can review before deciding what
to remediate, defer, or isolate.

## Goal

Create a current dependency audit risk register for the private RC handoff:
capture the live audit result, classify the production impact, and link the
release matrix to that register without pretending public production is
unblocked.

## Required UI

No UI change.

## Required Data/API

- No dependency upgrades in this slice.
- No package-manager lockfile edits in this slice.
- Add a release risk-register document under `docs/release/`.
- Keep public production blocked until remediation, accepted-risk approval, and
  external review are complete.

## Required Automations

- Add a focused regression test that requires the dependency risk register and
  release-matrix linkage.
- Run the live dependency audit and record its result.

## Required Subagents

No subagent required: this is a bounded release/security documentation slice.

## TDD Requirements

Before implementation:

1. Add the focused risk-register doc contract test.
2. Run it and confirm it fails while the register/linkage are missing.

## Implementation Requirements

- Do not edit `bun.lock`, `package.json`, or dependency versions.
- Do not weaken the public-production blocked status.
- Keep the output actionable: severity counts, concrete package examples, likely
  runtime exposure, remediation lane, and verification command.

## Validation Commands

- `bun test scripts/__tests__/dependency-risk-register-contract.test.ts`
- `bun audit`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Risk-register contract test fails before the doc/linkage and passes after | DONE |
| Live dependency audit result is recorded | DONE |
| Release matrix links to the dependency risk register | DONE |
| Public-production blocked status remains explicit | DONE |
| No dependency manifests or lockfiles are changed | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T104-dependency-audit-risk-register.md`.
