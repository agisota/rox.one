# T486 - Transform data capture diagnostics preservation

Status: DONE

## Context

Post-merge review of PR #218 found that file-backed stdout/stderr capture can
hide useful diagnostics if reading the capture files fails. The handler returns
an empty string from `readTextIfExists()`, which can collapse non-zero script
errors into the generic `Script exited with non-zero code` fallback.

## Goal

Preserve diagnostics for non-zero transform scripts and surface capture read
failures explicitly instead of hiding them.

## Required UI

None.

## Required Data/API

No data model or API changes.

## Required Automations

None.

## Required Subagents

The finding came from a read-only code-reviewer pass after PR #218 merged.

## TDD Requirements

- Add failing coverage for non-zero scripts preserving stderr.
- Add failing coverage for capture read failure surfacing a diagnostic instead
  of falling back to the generic non-zero message.

## Implementation Requirements

- Keep file-backed stdio capture; do not return to child-process pipe stdio.
- Preserve successful transform behavior.
- Keep path containment behavior unchanged.
- Do not add dependencies.
- Do not perform destructive R.11 operations.

## Validation Commands

- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`

## Acceptance Criteria

- [x] Non-zero transform scripts include stderr diagnostics.
- [x] Capture read failures are visible in the returned error message.
- [x] Transform-data path containment tests still pass.
- [x] Full `bun test` still passes.
- [x] No destructive R.11 action is performed.
