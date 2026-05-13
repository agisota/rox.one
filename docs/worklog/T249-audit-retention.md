# T249 worklog — Audit-log retention policy (maxAge + maxFiles)

## 1. Task summary

Add a configurable retention policy to the M.14 audit trail. T248 (on
`main` via PR #110) shipped the `FileAuditSink` NDJSON writer with
daily + size-based rotation, but every rotated file persisted
forever. T249 introduces `enforceRetention` — a pure-ish helper that
deletes rotated `audit-YYYY-MM-DD[-N].log` files older than a
configurable `maxAgeMs` (default 90 days) and caps the surviving
count at `maxFiles` (default 60). The helper is wired into
`FileAuditSink` via a new optional `retention` constructor parameter
and a `enforceRetentionNow()` method.

## 2. Repo context discovered

- `packages/server-core/src/observability/file-audit-sink.ts`
  (T248, 282 LOC) is the only existing file in the observability dir
  besides the index barrel. The handle exposes `sink`, `flush`,
  `close`, and `activePath`.
- `peekHeadDate` + `rotateTo` are private; the public surface is
  intentionally minimal so retention had to be wired internally via a
  call after each `rotateTo`.
- `packages/shared/src/observability/` (T245) is frozen for this
  ticket — the retention is a server-side concern only.
- The shared `AuditSink` type is `(event: AuditEvent) => void`, so
  retention does not change the producer-facing interface.

## 3. Files inspected

- `packages/server-core/src/observability/file-audit-sink.ts`
- `packages/server-core/src/observability/index.ts`
- `packages/server-core/src/observability/__tests__/file-audit-sink.test.ts`
- `docs/tickets/T248-file-audit-sink.md`
- `docs/worklog/T248-file-audit-sink.md`

## 4. Tests added first

`packages/server-core/src/observability/__tests__/audit-retention.test.ts`
(299 LOC) — 20 cases / 54 expects covering:

| Concern                                              | Test                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Empty directory → empty result                       | `returns empty arrays when the directory is empty`           |
| Age cutoff: file older than `maxAgeMs` is deleted    | `deletes a rotated file older than maxAgeMs`                 |
| Age cutoff boundary: equal-to-cutoff stays           | `keeps a rotated file exactly at the age cutoff`             |
| Count cap: oldest survivors deleted                  | `enforces the count cap by deleting the oldest survivors`    |
| Combined age + count cutoffs                         | `combines age and count cutoffs: age first, then count`      |
| Active `audit.log` never deleted                     | `never deletes the active audit.log even when it is old`     |
| Non-audit files ignored                              | `ignores arbitrary non-audit files in the directory`         |
| Numeric-suffix collision filenames                   | `recognises numeric-suffix collision filenames`              |
| Result ordering = oldest first                       | `returns paths in oldest-first order`                        |
| Pure planner mode when `unlink` absent               | `is a pure planner when fs.unlink is omitted`                |
| Readdir error → empty result                         | `returns empty when readdir throws (directory absent)`       |
| Stat error → skip + continue                         | `skips files whose stat() fails (concurrent unlink race)`    |
| Unlink error tolerance                               | `swallows unlink errors and keeps sweeping the remaining files` |
| `join()` produces absolute paths                     | `uses join() to produce absolute paths under the supplied dir` |
| `maxFiles=0` deletes everything                      | `honours maxFiles=0 by deleting every rotated file`          |
| `maxAgeMs=0` deletes every past-mtime file           | `honours maxAgeMs=0 by deleting every file with mtime in the past` |
| Default constants exported                           | `exports default constants (90 days, 60 files)`              |
| Regex recogniser surfaces correct shapes             | `isRotatedAuditFile recognises the expected shapes only`     |
| Injected clock honoured (no implicit `Date.now`)     | `uses the injected clock and does not call Date.now() implicitly` |
| Equal-mtime tie-break ordering stable                | `preserves ordering for equal-mtime tie-breaks`              |

Two additional integration cases were appended to the existing
`file-audit-sink.test.ts` to cover the wire after rotation and the
no-retention-configured no-op for `enforceRetentionNow()`.

Tests use in-memory `readdir`/`stat`/`unlink` stubs plus the injected
clock so disk and `$HOME` are never touched.

## 5. Expected failing test output

Initial run of the integration test in `file-audit-sink.test.ts`:

```
1 fail / 18 pass — `enforces retention after a rotation when retention is configured`
expected `existsSync(stalePath)` to be `false`, received `true`
```

The retention call ran but did not actually delete anything because
`runRetention` was forwarding `state.retention.fs` directly, which was
`undefined`, and `enforceRetention` treats a missing `fs.unlink` as
planner mode. The fix was to default `runRetention` to real `node:fs`
(`readdirSync` / `statSync` / `unlinkSync`) when the caller did not
override the `fs` deps.

## 6. Implementation changes

`packages/server-core/src/observability/audit-retention.ts` (new, 183
LOC):

- `enforceRetention({ dir, maxAgeMs, maxFiles, clock, fs })` lists
  candidate filenames via `fs.readdir`, filters them through
  `isRotatedAuditFile`, sorts them by mtime ascending, applies the
  age cutoff, then drops the oldest survivors until the count cap is
  met.
- Returns `{ deleted, kept }`, both sorted oldest-first by mtime.
- When `fs.unlink` is omitted the helper is a pure planner and skips
  the side-effecting loop.
- `enforceRetentionOnDisk(dir, maxAgeMs?, maxFiles?, clock?)` is a
  convenience wrapper that binds the helper to real `node:fs` for
  hosts that don't need to inject custom deps.
- `DEFAULT_MAX_AGE_MS` (90 days) + `DEFAULT_MAX_FILES` (60) exported.

`packages/server-core/src/observability/file-audit-sink.ts`
(extension, 282 → 335 LOC):

- New `FileAuditSinkRetention` type and `retention?` constructor
  parameter on `FileAuditSinkOptions`.
- New `enforceRetentionNow(): EnforceRetentionResult` method on the
  handle (no-op when no `retention` was configured).
- `rotateIfNeeded` calls `runRetention(state)` immediately after each
  successful `rotateTo` (daily + size-cap branches).
- `runRetention` defaults to real `node:fs`
  (`readdirSync` / `statSync` / `unlinkSync`) when the caller didn't
  supply `retention.fs`.

## 7. Validation commands run

```
bun test packages/server-core/src/observability/__tests__/audit-retention.test.ts
bun test packages/server-core/src/observability/__tests__/
bun run validate:rebrand
cd packages/server-core && bunx tsc --noEmit
```

## 8. Passing test output summary

```
$ bun test packages/server-core/src/observability/__tests__/
 39 pass / 0 fail / 128 expects (20 retention + 19 FileAuditSink)
 Ran 39 tests across 2 files. [66ms]
```

## 9. Build output summary

`bunx tsc --noEmit` (server-core) — no errors. Shared was untouched.

## 10. Remaining risks

- **No scheduled sweep.** Retention currently fires only after a
  rotation. On low-traffic days where the active `audit.log` never
  triggers daily/size rotation, stale rotated files persist past
  their cutoff. A periodic `setInterval` sweep is a Phase-2
  follow-up.
- **Best-effort `unlink`.** Failures during the sweep are swallowed
  so a single permission error doesn't abort the rest. Callers
  needing strict semantics can supply a custom `unlink` that throws
  upstream.
- **Hash-chain integration deferred.** The on-disk NDJSON remains
  independent of the in-memory `AuditEventStore` hash chain. The
  retention sweep does not touch the chain anchor.

## 11. Acceptance criteria matrix

| Criterion                                                | Status                                         |
| -------------------------------------------------------- | ---------------------------------------------- |
| `enforceRetention` planner + executor                    | Pass — see `is a pure planner` and `deletes a rotated file` tests |
| Default 90-day age cutoff                                | Pass — `DEFAULT_MAX_AGE_MS` constant + test    |
| Default 60-file count cap                                | Pass — `DEFAULT_MAX_FILES` constant + test     |
| Active `audit.log` never deleted                         | Pass — `never deletes the active audit.log` test |
| `FileAuditSink` `retention?` parameter (backward compat) | Pass — `enforceRetentionNow is a no-op` test   |
| Retention runs after rotation                            | Pass — `enforces retention after a rotation` test |
| Filesystem deps injected (no real disk in tests)         | Pass — `RetentionFsDeps`                       |
| Clock injected                                           | Pass — `uses the injected clock` test          |
| ≥20 `expect()` calls                                     | Pass — 54 in retention suite alone             |
| Source LOC ≤200, test LOC ≤300                           | Pass — 183 / 299                               |
| `bun test` of new dir green                              | Pass — 39 / 39 across both files               |
| `validate:rebrand`                                       | Pass                                           |
| `bunx tsc --noEmit` (server-core)                        | Pass                                           |
| Worklog complete                                         | This document                                  |
| Commits exist for the task                               | retention helper + tests (5a07c3c3) + sink integration + ticket/worklog |
