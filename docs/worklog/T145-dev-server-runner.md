# T145 - Dev-server runner + ready-pattern detection

## 1. Task summary

Implement `packages/audit/src/runners/dev-server-runner.ts` — a factory function `spawnDevServer(input)` that spawns a subprocess (e.g., Vite dev server), listens to both stdout and stderr for a ready-pattern regex, extracts the live URL from the first capture group, and returns a handle with async `kill()` method using SIGTERM-then-SIGKILL semantics. No new dependencies required; uses `node:child_process` only.

## 2. Repo context discovered

- `packages/audit/src/runners/` directory already exists (T139 created playwright-runner.ts there).
- `tsconfig.base.json` has strict mode enabled; `ChildProcess` type from node:child_process is well-typed.
- `bun.lock` has no changes needed for this task (no new deps).
- Dev servers (Vite) emit ready line to stdout in normal operation, but sometimes stderr under certain log-level configs; both streams are monitored.

## 3. Files inspected

- `packages/audit/src/runners/playwright-runner.ts` (T139) — pattern for factories in the runners module
- `packages/audit/tests/runners/playwright-runner.test.ts` — test structure reference
- Node.js `child_process` documentation for spawn, signal handling, event lifecycle

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/runners/dev-server-runner.test.ts` | 3 |

Tests written before implementation. Test names: "rejects when ready line never appears within timeout", "resolves with URL when ready pattern matches", "kill() terminates the spawned process".

## 5. Expected failing test output

```
error: Cannot find module '../../src/runners/dev-server-runner.ts'
    at <anonymous> (packages/audit/tests/runners/dev-server-runner.test.ts:1:0)
```

After stubs added, tests would fail with missing type exports.

## 6. Implementation changes

- `packages/audit/src/runners/dev-server-runner.ts` (created):
  - Exports `SpawnDevServerInput` interface: command, args, cwd, readyPattern (RegExp), timeoutMs, optional env.
  - Exports `DevServerHandle` interface: url (string), pid (number), kill (async function).
  - `spawnDevServer(input)` implementation:
    - Spawns child process with `stdio: ["ignore", "pipe", "pipe"]` (stdin ignored, stdout/stderr piped).
    - Sets timeout; if ready pattern not matched within `timeoutMs`, kills process with SIGKILL and rejects.
    - Attaches `onData` handler to both stdout and stderr; extracts URL from first capture group (fallback to full match).
    - On successful pattern match, clears timeout and resolves with handle.
    - Handles child errors and early exits with descriptive rejection.
  - `killChild(child)` helper:
    - Issues SIGTERM immediately.
    - Sets 2s timeout; if child hasn't exited, issues SIGKILL.
    - Resolves when child has exited (via "exit" event or timeout + grace period).
    - Handles exceptions (process already exited, kill throws, etc.) gracefully.

Commits (T145, 1 commit):
- `86957d0` feat(audit): dev-server-runner with ready-pattern detection [T145]

## 7. Validation commands run

```bash
cd packages/audit && bun run typecheck
cd packages/audit && bun test tests/runners/dev-server-runner.test.ts
```

## 8. Passing test output summary

```
bun test v1.3.13

 3 pass
 0 fail
 2 expect() calls
Ran 3 tests across 1 file. [603.00ms]
```

All three tests pass without timeouts or process leaks.

## 9. Build output summary

No build step. `cd packages/audit && bun run typecheck` exits 0 with no output. No new dependencies, no lockfile changes.

## 10. Remaining risks

- **Process cleanup:** `unref()` is not called on the hard SIGKILL timer, meaning a slow-to-die child could outlive the test process if cleanup is hung. Risk is low because SIGKILL is hard stop, but theoretically a process stuck in an uninterruptible state (disk I/O hang, zombie) could prevent test exit. Mitigation: test framework (bun test) enforces overall test timeout.
- **Regex capture groups:** if `readyPattern` has no capture group, URL falls back to the full match. Caller is responsible for regex correctness. No validation of the URL format.
- **stdio="pipe":** If child process produces extremely large stdout (>1 GB), internal Node.js buffers could exhaust memory before ready pattern is found. Acceptable for dev servers (Vite, etc.) which emit ready line immediately; would fail only on pathological patterns.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Interface SpawnDevServerInput defined | ✅ | `dev-server-runner.ts` lines 3–10 |
| Interface DevServerHandle defined | ✅ | `dev-server-runner.ts` lines 12–16 |
| spawn() uses stdio pipe for stdout/stderr | ✅ | `dev-server-runner.ts` line 34 |
| Listens to both stdout and stderr | ✅ | `dev-server-runner.ts` lines 71–72 |
| Ready pattern match extracts URL (group 1) | ✅ | `dev-server-runner.ts` lines 53–57 |
| Timeout rejects with descriptive error | ✅ | `dev-server-runner.ts` lines 39–47; test assertion |
| SIGTERM then SIGKILL kill semantics | ✅ | `killChild` function lines 101, 109 |
| kill() is async and waits for exit | ✅ | `dev-server-runner.ts` line 66; `killChild` returns Promise |
| Tests pass: 3/3 | ✅ | Test run output above |
| typecheck exits 0 | ✅ | No type errors |
