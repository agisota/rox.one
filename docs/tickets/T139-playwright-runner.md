# T139 - Playwright runner + deps

Status: complete

## Context

Phase A.2 of the audit harness. Add shared Playwright infrastructure for runtime probes. Bootstrap the `createPlaywrightRunner()` factory with deterministic browser lifecycle: headless Chromium, fixed viewport (1440×900), reduced motion, UTC timezone, and frozen clock for reproducible rendering.

## Summary

Add `@axe-core/playwright@4.10.2` and `playwright@1.49.1` dependencies. Implement `packages/audit/src/runners/playwright-runner.ts` with `PlaywrightRunner` interface and `createPlaywrightRunner()` factory. Setup deterministic browser context: headless launch, fixed viewport, `prefers-reduced-motion: reduce`, `locale: en-US`, `timezoneId: UTC`, frozen `Date.now()` via `addInitScript`. Write tests exercising lifecycle and viewport assertions.

## Acceptance Criteria

- [x] `packages/audit/package.json` has `@axe-core/playwright@4.10.2` in dependencies and `playwright@1.49.1` in devDependencies.
- [x] `bun install` succeeds; chromium binary cached to `~/.cache/ms-playwright/`.
- [x] `packages/audit/src/runners/playwright-runner.ts` exports `PlaywrightRunner` interface with `newPage()` and `close()` methods.
- [x] `createPlaywrightRunner()` launches chromium headless, opens new context with fixed viewport 1440×900.
- [x] Context has `reducedMotion: "reduce"`, `locale: "en-US"`, `timezoneId: "UTC"`.
- [x] `addInitScript` freezes `Date.now()` to deterministic value (2026-05-09T00:00:00Z).
- [x] `packages/audit/tests/runners/playwright-runner.test.ts` — 3 tests pass (lifecycle, viewport size, browser close).
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T139-playwright-runner.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/runners/playwright-runner.test.ts`.

```
playwright-runner.test.ts:
  - launches a browser and provides a page context
  - page has fixed viewport 1440×900
  - close() shuts down the browser
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/package.json` | Modify — add deps |
| `packages/audit/src/runners/playwright-runner.ts` | Create |
| `packages/audit/tests/runners/playwright-runner.test.ts` | Create |
| `bun.lock` | Modify — refresh for new deps |

## Validation Commands

```bash
~/.bun/bin/bun install
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/runners/playwright-runner.test.ts
```

## Worklog

`docs/worklog/T139-playwright-runner.md`
