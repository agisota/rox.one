# T340 - RC Scenario S02: Raw Prompt → Rewrite → Spec → TDD → Review

Status: Blocked

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.
Phase 20 of the master roadmap runs the ten release-candidate scenarios end-to-end
on a clean Electron build and captures pass/fail evidence.

This ticket covers **RC Scenario 2** from `plan.md §16`:

> Raw prompt → Rewrite → Spec → TDD → Review.

The scenario exercises the end-to-end Composer pipeline through all four
product-mode stages: the Prompt Rewrite Engine (T008), the Spec Builder screen
(T011/T012), the TDD mode task generation (T031), and the Review Board (T013).
Each stage must hand off cleanly to the next without data loss, and the final
Review Board must gate on the validation results produced by T014.

## Goal

Verify that a user can enter a raw freeform prompt in the Composer, trigger the
rewrite pipeline, progress through spec compilation and TDD scaffolding, and
reach a populated Review Board that reflects the TDD output — all within a single
session, without manual context bridging between stages.

## Required UI

- Composer freeform input with mode-selector toolbar
- Prompt rewrite preview panel
- Spec Builder screen with compilation export
- TDD mode task-generation view
- Review Board with pass/fail gate indicators

## Required Data/API

- Prompt Rewrite Engine RPC (`/rpc/prompt.rewrite`)
- Spec Builder compile RPC (`/rpc/spec.compile`)
- TDD task-generation RPC (`/rpc/tdd.generateTasks`)
- Review Board validation gate RPC (`/rpc/review.gate`)
- Shared session context carrying the artefact chain across stages

## Required Automations

- Each stage automatically populates the next stage's input from the previous
  output (artefact chain)
- Review Board auto-populated with TDD task results on first render

## Required Subagents

None for this validation ticket.

## TDD Requirements

1. Integration test: submit a known prompt → assert rewrite output is non-empty
   and structurally valid.
2. Integration test: compile rewrite output into a spec → assert the exported
   spec JSON passes the schema validator.
3. Integration test: feed spec JSON into TDD mode → assert at least one task is
   generated.
4. Integration test: feed TDD output into Review Board → assert gate status is
   computable.

## Implementation Requirements

No new implementation. This is an RC validation scenario.
Any regressions found should be filed as blocking tickets before Phase 20 can
close.

## Validation Commands

```bash
# Smoke run via E2E harness
bun run e2e:smoke -- --scenario s02-prompt-pipeline

# Targeted Composer + pipeline tests
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx
bun test packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts packages/shared/src/workbench/__tests__/spec-compiler.test.ts packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts packages/shared/src/workbench/__tests__/review-board.test.ts

# Agent contract gate
bun run validate:agent-contract
```

## Acceptance Criteria

- [ ] Freeform raw prompt submitted in Composer reaches the Rewrite Engine
- [ ] Rewrite output is displayed in the preview panel without errors
- [ ] Spec Builder is populated from the rewrite output
- [ ] Compiled spec export passes the schema validator
- [ ] TDD mode generates at least one task from the compiled spec
- [ ] Review Board is reachable and shows gate status derived from TDD output
- [ ] No unhandled errors in the browser console throughout the flow
- [ ] Screenshot evidence captured and referenced in
      `docs/release/2026-05-14-rc-evidence.md`
- [ ] Pass/fail status updated in the RC evidence table (row S02)

## Worklog

Update `docs/worklog/T340-rc-s02-prompt-pipeline-flow.md` with run log,
screenshots, and any blocker ticket references.

## Current Blocker

- `T353-rc-s02-smoke-harness-and-command-repair.md` repaired the missing S02
  harness registry entry and stale targeted command paths. S02 still needs a
  full RC evidence rerun with screenshot/browser-console evidence before this
  ticket can move to `DONE`.
