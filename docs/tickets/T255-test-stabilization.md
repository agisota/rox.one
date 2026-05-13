# T255 - test stabilization sweep + edge-case coverage

Status: DONE

## Context

We are building a white-label fork of ROX.ONE OSS into Agent Workbench Suite (ROX.ONE).

M.15 is the release-stabilization milestone. T255 is the first of two test-focused
tickets in the milestone:

- T255 (this ticket): add deterministic edge-case coverage on the highest-risk
  RBAC and observability surfaces, inventory skipped/exclusive tests, and
  document the flakiness backlog.
- T256 (deferred): drive the pre-existing 270 failing tests to green by
  fixing source-level wiring (SDK resolution, IPC contracts, etc.).

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Land a test-only PR that:

1. Adds ≥5 new unit tests on previously-untested edge cases.
2. Surfaces every `.skip` / `.only` / `xit` / `fdescribe` in the corpus.
3. Documents the test suite's pass/fail/skip baseline so T256 has a target.

No source files under `packages/` or `apps/` are modified. The validators
(`validate:rebrand`, `validate:agent-contract`, `validate:roadmap`) all
remain green.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None — pure test addition.

## Required Subagents

Not required for this ticket; pure-function edge-case test authoring.

## TDD Requirements

Edge-case unit tests added against:

- `packages/shared/src/auth/policy-engine.ts` (18 new tests in
  `policy-engine.edge-cases.test.ts`)
- `packages/shared/src/observability/audit-event.ts` (25 new tests in
  `audit-event.edge-cases.test.ts`)

All new tests pass against the unmodified source on `origin/main`.

## Implementation Requirements

Test files are additive only. No source under `packages/`/`apps/` may be
modified. No existing tests may be removed or rewritten. Documents:

- `docs/release/test-stability-report.md` (NEW, ≤150 LOC)
- `docs/tickets/T255-test-stabilization.md` (this file)
- `docs/worklog/T255-test-stabilization.md`

## Validation Commands

```
bun test packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts
bun test packages/shared/src/observability/__tests__/audit-event.edge-cases.test.ts
bun test packages/shared/src/observability/__tests__/
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

All commands must pass.

## Acceptance Criteria

- [x] ≥5 new unit tests added across two source surfaces
- [x] Skipped / exclusive test inventory captured in stability report
- [x] No source under `packages/`/`apps/` modified
- [x] No existing tests removed or modified
- [x] `validate:rebrand`, `validate:agent-contract`, `validate:roadmap` pass
- [x] Test stability report ≤150 LOC and at `docs/release/test-stability-report.md`
- [x] Two atomic commits on `feat/M15-test-stabilization`
- [x] Worklog complete

## Worklog

See `docs/worklog/T255-test-stabilization.md`.
