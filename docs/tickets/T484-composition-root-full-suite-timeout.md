# T484 - Composition root full-suite timeout stabilization

Status: DONE

## Context

After PR #218 was merged into main, a fresh full `bun test` run failed 10
tests in `packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`.
The same file passed when run in isolation, but every case spent about 2s in
the bootstrap shutdown path. Under full-suite parallel load, Bun's default
5000ms per-test timeout is too tight for this process- and socket-heavy
composition-root harness.

## Goal

Keep the T246d audit-producer composition-root assertions unchanged while
giving the file an explicit timeout budget for full-suite contention.

## Required UI

None.

## Required Data/API

No data model or API changes.

## Required Automations

None.

## Required Subagents

None required. The failure is isolated by local RED evidence.

## TDD Requirements

- Treat the fresh full `bun test` failure as RED evidence.
- Confirm the target file passes in isolation before changing assertions.
- Do not skip, weaken, or delete any audit-producer composition-root scenario.

## Implementation Requirements

- Apply a test-only stabilization in the composition-root test file.
- Do not modify server runtime bootstrap behavior.
- Do not perform destructive R.11 operations.

## Validation Commands

- `bun test packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`
- `bun test`
- `bun run typecheck`
- `bun run lint`

## Acceptance Criteria

- [x] Full-suite RED evidence is recorded and points only at the
  composition-root timeout cluster.
- [x] The composition-root test timeout budget is explicit and test-only.
- [x] The composition-root test file passes locally without skipped cases.
- [x] Full `bun test` passes locally or any remaining failure is documented as
  unrelated fresh evidence.
- [x] No destructive R.11 action is performed.
