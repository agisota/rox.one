# T160 - Route cache shared across A.2+ probes (avoid double-crawl)

## 1. Task summary

Eliminate the double SPA crawl that occurs when `runtime-axe` and `runtime-states` both run
against the same surface. Each probe independently called `discoverRoutes()`, triggering two
separate Playwright BFS crawls against the live dev server (~2-3s overhead per surface).

## 2. Repo context discovered

- `packages/audit/src/discovery.ts` — `discoverRoutes()` has no caching mechanism.
- `packages/audit/src/probes/runtime-axe.ts` — calls `discoverRoutes(ctx.surface, ctx.surfaceRoot, ctx.devServerUrl, ctx.playwright)`.
- `packages/audit/src/probes/runtime-states.ts` — identical call signature.
- `packages/audit/src/probe.ts` — `ProbeContext` interface had no shared-state field.
- `packages/audit/src/cli.ts` — `contextFor` factory creates the context object per probe-surface pair.

## 3. Files inspected

- All four files above.
- `packages/audit/tests/discovery.test.ts` — existing `discoverRoutes` tests for signature reference.

## 4. Tests added first

Added two tests to `packages/audit/tests/discovery.test.ts`:

1. **`route cache short-circuits second call`** — Creates a temp dir with pages, calls
   `discoverRoutes` with a cache Map, deletes the pages dir, calls again. Second call must
   return identical routes despite the dir being gone (proves cache was used, not re-crawled).

2. **`cache is keyed per surface — different surfaces don't share entries`** — Two surfaces
   in separate temp dirs; one has pages, one does not. Verifies both get separate cache keys
   and return different route arrays.

## 5. Expected failing test output

Both tests failed before implementation because `discoverRoutes` did not accept a `cache`
parameter.

## 6. Implementation changes

**`packages/audit/src/probe.ts`** (+2 lines):

Added `routeCache?: Map<Surface, string[]>` field to `ProbeContext`.

**`packages/audit/src/discovery.ts`** (+15 lines, -6 lines):

- Added `cache?: Map<Surface, string[]>` as fifth parameter to `discoverRoutes`.
- Early return `cache?.get(surface)` if populated.
- Refactored if/else so both paths assign to `let result: string[]`.
- `cache?.set(surface, result)` before returning.

**`packages/audit/src/probes/runtime-axe.ts`** (+1 char on one line):

Passes `ctx.routeCache` as fifth arg to `discoverRoutes`.

**`packages/audit/src/probes/runtime-states.ts`** (+1 char on one line):

Passes `ctx.routeCache` as fifth arg to `discoverRoutes`.

**`packages/audit/src/cli.ts`** (+4 lines):

- `const routeCache = new Map<Surface, string[]>()` created once per run before `registry.run`.
- `routeCache` added to the `contextFor` return object.

Commits (T160, included in commit 2):
- `c6fa64c` feat(audit): route cache shared across A.2+ probes (avoid double-crawl) [T160]

## 7. Validation commands run

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run tsc --noEmit
```

Manual timing comparison not performed (requires live Vite dev servers); cache correctness
verified by the short-circuit test (pages dir deleted; second call still returns routes).

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)

 74 pass
 0 fail
 159 expect() calls
Ran 74 tests across 16 files. [7.25s]
```

tsc: exit 0, no output.

## 9. Build output summary

No build artefacts.

## 10. Remaining risks

- **Concurrency hazard:** `registry.run` may execute probe-surface pairs in parallel
  (bounded by `workerCap`). When `runtime-axe` and `runtime-states` run concurrently on
  the same surface, both could reach the `cache.get` miss simultaneously, launch two crawls,
  and then both write to `cache.set`. The final cached value will be one of the two results
  (both correct), and both probes will complete without error. No data loss; at worst the
  crawl happens twice in that narrow race window. A mutex/Promise-based lock would eliminate
  this but adds complexity beyond the A.4 scope. Acceptable for now.
- **Cache lives for the process lifetime:** The cache Map is created fresh per CLI invocation,
  so there is no stale-cache risk across separate audit runs.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| `ProbeContext.routeCache` added | ✅ | `probe.ts` interface |
| `discoverRoutes` accepts and checks cache | ✅ | `discovery.ts` early return |
| `discoverRoutes` populates cache | ✅ | `discovery.ts` `cache?.set` |
| `runtime-axe` passes `ctx.routeCache` | ✅ | `runtime-axe.ts` one-line change |
| `runtime-states` passes `ctx.routeCache` | ✅ | `runtime-states.ts` one-line change |
| `cli.ts` instantiates one Map per run | ✅ | `cli.ts` `const routeCache` |
| `cli.ts` passes cache via `contextFor` | ✅ | `contextFor` return object |
| Cache short-circuit test passes | ✅ | `discovery.test.ts` |
| Per-surface keying test passes | ✅ | `discovery.test.ts` |
| 74 tests, 0 failures | ✅ | `bun test` output |
| tsc exit 0 | ✅ | `bun run tsc --noEmit` |
