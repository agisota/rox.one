# T337 - Test suite type and DOM isolation repair

Status: DONE

## Context

Post-merge validation after the T302 BrowserCDP isolation repair exposed
unrelated test-suite hygiene failures:

- `bun run typecheck` rejected tests that compared branded IDs to raw strings
  or imported a type as a runtime value.
- `bun test packages/ui/src/components` failed when
  `pdf-preview-overlay.test.tsx` leaked its mini DOM globals into later
  markdown and annotation tests.

## Goal

Restore test-suite validation without changing production behavior.

## Required UI

None.

## Required Data/API

No runtime API changes.

## Required Automations

None.

## Required Subagents

None. The failing outputs and affected files identify the test-only surfaces
directly.

## TDD Requirements

Use the existing validation commands as regression checks:

- `bun run typecheck`
- `bun test packages/ui/src/components`

Confirm both fail for the expected reasons before applying the minimal
test-only repairs, then rerun targeted and broad validation.

## Implementation Requirements

- Keep changes limited to tests and ticket/worklog metadata.
- Preserve branded-ID contracts in tests by using existing brand helpers or
  conversion helpers.
- Restore any mini DOM globals installed by overlay tests before later test
  files execute.
- Do not change production source or runtime behavior.

## Validation Commands

- `bun test packages/shared/src/agent/backend/__tests__/orchestrator.test.ts packages/shared/src/observability/__tests__/audit-event.test.ts packages/shared/src/observability/__tests__/audit-producer.test.ts packages/shared/src/observability/__tests__/log-level.test.ts packages/shared/src/observability/__tests__/structured-logger.test.ts`
- `bun test packages/ui/src/components`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun test`

## Acceptance Criteria

- [x] Branded-ID and type-only test repairs pass targeted tests.
- [x] UI component suite passes after mini DOM global restoration.
- [x] `bun run typecheck` passes.
- [x] Lint and docs validators pass.
- [x] Full `bun test` passes.
- [x] No production runtime files are changed.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T337-test-suite-type-and-dom-isolation-repair.md`.
