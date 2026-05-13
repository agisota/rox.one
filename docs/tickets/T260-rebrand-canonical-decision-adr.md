# T260 - Rebrand canonical decision ADR

Status: DONE

## Context

Phase R.0 begins the ROX.ONE rebrand sweep after the C4 Phase 1 closeout landed
on `main`. The rebrand goal locks the canonical wordmark, package scope, env-var
policy, and legal-preserve boundary before any rename work begins.

## Goal

Add ADR 0011 documenting the canonical ROX.ONE brand tokens, the `@rox-one/*`
package scope, the `ROX_*` env-var policy with one-minor legacy fallback, and
the legal-preserve allowlist.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None for this documentation boundary task.

## TDD Requirements

Before implementation:

1. Run a failing file-existence assertion for ADR 0011.
2. Confirm the failure proves the ADR does not yet exist.

## Implementation Requirements

- Create `docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`.
- Copy the three locked decisions from the rebrand goal.
- Record the legal-preserve allowlist and Apache 2.0 attribution boundary.
- Link to `docs/release/rebrand-mapping-2026-05-13.md`.
- Do not edit legal preserve files.

## Validation Commands

- `test -f docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] ADR 0011 exists.
- [x] ADR 0011 records the canonical `ROX.ONE` written wordmark decision.
- [x] ADR 0011 records the `@rox-one/*` package-scope decision.
- [x] ADR 0011 records the `ROX_*` env-var policy and one-minor fallback.
- [x] ADR 0011 records the legal-preserve allowlist.
- [x] ADR 0011 links to the mapping report.
- [x] Docs validation passes.
- [x] Whitespace check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T260-rebrand-canonical-decision-adr.md`.
