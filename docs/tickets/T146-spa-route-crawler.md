# T146 - SPA route crawler + fixture

Status: complete

## Context

Phase A.4 of the audit harness. Implement bounded BFS crawling over an SPA's internal links so the audit harness can enumerate all routes reachable via `<a href>` anchors. Includes a minimal React Router SPA fixture for testing.

## Summary

Implement `packages/audit/src/route-crawler.ts` with `crawlRoutes()` function that accepts a base URL, Playwright runner, max depth, and max route count, then performs BFS traversal following same-origin anchor references with graceful error handling. Create `packages/audit/tests/fixtures/spa-fixture/` with Vite + React Router v6 and 3 routes (/, /about, /contact) linked via `<Link to>` components. Fixture has its own bun.lock and is not a workspace member.

## Acceptance Criteria

- [x] `packages/audit/src/route-crawler.ts` exports `CrawlInput` interface with baseUrl, playwright, maxDepth, maxRoutes.
- [x] Exports `crawlRoutes(input)` async function returning sorted array of pathname strings (e.g., `/`, `/about`).
- [x] BFS bounded by maxDepth hops from root and maxRoutes total unique paths.
- [x] Crawler extracts anchors via `page.evaluate()` with `document.querySelectorAll("a[href]")` in single round-trip.
- [x] Same-origin filter via `URL.origin` comparison; cross-origin links skipped.
- [x] Navigation timeouts (15s per page) and malformed hrefs silently skipped — partial crawl > no crawl.
- [x] `packages/audit/tests/fixtures/spa-fixture/` has package.json (vite, react-router-dom), vite.config.ts (port 5174 by default), index.html, src/main.tsx with routes /, /about, /contact linked via `<Link to>`.
- [x] Fixture runs with `bun run dev` and prints Vite ready line to stdout.
- [x] Fixture installed (`bun install`) with its own bun.lock; not in workspace.
- [x] `packages/audit/tests/route-crawler.test.ts` — 1 test passes (discovers /, /about, /contact from live SPA); beforeAll spawns fixture server and creates Playwright runner; timeout 60s.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T146-spa-route-crawler.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/route-crawler.test.ts`, `tests/fixtures/spa-fixture/`.

```
route-crawler.test.ts:
  - discovers /, /about, /contact from SPA fixture
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/route-crawler.ts` | Create |
| `packages/audit/tests/route-crawler.test.ts` | Create |
| `packages/audit/tests/fixtures/spa-fixture/` | Create (vite + react-router app with bun.lock) |

## Validation Commands

```bash
cd packages/audit/tests/fixtures/spa-fixture && bun install
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/route-crawler.test.ts --timeout 60000
```

## Worklog

`docs/worklog/T146-spa-route-crawler.md`
