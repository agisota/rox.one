# T159 - Port-occupancy guard before dev-server spawn

Status: complete

## Context

Architect follow-up for A.4. The three user-facing surfaces (webui/viewer/marketing) use
hardcoded Vite ports 5175/5174/5176. The package.json `*:dev` scripts contain
`lsof -ti:<port> | xargs kill -9` — this destructively SIGKILLs any developer's already-running
session when the audit harness spawns its own dev server on the same port.

## Summary

Add a port-occupancy check in `packages/audit/src/cli.ts` before each `spawnDevServer` call.
Use `lsof -ti:<port>` to detect whether the port is already bound. If it is, throw a clear
error immediately so the audit aborts before killing anything.

## Acceptance Criteria

- [x] `isPortInUse(port: number): boolean` implemented via `spawnSync("lsof", ["-ti", ":PORT"])`.
- [x] `SURFACE_PORTS` map defined: webui=5175, viewer=5174, marketing=5176.
- [x] Check runs inside the `crawlable.map(...)` before `spawnDevServer`.
- [x] Error message format: `Port <N> is already in use (<surface>). Stop the running process before running audit, or it will be SIGKILL'd by the surface's dev script.`
- [x] Error propagates through the `Promise.all` and is caught by the outer try/finally — other dev servers already started still get cleaned up.
- [x] Unit test in `tests/cli.test.ts` exercises `lsof` directly against a live-bound port.
- [x] `cd packages/audit && bun test` passes (74 tests, 0 failures).
- [x] `cd packages/audit && bun run tsc --noEmit` exits 0.
- [x] Worklog `docs/worklog/T159-port-occupancy-guard.md` complete.
- [x] Commit created.

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run tsc --noEmit
```

## Worklog

`docs/worklog/T159-port-occupancy-guard.md`
