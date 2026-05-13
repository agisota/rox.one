# T248 - FileAuditSink (NDJSON to `~/.rox/audit.log` + daily/size rotation)

Status: DONE

## Context

We are building a white-label fork of ROX.ONE OSS into the
ROX.ONE Agent Workbench Suite.

T245 (already on `main`) shipped the `AuditProducer` producer surface
plus the `AuditSink` interface at
`packages/shared/src/observability/`. T246 wired the producer into the
RBAC admin handlers and mission scheduler call sites. T248 ships the
default `FileAuditSink` implementation that hosts can compose with the
producer at boot — bridging the producer surface to a durable on-disk
audit trail.

## Scope

Add `packages/server-core/src/observability/` with two source files
plus the public barrel:

1. `file-audit-sink.ts` — `createFileAuditSink({ path?, homedir?,
   clock?, maxSizeBytes? })` returns a `FileAuditSinkHandle` carrying
   a pure-function `sink: AuditSink`, `flush(): Promise<void>`,
   `close(): Promise<void>`, and `activePath(): string`. Defaults the
   path to `${homedir()}/.rox/audit.log`. Two rotation triggers fire
   on every drain:
   - **UTC daily** — when the first-line `ts` no longer matches
     today's UTC date, rename the active file to
     `audit-YYYY-MM-DD.log` (date harvested from the first line so the
     rotated filename reflects the content's actual day) and start a
     fresh file.
   - **Size cap** — when the active file size meets or exceeds
     `maxSizeBytes` (default 10 MB), rotate using today's UTC date.
   Naming collisions resolve by appending a numeric suffix
   (`audit-YYYY-MM-DD-1.log`) so historic data is never overwritten.

2. `index.ts` — public barrel re-exporting `createFileAuditSink`,
   `FileAuditSinkOptions`, `FileAuditSinkHandle`. The
   `@rox-one/server-core/observability` subpath is registered in
   `packages/server-core/package.json` so hosts can import via
   that path.

3. `__tests__/file-audit-sink.test.ts` — 17 tests / 70 expect() calls
   covering: NDJSON shape (one JSON per line), append-only across
   batches, no rotation on same-date append, daily rotation on date
   change, UTC-vs-local-day rotation, size-cap rotation, no-data-loss
   across rotation, parent-directory creation, default-homedir path
   resolution, discriminated-union extras round-trip, close()-flushes
   + rejects-further-writes, corrupted-head no-rotate, collision
   disambiguation, and bulk-write JSON-parseability.

## Out of scope

- Wiring hosts to compose the file sink with the producer. That lands
  in the host bootstrap slice (Electron main, server build).
- Retention policy (T249) — log lines stay on disk indefinitely
  until an explicit retention sweep is implemented.
- Renderer-side audit feed (separate slice).
- Cross-process synchronisation. The sink is single-writer per active
  file; multi-process audit emission is a separate concern.

## Rules followed

- Filesystem dependencies injected as parameters
  (`homedir`, implicit `path` override). Tests never touch real
  `$HOME` or `/tmp`.
- Clock injected as `() => Date` so rotation tests are deterministic.
- No new external deps — Node built-ins (`node:fs`, `node:path`,
  `node:os`) only.
- Source LOC: 282 (≤300 budget). Test LOC: 327 (≤400 budget).
- Test temp dir lives under `.tmp-test-file-audit-sink/` in the test
  cwd, gitignored implicitly by `node_modules`/dist conventions and
  cleaned up after each test via `afterEach`.

## Validation gates

- `bun test packages/server-core/src/observability/__tests__/` —
  17 / 17 pass, 70 expect() calls.
- `bun run validate:agent-contract` — pass (261 tickets recognised).
- `bun run validate:roadmap` — pass (46 phases, 111 tickets).
- `bunx tsc --noEmit` (server-core) — pass (zero errors after
  fixing branded `CorrelationId` comparisons in the test file).

## Follow-ups

- **T249 retention policy** — periodic sweep of rotated
  `audit-YYYY-MM-DD.log` files older than the configured retention
  window (e.g. 90 days). Re-anchors the hash chain via
  `applyAuditRetentionPolicy` (already on `main` in the audit-event
  store) for any tamper-evident retention path.
- **Host wiring** — compose `createFileAuditSink({})` with
  `createAuditProducer({ sink, logger, clock })` at app boot
  (Electron main + server build).
- **Renderer audit feed** — IPC subscription so the UI can surface
  a live audit feed.
