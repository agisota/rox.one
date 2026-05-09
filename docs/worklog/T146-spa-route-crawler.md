# T146 - SPA route crawler + fixture

## 1. Task summary

Implement `packages/audit/src/route-crawler.ts` with `crawlRoutes(input)` async function that performs bounded BFS traversal from a base URL, extracting anchor hrefs via Playwright, filtering to same-origin, and returning a sorted list of unique paths. Create `packages/audit/tests/fixtures/spa-fixture/` — a minimal Vite + React Router v6 SPA with 3 routes (/, /about, /contact) linked via `<Link to>` components for integration testing.

## 2. Repo context discovered

- `packages/audit/tests/fixtures/` already exists (static-bundle fixture present).
- Playwright runner already available via T139 (createPlaywrightRunner).
- `spa-fixture/` is NOT a workspace member (no entry in workspace glob); has its own bun.lock.
- Vite config defaults to port 5173, 5174, 5175 per surface (no collision).
- React Router v6 uses JSX `<Link to>` not static `<a>` elements in modern style, but fixture also includes fallback `<a href>` anchors for crawler compatibility.

## 3. Files inspected

- `packages/audit/tests/fixtures/` directory structure
- `packages/audit/src/runners/playwright-runner.ts` — PlaywrightRunner interface
- Playwright docs on `page.goto()`, `page.evaluate()`, `querySelectorAll`

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/route-crawler.test.ts` | 1 |

Test written before implementation. Test name: "discovers /, /about, /contact from SPA fixture".

## 5. Expected failing test output

```
error: Cannot find module '../../src/route-crawler.ts'
    at <anonymous> (packages/audit/tests/route-crawler.test.ts:1:0)
```

After stubs, test would fail with missing function.

## 6. Implementation changes

- `packages/audit/src/route-crawler.ts` (created):
  - Exports `CrawlInput` interface: baseUrl, playwright (PlaywrightRunner), maxDepth, maxRoutes.
  - Exports `crawlRoutes(input)` async function:
    - BFS queue initialized with root URL at depth 0.
    - Loop: dequeue, extract pathname, skip if already seen or depth >= maxDepth.
    - For each queued URL, open page via `playwright.newPage()`, navigate with `waitUntil: "networkidle"`, timeout 15s.
    - Use `page.evaluate(() => document.querySelectorAll("a[href]"))` to extract hrefs in single round-trip (faster than per-anchor evaluateHandle).
    - For each href, resolve relative URL with `new URL(href, currentUrl)`, filter by origin, enqueue if not seen.
    - Silently skip navigation timeouts, malformed hrefs, evaluate errors — partial crawl preferred over total failure.
    - Return sorted array of seen paths.
    - Respects maxRoutes cap (loop exits when seen.size >= maxRoutes).
    - Respects maxDepth (no queuing when depth >= maxDepth).

- `packages/audit/tests/fixtures/spa-fixture/` (created):
  - `package.json`: dependencies on `vite@6.1.0`, `react-router-dom@6.20.0`, `react@18.2.0`, `react-dom@18.2.0`.
  - `vite.config.ts`: configures React plugin, sets explicit port 5174, outputs localhost URL.
  - `index.html`: minimal HTML entry, loads `src/main.tsx`.
  - `src/main.tsx`: React Router setup with 3 routes (/, /about, /contact), each route has `<Link>` to others and fallback `<a href>` anchors.
  - `bun.lock`: generated via `bun install` in fixture dir; NOT committed to monorepo bun.lock.
  - `tsconfig.json`: basic TS config for fixture.

- `packages/audit/tests/route-crawler.test.ts` (created):
  - `beforeAll` (60s timeout): spawns fixture dev server using T145's spawnDevServer, creates Playwright runner via T139's createPlaywrightRunner.
  - `afterAll`: kills server and closes Playwright.
  - Single test: calls `crawlRoutes({ baseUrl, playwright, maxDepth: 2, maxRoutes: 20 })`, asserts routes contain `/`, `/about`, `/contact`.

Commits (T146, 1 commit):
- `40cbaae` feat(audit): SPA route crawler with bounded BFS [T146]

## 7. Validation commands run

```bash
cd packages/audit/tests/fixtures/spa-fixture && bun install
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/route-crawler.test.ts --timeout 60000
```

## 8. Passing test output summary

```
bun test v1.3.13

 1 pass
 0 fail
 3 expect() calls
Ran 1 test across 1 file. [2.33s]
```

Single test discovers all 3 routes in ~2.3s (Vite boot happens once in beforeAll). Test uses `expect(routes).toContain(...)` for each route assertion.

## 9. Build output summary

No build step for route-crawler.ts itself. Fixture installed via `bun install` in spa-fixture dir (separate from monorepo). `cd packages/audit && bun run typecheck` exits 0. No new monorepo deps (Playwright and react-router-dom already vendored in audit package from prior tasks).

## 10. Remaining risks

- **Crawl semantics:** Crawler only follows `<a href>` anchors. Does not handle:
  - `<Link to>` components without underlying `<a>` (if component doesn't render as anchor).
  - `history.pushState` or client-side navigation triggered by click handlers.
  - Meta redirects or server-side redirects from catch-all routes.
  - Acceptable for now (typical React Router apps render `<Link>` as `<a>`); A.5 may add JS-driven navigation if needed.
- **Vite boot time:** Fixture cold-start (npm install + Vite dev server launch) takes ~30-45s. Subsequent test runs reuse the same fixture, so time is amortized. If fixture is rebuilt (e.g., `rm -rf node_modules`), test run doubles.
- **Port hardcoding:** Vite config uses port 5174. If another process occupies that port, test fails. Risk is low in CI (isolated environments) but possible locally. No fallback logic.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Interface CrawlInput defined | ✅ | `route-crawler.ts` lines 3–8 |
| crawlRoutes async function implemented | ✅ | `route-crawler.ts` lines 20–61 |
| BFS bounded by maxDepth | ✅ | Line 32: `if (depth >= input.maxDepth) continue;` |
| BFS bounded by maxRoutes | ✅ | Line 25: `while (...&& seen.size < input.maxRoutes)` |
| Same-origin filter via URL.origin | ✅ | Line 44: `if (next.origin !== baseOrigin) continue;` |
| Anchors extracted via page.evaluate | ✅ | Lines 37–40: single round-trip query |
| Errors silently skipped | ✅ | Lines 49, 54: catch blocks swallow errors |
| SPA fixture at correct path | ✅ | `packages/audit/tests/fixtures/spa-fixture/` exists |
| Fixture has Vite + React Router | ✅ | package.json, vite.config.ts, src/main.tsx |
| Fixture runs with `bun run dev` | ✅ | vite.config.ts port 5174 + ready line logged |
| Fixture has 3 routes linked via `<Link>` | ✅ | src/main.tsx routes with `<Link to="...">` |
| Fixture has own bun.lock | ✅ | `packages/audit/tests/fixtures/spa-fixture/bun.lock` |
| Test discovers /, /about, /contact | ✅ | Test run output shows 3 expect() calls passing |
| Test timeout 60s sufficient | ✅ | Test completed in 2.33s |
| typecheck exits 0 | ✅ | No type errors |
