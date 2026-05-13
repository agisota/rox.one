# T302 - Browser CDP test isolation

Status: IN_PROGRESS

## Context

The full `bun test` run can execute
`apps/electron/src/main/__tests__/browser-pane-manager.test.ts` before
`apps/electron/src/main/__tests__/browser-cdp.test.ts`. The pane-manager test
registers a module mock for `../browser-cdp`; when that order happens, the
BrowserCDP unit test imports the mocked class instead of the real class and
fails 18 assertions.

## Goal

Make `browser-cdp.test.ts` import the real implementation regardless of
neighboring test module mocks.

## Required UI

None.

## Required Data/API

No runtime API changes.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

First reproduce the order-dependent failure with:

`bun test apps/electron/src/main/__tests__/browser-pane-manager.test.ts apps/electron/src/main/__tests__/browser-cdp.test.ts`

Then apply the smallest test-isolation fix and rerun the same command.

## Implementation Requirements

- Do not change BrowserCDP runtime behavior.
- Keep the pane-manager mock scoped to that test's needs.
- Make the BrowserCDP unit test resistant to file execution order.

## Validation Commands

- `bun test apps/electron/src/main/__tests__/browser-pane-manager.test.ts apps/electron/src/main/__tests__/browser-cdp.test.ts`
- `bun test`
- `bun run typecheck`

## Acceptance Criteria

- [ ] The two-file order-dependent repro passes.
- [ ] Full `bun test` no longer fails on BrowserCDP mock bleed-through.
- [ ] No runtime source files are changed for this fix.

## Worklog

Update `docs/worklog/T302-browser-cdp-test-isolation.md`.
