# T180 - axe-core Test Helper

## 1. Task summary

Create a reusable axe-core wrapper at `apps/electron/src/test-utils/a11y.ts` that exposes `expectNoA11yViolations()`, `runAxe()`, and `AxeViolationsError`. The helper enforces WCAG 2.x rule sets matching `packages/audit`'s runtime-axe probe. bun:test has no DOM; the helper's own self-test is deferred to Pillar 2's Vitest+happy-dom configuration (T186).

## 2. Repo context discovered

- `packages/audit/` contains an existing runtime axe probe using the same WCAG rule set tags: `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`. The default rule set in the new helper mirrors that probe.
- `node_modules/axe-core/package.json` confirmed version 4.10.3 installed.
- bun:test's test runner does not inject a DOM (`typeof document === 'undefined'`). Tests requiring DOM must run under Vitest with a jsdom/happy-dom environment (planned for T186 in Pillar 2).
- `apps/electron/src/test-utils/` directory did not exist prior to this task; created as part of T180.
- No XSS hook warnings were present in the repo; avoided them proactively by using `DOMParser` + node-by-node `appendChild` rather than `innerHTML` assignment.

## 3. Files inspected

- `packages/audit/` — runtime axe probe for rule set reference
- `node_modules/axe-core/package.json` — version confirmation
- `apps/electron/src/renderer/components/app-shell/input/__tests__/` — existing test patterns
- `apps/electron/package.json` — bun:test configuration
- `package.json` — workspace scripts

## 4. Tests added first

The helper itself cannot be unit-tested under bun:test (no DOM). The TDD contract is:

1. Self-test deferred to T186 (Vitest+happy-dom).
2. Per-component a11y tests in T181-T185 exercise `expectNoA11yViolations` indirectly.
3. The clear setup error (`no DOM available`) acts as a fail-fast contract test at the boundary.

The fail-fast guard was written before any other logic, making the boundary behavior the first testable unit of this module.

## 5. Expected failing test output

bun:test cannot exercise the helper directly. The expected behavior when invoked without a DOM:

```text
Error: expectNoA11yViolations: no DOM available. Run this test via the Vitest
config introduced in T186 (uses happy-dom), or wrap an Element rendered by
@testing-library/react.
```

This error is intentional and documents the constraint rather than silently failing.

## 6. Implementation changes

**New file: `apps/electron/src/test-utils/a11y.ts`** (154 lines)

- `AxeViolationsError extends Error` — holds `violations: Result[]`; formats a human-readable summary with rule ID, impact level, target selector, and help URL per violation.
- `mountFragment(html: string)` — internal helper; parses HTML via `DOMParser`, moves children into a host `<div>` via `appendChild` (never sets `innerHTML`), appends host to `document.body`, returns `{ host, cleanup }`.
- `expectNoA11yViolations(target, overrides?)` — main assertion helper; throws `AxeViolationsError` if violations found; cleans up mounted fragment in `finally`.
- `runAxe(target, overrides?)` — returns raw `AxeResults` for test authors who need to inspect specific violations.
- `DEFAULT_RUN_OPTIONS` constant — `wcag2a | wcag2aa | wcag21aa | wcag22aa`, `resultTypes: ['violations']`.
- Re-exports `AxeResults`, `Result`, `RunOptions`, `Spec` types from axe-core for downstream test files.

## 7. Validation commands run

```bash
bun run typecheck:electron
bun run lint:electron
bun run validate:agent-contract
git diff --check
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 126 tickets, 7 required docs

git diff --check
PASS
```

No bun:test run targeted (no DOM-bearing tests exist yet; those land in T186).

## 9. Build output summary

No build step required for a test-utils-only change. The file is not imported by production source; it will only be imported by Vitest test files added in Pillar 2. Typecheck confirmed the file compiles cleanly as part of the `electron` tsconfig surface.

## 10. Remaining risks

- **DOM-bearing self-test deferred.** The helper's own test coverage — including the fragment-parsing path, the AxeViolationsError format, and the WCAG rule set filter — will land with T186 in Pillar 2. Until then, behavior is verified only by the typecheck and the per-component tests in T181-T185.
- **axe-core version drift.** If `axe-core` is upgraded, the `RunOptions` shape may change. The helper imports only stable public types (`AxeResults`, `Result`, `RunOptions`, `Spec`).

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `expectNoA11yViolations` exported | PASS | `apps/electron/src/test-utils/a11y.ts` line 92 |
| `runAxe` exported with raw-results contract | PASS | `apps/electron/src/test-utils/a11y.ts` line 129 |
| `AxeViolationsError` includes `violations` array + readable message | PASS | Lines 36-56; message includes rule ID, impact, target, help URL |
| Default rule set mirrors `packages/audit` WCAG probe | PASS | `DEFAULT_RUN_OPTIONS` lines 28-34 |
| HTML strings parsed without `innerHTML` | PASS | `mountFragment` uses `DOMParser` + `appendChild` loop, lines 67-81 |
| Clear setup error when `document` undefined | PASS | Guard at line 97 (expectNoA11yViolations) and line 136 (runAxe) |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Lint passes | PASS | `bun run lint:electron` |
| Worklog complete | PASS | This document |
| Commit created | PASS | `2f40dc8` — `feat(electron-renderer): axe-core test helper for composer a11y assertions [T180]` |
