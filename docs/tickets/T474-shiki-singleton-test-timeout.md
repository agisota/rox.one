# T474 - Shiki singleton test timeout guard

Status: DONE

## Context

The post-T473 validation pass exposed that Bun's default 5 second per-test
timeout can fail the Shiki singleton consumer contracts under full-suite load.
The same assertions pass when run in isolation or with a realistic timeout
budget, which points to expensive Shiki startup/warmup cost rather than a
highlighting correctness failure.

## Goal

Keep the Shiki singleton consumer contracts covered by default `bun test`
without hiding them behind command-line timeout overrides.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- Give the expensive Shiki singleton contract files an explicit Bun test
  timeout.
- Keep the consumer contract tests on a narrow highlighter fixture that loads
  only the languages and themes the tests assert.
- Preserve the existing assertions and reset behavior.

## TDD Requirements

- Capture the default-timeout failure evidence before changing the test harness.
- Confirm the targeted Shiki singleton files pass after the timeout guard.

## Implementation Requirements

- Do not weaken assertions, skip tests, or mark tests as expected failures.
- Keep the change test-only.
- Avoid production dependency changes.

## Validation Commands

- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
- `git diff --check`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun test`

## Acceptance Criteria

- [x] Shiki singleton contract tests keep their assertions.
- [x] Expensive Shiki singleton contract tests have an explicit timeout budget.
- [x] Targeted Shiki singleton tests pass.
- [x] Default `bun test` passes without a command-line timeout override.
