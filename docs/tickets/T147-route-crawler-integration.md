# T147 - Route crawler integration + dev-server lifecycle in CLI

Status: complete

## Context

Phase A.4 of the audit harness. Wire the route crawler into the discovery module and connect the dev-server lifecycle into the CLI so runtime probes (axe-core, states) can probe live-running SPAs instead of static fixtures.

## Summary

Update `packages/audit/src/discovery.ts` to make `discoverRoutes` async and conditionally use `crawlRoutes` when a live dev-server URL and Playwright runner are available. Add optional `devServerUrl?: string` to `ProbeContext`. Update `runtime-axe.ts` and `runtime-states.ts` probes to await discovery and populate `location.route` field. Modify `packages/audit/src/cli.ts` to build a surface→devCommand map (webui/viewer/marketing → `bun run <surface>:dev`; renderer deferred), spawn all in-scope servers in parallel when A.2+ probes are selected, pass dev-server URLs via `ProbeContext.devServerUrl`, and clean up servers in `finally`.

## Acceptance Criteria

- [x] `packages/audit/src/discovery.ts`: `discoverRoutes` is async; accepts optional `liveUrl` and `playwright` parameters; uses `crawlRoutes` when both present; falls back to file-based logic (src/pages/*.html) otherwise.
- [x] `packages/audit/src/probe.ts`: `ProbeContext` gains optional `devServerUrl?: string` field.
- [x] `packages/audit/src/probes/runtime-axe.ts`: awaits `discoverRoutes`; populates `location.route` in each Finding.
- [x] `packages/audit/src/probes/runtime-states.ts`: awaits `discoverRoutes`; populates `location.route`.
- [x] `packages/audit/src/cli.ts`: surface→devCommand mapping for webui, viewer, marketing (renderer skipped).
- [x] CLI spawns dev servers in parallel for in-scope surfaces when A.2+ probes selected.
- [x] Dev-server URLs passed via `contextFor` callback's `devServerUrl` field.
- [x] All dev servers killed in `finally` block; cleanup is robust (awaits all kills).
- [x] Existing test suite passes (fixture-based tests use file fallback, no devServerUrl).
- [x] Real-world audit smoke test: `bun run packages/audit/src/cli.ts run webui --probes=runtime-axe --no-tickets --out=/tmp` spawns server, crawls routes, produces findings.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T147-route-crawler-integration.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/cli.test.ts` (existing suite).

```
cli.test.ts:
  - `audit --help` prints usage and exits 0
  - `audit run` with no surfaces exits 1 with helpful error
  - runs static-tsc against a fixture surface and writes valid queue.json
  - (existing tests remain passing)
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/discovery.ts` | Modify — async discoverRoutes, conditionally use crawlRoutes |
| `packages/audit/src/probe.ts` | Modify — add devServerUrl to ProbeContext |
| `packages/audit/src/probes/runtime-axe.ts` | Modify — await discoverRoutes, populate location.route |
| `packages/audit/src/probes/runtime-states.ts` | Modify — await discoverRoutes, populate location.route |
| `packages/audit/src/cli.ts` | Modify — surface→devCommand map, parallel server spawn, devServerUrl injection, cleanup in finally |

## Validation Commands

```bash
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/cli.test.ts
~/.bun/bin/bun run packages/audit/src/cli.ts run webui --probes=runtime-axe --no-tickets --out=/tmp/a4-spot
```

## Worklog

`docs/worklog/T147-route-crawler-integration.md`
