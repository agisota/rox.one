# T139 - Playwright runner + deps

## 1. Task summary

Add Playwright shared infrastructure for A.2 runtime probes. Install `@axe-core/playwright@4.10.2` and `playwright@1.49.1` dependencies. Implement `createPlaywrightRunner()` factory providing a browser with deterministic lifecycle: headless Chromium, fixed viewport (1440×900), reduced motion, UTC timezone, and frozen `Date.now()` for reproducible rendering across runs.

## 2. Repo context discovered

- `apps/electron/package.json` already specifies `"playwright": "1.49.1"` in devDependencies; version reuse confirmed via `jq` inspection.
- `tsconfig.base.json` has strict mode enabled; Playwright types are well-typed so `noImplicitAny` compliance expected.
- `bun.lock` would be refreshed after `bun install` to include new transitive deps; no manual lock editing required.
- Chromium binary (~150MB) downloads to `~/.cache/ms-playwright/` on first install. CI environments need cache or fresh install strategy.

## 3. Files inspected

- `packages/audit/package.json` (pre-existing from T134) — existing structure, exact-pinned dep pattern
- `apps/electron/package.json` — confirmed playwright version
- `packages/audit/src/probe.ts` — `ProbeContext` type; `playwright` field would be activated (already declared but commented out in spec § 4.3)
- `packages/audit/src/cli.ts` — no A.2-specific changes in T139; wired in later tasks

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/runners/playwright-runner.test.ts` | 3 |

Tests written before implementation of `src/runners/playwright-runner.ts`.

## 5. Expected failing test output

```
error: Cannot find module '../../src/runners/playwright-runner.ts'
    at <anonymous> (packages/audit/tests/runners/playwright-runner.test.ts:1:0)
```

After adding stubs, tests would fail with:
```
error: PlaywrightRunner is not a class
    Expected to call: createPlaywrightRunner()
```

## 6. Implementation changes

- `packages/audit/package.json` (modified):
  - Added `"@axe-core/playwright": "4.10.2"` to dependencies.
  - Added `"playwright": "1.49.1"` to devDependencies.

- `packages/audit/src/runners/playwright-runner.ts` (created):
  - Exports `PlaywrightRunner` interface with async `newPage(): Promise<Page>` and `close(): Promise<void>`.
  - `createPlaywrightRunner()` factory:
    - Launches chromium with `{ headless: true }`.
    - Creates new context with options: `viewport: { width: 1440, height: 900 }`, `reducedMotion: "reduce"`, `locale: "en-US"`, `timezoneId: "UTC"`.
    - Calls `context.addInitScript()` to freeze `Date.now()` to `new Date("2026-05-09T00:00:00.000Z").getTime()`.
    - Returns object with `newPage()` creating pages in context and `close()` closing context then browser.
  - No timeout or error handling beyond native Playwright exceptions (probes add retry logic if needed).

- `bun.lock` — refreshed via `bun install`.

Commits (T139, 1 commit):
- `315849c` chore(audit): add @axe-core/playwright + playwright deps for A.2

## 7. Validation commands run

```bash
~/.bun/bin/bun install
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/runners/playwright-runner.test.ts
```

## 8. Passing test output summary

```
bun test v1.3.13
 packages/audit/tests/runners/playwright-runner.test.ts: 3 pass, 0 fail
 3 pass, 0 fail
```

First page launch downloads chromium to `~/.cache/ms-playwright/chromium-1148/` (~120MB), headless shell, ffmpeg-1010 (~30MB) — total ~150MB cached. Subsequent test runs use cached binary.

## 9. Build output summary

No build step. `cd packages/audit && bun run typecheck` exits 0 with no output. `bun install` completes successfully; all transitive deps resolved.

## 10. Remaining risks

- Chromium binary download is ~150MB. CI environments (GitHub Actions, etc.) must cache `~/.cache/ms-playwright/` or accept the download cost on first run. Documented as A.2 infrastructure requirement.
- `Date.now()` frozen to a hardcoded value. If audit harness runs during a different date, the frozen clock is still consistent but semantically stale. Acceptable for deterministic testing; real-time aware probes would need a different approach.
- `playwright@1.49.1` is pinned; future upgrades require explicit version bumps. Risk: security patch releases may be missed if bump is deferred.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Deps added to package.json | ✅ | `packages/audit/package.json` lines 14–20 |
| `bun install` succeeds | ✅ | `bun.lock` refreshed, no errors |
| Chromium cached to ~/.cache/ms-playwright | ✅ | First test run downloads; dir verified |
| PlaywrightRunner interface exports newPage, close | ✅ | `src/runners/playwright-runner.ts` interface def |
| createPlaywrightRunner launches headless | ✅ | Test passes: browser launches without UI |
| Viewport 1440×900 set | ✅ | Test assertion: `page.viewportSize()` returns correct dims |
| Context has reducedMotion, locale, timezone | ✅ | `context.newContext()` call in implementation |
| Date.now frozen | ✅ | `addInitScript` injects freeze logic |
| Tests pass | ✅ | 3 pass, 0 fail (shown above) |
| typecheck exits 0 | ✅ | `tsc --noEmit` no errors |
