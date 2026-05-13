# T249 - Audit-log retention policy (maxAge + maxFiles)

Status: DONE

## Context

We are building a white-label fork of ROX.ONE OSS into the
ROX.ONE Agent Workbench Suite.

T248 (PR #110, on `main`) shipped `FileAuditSink` at
`packages/server-core/src/observability/`. The sink rotates daily and
on size cap but retains every rotated `audit-YYYY-MM-DD[-N].log` file
indefinitely. T249 ships the retention policy: a configurable
`maxAge` (default 90 days) plus `maxFiles` cap (default 60). Rotated
files older than `maxAge` are deleted; if more than `maxFiles` remain
after the age sweep, the oldest are dropped until the cap is honoured.

## Scope

1. **`packages/server-core/src/observability/audit-retention.ts`**
   (new, 183 LOC):
   `enforceRetention({ dir, maxAgeMs, maxFiles, clock, fs })` is a
   pure-ish function that lists `audit-YYYY-MM-DD[-N].log` files in
   `dir`, computes which to delete under the combined age + count
   policy, optionally executes the deletions via the injected
   `fs.unlink`, and returns `{ deleted, kept }` (both sorted
   oldest-first by mtime). When `fs.unlink` is omitted the helper is a
   pure planner and returns the would-be deletions without touching
   disk. `DEFAULT_MAX_AGE_MS` (90 days) and `DEFAULT_MAX_FILES` (60)
   are exported for hosts that want the defaults.

2. **Extend `FileAuditSink`** (existing,
   `packages/server-core/src/observability/file-audit-sink.ts`,
   282 → 335 LOC):
   - New optional constructor parameter
     `retention?: { maxAgeMs, maxFiles, fs? }`. When absent, behaviour
     is identical to T248 — rotated files accumulate indefinitely.
   - When set, `enforceRetention` runs immediately after every
     rotation (daily and size-cap paths).
   - New handle method `enforceRetentionNow(): EnforceRetentionResult`
     so hosts can force a sweep at boot. A no-op when no `retention`
     was configured.

3. **Tests**
   `packages/server-core/src/observability/__tests__/audit-retention.test.ts`
   (new, 299 LOC) — 20 tests / 54 expects covering empty-dir no-op,
   age cutoff (delete past, keep equal-to-cutoff), count cap, combined
   age+count, active `audit.log` never deleted, non-audit files
   ignored, numeric-suffix collision filenames, oldest-first ordering,
   pure-planner mode (no `unlink`), readdir/stat error handling,
   unlink-error tolerance, `maxFiles=0` / `maxAgeMs=0` extremes,
   default constants, `isRotatedAuditFile` regex shape check, injected
   clock, equal-mtime tie-break stability.

   Two integration tests appended to the existing FileAuditSink suite
   exercise the retention wire after a rotation and confirm
   `enforceRetentionNow()` is a no-op when no retention is configured.

4. **Worklog** `docs/worklog/T249-audit-retention.md`.

## Out of scope

- Host wiring to compose `createFileAuditSink({ retention: {...} })`
  at app boot. That lands in the Electron-main and server-build
  bootstrap slices.
- The hash-chain retention re-anchor on the in-memory
  `AuditEventStore`. This ticket targets the on-disk NDJSON trail
  only.
- A scheduled cron-style sweep that runs without a rotation event.
  The current design runs retention after each rotation; explicit
  scheduling is a future follow-up.

## Rules followed

- Filesystem dependencies injected via `RetentionFsDeps`
  (`readdir`, `stat`, `unlink`). Tests use in-memory stubs.
- Clock injected as `() => Date`. Tests never call `Date.now()`.
- No new external deps — Node built-ins only (`node:fs`, `node:path`).
- Source LOC: 183 (≤200 budget). Test LOC: 299 (≤300 budget).
- File budget honoured: helper + tests + FileAuditSink extension +
  ticket + worklog only. `packages/shared/src/observability/` and
  `audit-producer.ts` were not modified.

## Validation gates

- `bun test packages/server-core/src/observability/__tests__/` —
  39 pass / 0 fail / 128 expects across 2 files (20 retention + 19
  FileAuditSink).
- `bun run validate:rebrand` — pass.
- `bunx tsc --noEmit` (server-core) — pass.

`validate:agent-contract` and `validate:roadmap` already failed at
the base commit (T223 status format + pre-existing M.1.3b roadmap
violation); both failures are outside the T249 file set.

## Follow-ups

- **Host bootstrap wiring.** Compose
  `createFileAuditSink({ retention: {...} })` at Electron-main and
  server-build boot.
- **Scheduled sweep.** Layer a `setInterval` retention call so the
  policy fires on low-traffic days when rotations don't happen.
- **M.14 closeout.** T245 (producer) + T246 (RBAC/scheduler wire) +
  T248 (file sink) + T249 (retention) form the durable on-disk audit
  trail. Renderer audit feed and tamper-evident hash chain integration
  remain as a separate slice.
