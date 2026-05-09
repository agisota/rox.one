# T186 - Vitest Config + RTL Render Harness

Status: DONE

## Context

Pillar 2 of sub-project B adds behavioral RTL coverage for the composer surface. bun:test provides no DOM at runtime; axe-core, `@testing-library/react`, and motion/react integration all require one. A scoped Vitest instance running under happy-dom is the lightest path: it runs in parallel with (and does not disturb) the existing bun:test suite.

T180 deferred the axe-core helper's own self-test to this ticket because `expectNoA11yViolations` requires a DOM. The `TestComposerHarness` also unlocks T187 and T188.

## Goal

Ship a scoped Vitest configuration (`apps/electron/vitest.config.ts`) that picks up only `*.rtl.test.tsx` files under happy-dom, a reusable `TestComposerHarness` render wrapper at `apps/electron/src/test-utils/render.tsx`, a setup file at `apps/electron/src/test-utils/vitest-setup.ts`, and the two new `test:rtl` / `test:rtl:coverage` workspace scripts. Install the five required dev dependencies.

## Required UI

None — test infrastructure only.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

The harness is validated by the T187 + T188 test suites that depend on it. If `bun run test:rtl` returns any failures attributable to missing providers or polyfills, T186 is not done.

## Implementation Requirements

- `apps/electron/vitest.config.ts`:
  - `include: ['src/**/*.rtl.test.tsx']` — scoped to RTL files only; bun:test continues to own all other tests.
  - `environment: 'happy-dom'`
  - `setupFiles: ['./src/test-utils/vitest-setup.ts']`
  - `coverage.provider: 'v8'`, reporters `['text', 'text-summary', 'json']`.
  - Path aliases mirroring `vite.config.ts`: `@` → `src/renderer`, `@config` → shared config.
  - `resolve.dedupe: ['react', 'react-dom']` — prevents a second React copy from `@rox-agent/ui`.
- `apps/electron/src/test-utils/render.tsx`:
  - `TestComposerHarness`: wraps tree with `JotaiProvider`, `I18nextProvider`, `ReducedMotionProvider`, `TooltipProvider`.
  - i18n instance: `parseMissingKeyHandler` returns the key so tests can assert on translation keys directly.
  - `render()` drop-in: accepts optional Jotai store override for atom-driven tests.
  - Re-exports all of `@testing-library/react` and `userEvent` for single-import convenience.
- `apps/electron/src/test-utils/vitest-setup.ts`:
  - matchMedia polyfill (happy-dom does not provide one).
  - Baseline `window.electronAPI` stub covering `getRuntimeEnvironment`, `getAutoCapitalisation`, `getSendMessageKey`, `getSpellCheck`, `getHomeDir`, `getPendingPlanExecution`, `sessionCommand`, `generateThumbnail`, `getFilePath`, `saveLlmConnection`, `getGitBranch`.
  - `ResizeObserver` shim (FreeFormInput observes its container).
- Dev dependencies added (in root `package.json`'s `devDependencies` or the electron package):
  - `vitest@^2`
  - `@testing-library/react@^16`
  - `@testing-library/user-event@^14`
  - `happy-dom@^15`
  - `@vitest/coverage-v8@^2`
- Workspace scripts added to root `package.json`:
  - `"test:rtl": "cd apps/electron && ~/.bun/bin/bunx vitest run --config vitest.config.ts"`
  - `"test:rtl:coverage": "cd apps/electron && ~/.bun/bin/bunx vitest run --config vitest.config.ts --coverage"`

## Validation Commands

- `bun run test:rtl`
- `bun run typecheck:electron`
- `bun run lint:electron`

## Acceptance Criteria

- [x] `apps/electron/vitest.config.ts` exists and targets `*.rtl.test.tsx` only.
- [x] `apps/electron/src/test-utils/render.tsx` exports `TestComposerHarness` and `render`.
- [x] `apps/electron/src/test-utils/vitest-setup.ts` provides matchMedia polyfill + electronAPI baseline + ResizeObserver shim.
- [x] Five dev deps installed: vitest, @testing-library/react, @testing-library/user-event, happy-dom, @vitest/coverage-v8.
- [x] `bun run test:rtl` and `bun run test:rtl:coverage` scripts work from workspace root.
- [x] Typecheck and lint pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T186-vitest-config-rtl-render-harness.md`.
