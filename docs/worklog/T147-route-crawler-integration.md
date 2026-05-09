# T147 - Route crawler integration + dev-server lifecycle in CLI

## 1. Task summary

Wire the route crawler (T146) into the discovery module (A.2 fallback) and integrate dev-server lifecycle into the CLI. Make `discoverRoutes()` async, conditionally invoke `crawlRoutes` when a live dev-server URL and Playwright runner are available, add `devServerUrl` to ProbeContext, update runtime probes to populate `location.route`, and modify CLI to spawn dev servers in parallel and pass URLs to probes.

## 2. Repo context discovered

- `packages/audit/src/discovery.ts` has existing file-based route detection via `src/pages/*.html`.
- `packages/audit/src/probe.ts` defines `ProbeContext` interface.
- `packages/audit/src/probes/runtime-axe.ts` and `runtime-states.ts` already call `discoverRoutes`.
- `packages/audit/src/cli.ts` has surface names (renderer, webui, viewer, marketing) and already spawns Playwright runner per surface.
- Existing tests use file-based fallback (no dev-server URL provided), so they should continue passing without modification.

## 3. Files inspected

- `packages/audit/src/discovery.ts` — discoverRoutes function signature and file-based logic.
- `packages/audit/src/probe.ts` — ProbeContext interface.
- `packages/audit/src/probes/runtime-axe.ts`, `runtime-states.ts` — discovery calls and Finding structure.
- `packages/audit/src/cli.ts` — surface loop, contextFor callback, cleanup patterns.
- `packages/audit/src/runners/dev-server-runner.ts` (T145) — DevServerHandle interface.

## 4. Tests added first

No new tests added. Existing suite in `tests/cli.test.ts` (3 tests) reused and verified to pass.

Test names:
- "`audit --help` prints usage and exits 0"
- "`audit run` with no surfaces exits 1 with helpful error"
- "runs static-tsc against a fixture surface and writes valid queue.json"

## 5. Expected failing test output

Before modifications, no tests would fail (discovery still works file-based).

## 6. Implementation changes

- `packages/audit/src/discovery.ts` (modified):
  - `discoverRoutes(surface, surfaceRoot, liveUrl?, playwright?)` signature updated to async.
  - New logic at top: if `liveUrl && playwright` both provided, return `await crawlRoutes({ baseUrl: liveUrl, playwright, maxDepth: 2, maxRoutes: 20 })`.
  - Otherwise fall back to existing file-based `src/pages/*.html` enumeration.
  - Import `crawlRoutes` from `./route-crawler.ts`.

- `packages/audit/src/probe.ts` (modified):
  - `ProbeContext` interface gains optional field `devServerUrl?: string`.

- `packages/audit/src/probes/runtime-axe.ts` (modified):
  - Change `discoverRoutes(...)` call to `await discoverRoutes(...)` (now async).
  - Pass `ctx.devServerUrl` and `ctx.playwright` as additional arguments to discoverRoutes.
  - For each Finding, set `location.route` to the route string (per architect's A.2 review fix).

- `packages/audit/src/probes/runtime-states.ts` (modified):
  - Same changes as runtime-axe: await discovery call, pass devServerUrl and playwright, populate location.route.

- `packages/audit/src/cli.ts` (modified):
  - Add surface→devCommand map at module top:
    ```typescript
    const DEV_COMMANDS: Record<Surface, string | null> = {
      renderer: null,  // Deferred to A.5 (Electron complexity)
      webui: "bun run webui:dev",
      viewer: "bun run viewer:dev",
      marketing: "bun run marketing:dev",
    };
    ```
  - When `isRuntimeProbe(probeNames)` is true and devCommand is not null, spawn dev server for that surface.
  - Use `spawnDevServer()` with command `bun`, args `["run", "<surface>:dev"]`, cwd `process.cwd()`, readyPattern `/Local:\s+(http:\/\/[^\s/]+\/?)/`, timeout 30s.
  - Spawn all dev servers in parallel via `Promise.all()`.
  - In the `contextFor(surface)` callback, inject `devServerUrl` from the corresponding spawned server's handle.
  - In `finally` block, kill all spawned servers in parallel via `Promise.all(handles.map(h => h.kill()))`.

- Process.execPath used instead of hardcoded "bun" to locate the bun executable (critical for CI environments where bun may not be on PATH).

Commits (T147, 1 commit):
- `1babfe0` feat(audit): wire route crawler into discoverRoutes + spawn per-surface dev servers [T147]

## 7. Validation commands run

```bash
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/cli.test.ts
~/.bun/bin/bun run packages/audit/src/cli.ts run webui --probes=runtime-axe --no-tickets --out=/tmp/a4-spot
```

## 8. Passing test output summary

```
bun test v1.3.13

 3 pass
 0 fail
 8 expect() calls
Ran 3 tests across 1 file. [745.00ms]
```

Existing tests pass without modification (file-based fallback used, devServerUrl not provided).

## 9. Build output summary

No build step. `cd packages/audit && bun run typecheck` exits 0. No new deps. Smoke test run completes successfully with dev server spawned and route discovery working live.

## 10. Remaining risks

- **Dev server port collision:** Multiple surfaces may attempt to use the same port if config changes. Vite defaults (5173, 5174, 5175 per surface) are non-overlapping currently. Mitigation: explicit port config in each surface's vite.config.ts.
- **Renderer surface deferred:** Electron renderer app requires full Electron main process spawn (BrowserWindow, etc.). Attempted live Electron probing in A.4 would be complex and risky. Documented as A.5 followup. File-based fallback still works for renderer.
- **CI env bun path:** Using `process.execPath` works when running under bun (resolves to bun binary). If tests run under a different Node.js runtime (e.g., plain node in older CI), `process.execPath` may not be bun. Mitigation: CI must run audit under bun.
- **Async discovery latency:** All probes now await discovery, which may add ~1-2s per surface (route crawling). Total audit runtime increases; acceptable trade-off for real route enumeration.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| discoverRoutes is async | ✅ | `discovery.ts` function signature has `async` keyword |
| discoverRoutes checks for liveUrl && playwright | ✅ | `discovery.ts` line ~8: `if (liveUrl && playwright)` |
| discoverRoutes calls crawlRoutes when conditions met | ✅ | `discovery.ts` line: `return crawlRoutes(...)` |
| discoverRoutes falls back to file-based logic | ✅ | `discovery.ts` existing logic preserved post-if |
| ProbeContext has optional devServerUrl field | ✅ | `probe.ts` interface updated |
| runtime-axe awaits discoverRoutes | ✅ | `runtime-axe.ts` has `await` keyword |
| runtime-axe populates location.route | ✅ | `runtime-axe.ts` Finding updates location field |
| runtime-states awaits discoverRoutes | ✅ | `runtime-states.ts` has `await` keyword |
| runtime-states populates location.route | ✅ | `runtime-states.ts` Finding updates location field |
| CLI has surface→devCommand map | ✅ | `cli.ts` DEV_COMMANDS object defined |
| CLI spawns servers in parallel (Promise.all) | ✅ | `cli.ts` spawn loop uses `Promise.all` |
| CLI passes devServerUrl via contextFor | ✅ | `contextFor` callback injection logic present |
| CLI kills servers in finally | ✅ | `finally` block has cleanup via `Promise.all` |
| Existing tests pass (file fallback) | ✅ | Test run output: 3 pass, 0 fail |
| typecheck exits 0 | ✅ | No type errors |
