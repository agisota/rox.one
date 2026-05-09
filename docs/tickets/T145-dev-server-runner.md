# T145 - Dev-server runner + ready-pattern detection

Status: complete

## Context

Phase A.4 of the audit harness. Bootstrap dev-server lifecycle management to enable live SPA route discovery. The audit harness must be able to spawn `bun run <surface>:dev`, detect when the server is ready via stdout/stderr pattern matching, and clean up gracefully.

## Summary

Implement `packages/audit/src/runners/dev-server-runner.ts` with `spawnDevServer()` factory that uses `node:child_process` `spawn` to launch a subprocess, listens to both stdout and stderr for a ready-pattern regex, returns a handle with the live URL and a `kill()` method with SIGTERM-then-SIGKILL semantics.

## Acceptance Criteria

- [x] `packages/audit/src/runners/dev-server-runner.ts` exports `SpawnDevServerInput` interface (command, args, cwd, readyPattern regex, timeoutMs, optional env).
- [x] Exports `DevServerHandle` interface with url, pid, and async `kill()` method.
- [x] Exports `spawnDevServer(input)` function that resolves with DevServerHandle when ready pattern matches in stdout or stderr.
- [x] Ready pattern first capture group is used as the URL (fallback to full match if no group).
- [x] Rejects promise on timeout with descriptive error message.
- [x] `kill()` issues SIGTERM, waits 2s, then SIGKILL if process still alive; `kill()` is async and resolves when child has exited.
- [x] `packages/audit/tests/runners/dev-server-runner.test.ts` — 3 tests pass (timeout rejection, ready pattern match, kill termination).
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T145-dev-server-runner.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/runners/dev-server-runner.test.ts`.

```
dev-server-runner.test.ts:
  - rejects when ready line never appears within timeout
  - resolves with URL when ready pattern matches
  - kill() terminates the spawned process
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/runners/dev-server-runner.ts` | Create |
| `packages/audit/tests/runners/dev-server-runner.test.ts` | Create |

## Validation Commands

```bash
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/runners/dev-server-runner.test.ts
```

## Worklog

`docs/worklog/T145-dev-server-runner.md`
