# T337 - Test suite type and DOM isolation repair

Status: DONE
Phase: R.6 support
Ticket: docs/tickets/T337-test-suite-type-and-dom-isolation-repair.md

## 1. Task summary

Repair post-merge test-suite validation failures in test-only code: branded-ID
type assertions, type-only imports, and mini DOM global leakage from the PDF
overlay component test.

## 2. Repo context discovered

The branded provider and observability ID modules intentionally use nominal
types. Tests that compare those values directly to raw strings now violate the
contract even when runtime behavior is correct.

`pdf-preview-overlay.test.tsx` installs a mini DOM by assigning `document`,
`window`, DOM constructors, RAF helpers, and `IS_REACT_ACT_ENVIRONMENT` onto
`globalThis`. Its previous cleanup only emptied `documentRef.body.childNodes`,
so later component tests saw a partial DOM with no `classList`,
`customElements`, or `window.getSelection`.

## 3. Files inspected

- `packages/shared/src/agent/backend/__tests__/orchestrator.test.ts`
- `packages/shared/src/agent/backend/provider-id.ts`
- `packages/shared/src/observability/__tests__/audit-event.test.ts`
- `packages/shared/src/observability/__tests__/audit-producer.test.ts`
- `packages/shared/src/observability/__tests__/log-level.test.ts`
- `packages/shared/src/observability/__tests__/structured-logger.test.ts`
- `packages/ui/src/components/overlay/__tests__/pdf-preview-overlay.test.tsx`
- `packages/ui/src/components/markdown/__tests__/official-markdown-math-foundation.test.ts`
- `packages/ui/src/components/annotations/__tests__/selection-restore.test.ts`

## 4. Tests added first

No new tests were needed. The existing validation checks reproduced the
regressions:

- `bun run typecheck`
- `bun test packages/ui/src/components`

## 5. Expected failing test output

`bun run typecheck` failed in test files that compared raw strings to branded
`ProviderId` / `CorrelationId` values, cast audit events directly to
`Record<string, unknown>`, and imported `LogLevel` as a runtime value.

`bun test packages/ui/src/components` failed after
`pdf-preview-overlay.test.tsx` ran:

- 5 official markdown + mathematics foundation tests threw
  `TypeError: undefined is not an object (evaluating 'dom.classList.add')`.
- `diff-normalize.test.ts` hit `ReferenceError: customElements is not defined`.
- `selection-restore.test.ts` hit `window.getSelection is not a function`.

## 6. Implementation changes

- Added a provider ID expectation helper that converts branded IDs with
  `providerIdToString` before comparing to canonical literals.
- Updated observability tests to compare against `asCorrelationId(...)` values.
- Cast audit-event guard fixtures through `unknown` before treating them as a
  mutable record.
- Converted `LogLevel` to a type-only import.
- Added mini DOM global snapshot/restore helpers to the PDF overlay test.
- Unmounted React roots created by the PDF overlay test before restoring the
  previous globals.

## 7. Validation commands run

- `bun test packages/shared/src/agent/backend/__tests__/orchestrator.test.ts packages/shared/src/observability/__tests__/audit-event.test.ts packages/shared/src/observability/__tests__/audit-producer.test.ts packages/shared/src/observability/__tests__/log-level.test.ts packages/shared/src/observability/__tests__/structured-logger.test.ts`
- `bun run typecheck`
- `bun test packages/ui/src/components`
- `bun test apps/electron/src/main/__tests__/browser-pane-manager.test.ts apps/electron/src/main/__tests__/browser-cdp.test.ts`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun test`

## 8. Passing test output summary

- Targeted shared tests: `82 pass, 0 fail, 222 expect() calls`.
- Typecheck: exit 0.
- UI component suite: `254 pass, 0 fail, 575 expect() calls`.
- BrowserCDP order repro: `84 pass, 0 fail, 195 expect() calls`.
- Lint: exit 0 with the existing React hook dependency warning in
  `freeform-input.history.rtl.test.tsx`.
- Docs validators: `validate:docs`, `validate:roadmap`, and
  `validate:rebrand` all exited 0.
- Whitespace check: `git diff --check` exited 0.
- Full suite: `5527 pass, 13 skip, 0 fail, 1 snapshots, 20511 expect() calls`.

## 9. Build output summary

No build needed for this test-only repair unless later validation requires it.

## 10. Remaining risks

The fix is limited to tests and documentation. Build was not run because no
production source or runtime behavior changed.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Branded-ID and type-only test repairs pass targeted tests | Green | `82 pass, 0 fail` targeted shared test run |
| UI component suite passes after mini DOM global restoration | Green | `254 pass, 0 fail` component suite |
| `bun run typecheck` passes | Green | exit 0 after branded/type-only repairs |
| Lint and docs validators pass | Green | `bun run lint`, `validate:docs`, `validate:roadmap`, `validate:rebrand`, `git diff --check` exited 0 |
| Full `bun test` passes | Green | `5527 pass, 13 skip, 0 fail` |
| No production runtime files are changed | Green | Diff is limited to tests plus ticket/worklog docs |
| Worklog complete | Green | 11-section worklog updated with validation evidence |
| Commit created | Green | Atomic commit after validation |
