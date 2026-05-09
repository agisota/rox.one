# T160 - Route cache shared across A.2+ probes (avoid double-crawl)

Status: complete

## Context

Architect follow-up for A.4. `runtime-axe.ts` and `runtime-states.ts` each call
`discoverRoutes(...)` independently. With both probes selected, the SPA is crawled twice —
wasted dev-server load (~2-3s per surface) and unnecessary Playwright browser cycles.

## Summary

Add a `routeCache?: Map<Surface, string[]>` field to `ProbeContext`. Thread it through
`discoverRoutes()` as an optional fifth parameter. When the cache already contains an entry
for the surface, return it immediately without re-crawling. `cli.ts` instantiates one Map
per run and passes it via every `contextFor()` call so all probes share the same cache.

## Acceptance Criteria

- [x] `ProbeContext.routeCache?: Map<Surface, string[]>` added to `packages/audit/src/probe.ts`.
- [x] `discoverRoutes(surface, surfaceRoot, liveUrl?, playwright?, cache?)` updated — checks `cache.get(surface)` before crawling and calls `cache.set(surface, result)` after.
- [x] `runtime-axe.ts` passes `ctx.routeCache` to `discoverRoutes`.
- [x] `runtime-states.ts` passes `ctx.routeCache` to `discoverRoutes`.
- [x] `cli.ts` creates `const routeCache = new Map<Surface, string[]>()` per run and includes it in `contextFor`.
- [x] Two new tests in `tests/discovery.test.ts`: cache short-circuits second call; cache is keyed per surface.
- [x] `cd packages/audit && bun test` passes (74 tests, 0 failures).
- [x] `cd packages/audit && bun run tsc --noEmit` exits 0.
- [x] Worklog `docs/worklog/T160-route-cache-shared-probes.md` complete.
- [x] Commit created.

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run tsc --noEmit
~/.bun/bin/bun run packages/audit/src/cli.ts run webui --probes=runtime-axe,runtime-states --no-tickets --out=/tmp/a4cache-verify
```

## Worklog

`docs/worklog/T160-route-cache-shared-probes.md`
