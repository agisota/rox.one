# T302 - Browser CDP test isolation

Status: IN_PROGRESS
Phase: R.6 support
Ticket: docs/tickets/T302-browser-cdp-test-isolation.md

## 1. Task summary

Fix an order-dependent test failure where `browser-cdp.test.ts` can receive
the `BrowserCDP` mock registered by `browser-pane-manager.test.ts`.

## 2. Repo context discovered

`browser-pane-manager.test.ts` uses `mock.module('../browser-cdp', ...)` so the
pane manager can be tested without real CDP calls. Bun's module mock is process
global, so if that test file runs before `browser-cdp.test.ts`, the latter
imports the mocked class.

## 3. Files inspected

- `apps/electron/src/main/__tests__/browser-pane-manager.test.ts`
- `apps/electron/src/main/__tests__/browser-cdp.test.ts`
- `apps/electron/src/main/browser-cdp.ts`

## 4. Tests added first

No new test file was needed. The existing two-file order is the regression
test:

`bun test apps/electron/src/main/__tests__/browser-pane-manager.test.ts apps/electron/src/main/__tests__/browser-cdp.test.ts`

## 5. Expected failing test output

The red run failed with 66 pass / 18 fail. Failures showed `BrowserCDP` returning
the pane-manager mock values, including title `Example` instead of
`Example Page` and no `drag()` method.

## 6. Implementation changes

Changed `browser-cdp.test.ts` to import the implementation with a cache-busting
query string and a typed import cast. This bypasses the sibling test's exact
`mock.module('../browser-cdp')` registration while keeping production imports
unchanged.

## 7. Validation commands run

- `bun test apps/electron/src/main/__tests__/browser-pane-manager.test.ts apps/electron/src/main/__tests__/browser-cdp.test.ts`

## 8. Passing test output summary

Green targeted order run:

`84 pass, 0 fail, 195 expect() calls`

## 9. Build output summary

No build needed for this test-only isolation fix.

## 10. Remaining risks

The fix relies on Bun treating the query-bearing dynamic import as a distinct
specifier. The test keeps a `typeof import('../browser-cdp.ts')` cast so
TypeScript still checks against the real module shape.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Two-file order-dependent repro passes | Green | `84 pass, 0 fail` targeted run |
| Full `bun test` no longer fails on BrowserCDP mock bleed-through | Pending | Full suite rerun still in progress after fix |
| No runtime source files changed | Green | Only `browser-cdp.test.ts` changed |
