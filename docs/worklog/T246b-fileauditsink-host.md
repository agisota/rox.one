# T246b worklog — FileAuditSink host composition

## 1. Task summary

Add a single host-side factory, `createHostAuditProducer`, that
assembles the M.14 observability chain — `StructuredLogger +
FileAuditSink + AuditProducer + retention` — and exposes the
producer for handlers to inject. Returns `{ producer, dispose,
activeLogPath, logger, enforceRetentionNow }`. `dispose()` flushes
the file sink, runs a final retention sweep, and closes the file
handle. Idempotent.

This is the composition root for the M.14 trail: T245 (producer
interface), T246 (RBAC/missions wire), T248 (file sink), and T249
(retention) all already live on `main`. Before T246b, each host
(Electron-main, server-build bootstrap, integration tests) would
have to wire the chain by hand. T246b centralises that into one
factory call.

## 2. Repo context discovered

- `packages/shared/src/observability/` (T245) is the producer-side
  package: `createStructuredLogger`, `createAuditProducer`,
  `AuditSink`, `LogSink`, `Clock` types. The `AuditProducer.emit`
  call also fans out a structured log line at a level appropriate to
  the audit kind (info / warn / error) — that is part of T245, not
  something the host has to reproduce.
- `packages/server-core/src/observability/file-audit-sink.ts` (T248)
  exposes `createFileAuditSink({ path, homedir, clock, maxSizeBytes,
  retention })` returning `{ sink, flush, close, activePath,
  enforceRetentionNow }`. The handle is the entire surface T246b
  needs to wrap.
- `packages/server-core/src/observability/audit-retention.ts`
  (T249) exposes `DEFAULT_MAX_AGE_MS` (90 days) and
  `DEFAULT_MAX_FILES` (60); T246b mirrors those defaults so behaviour
  is consistent across direct file-sink construction and the host
  factory.
- The barrel at `packages/server-core/src/observability/index.ts`
  only re-exported the file-sink types pre-T246b; the retention
  surface from T249 was not re-exported. T246b extends the barrel to
  cover both T249 and the new T246b types.

## 3. Files inspected

- `packages/shared/src/observability/index.ts`
- `packages/shared/src/observability/audit-producer.ts`
- `packages/shared/src/observability/structured-logger.ts`
- `packages/shared/src/observability/audit-event.ts`
- `packages/server-core/src/observability/index.ts`
- `packages/server-core/src/observability/file-audit-sink.ts`
- `packages/server-core/src/observability/audit-retention.ts`
- `packages/server-core/src/observability/__tests__/file-audit-sink.test.ts`
- `docs/tickets/T249-audit-retention.md`
- `docs/worklog/T249-audit-retention.md`

## 4. Tests added first

`packages/server-core/src/observability/__tests__/host.test.ts`
(297 LOC) — 18 cases / 55 expects, summarised:

| Concern                                                          | Test                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Factory builds the producer + sink + logger chain                | `builds the producer + sink + logger chain end-to-end`                |
| Emit lands in both file sink and structured logger               | `emits to both the file sink and the structured logger`               |
| Extra-sink fan-out alongside the file sink                       | `fan-outs to extra sinks alongside the file sink`                     |
| Throwing extra sink isolated; file sink still wins               | `isolates a throwing extra sink: file sink still wins, error logged` |
| `dispose()` flushes then closes the handle                       | `dispose() flushes pending writes then closes the file handle`        |
| `dispose()` is idempotent across calls                           | `dispose() is idempotent across multiple calls`                       |
| `dispose()` tolerates a throwing flush                           | `dispose() tolerates a throwing flush and continues to close`         |
| `dispose()` tolerates a throwing retention sweep                 | `dispose() tolerates a throwing retention sweep and continues to close` |
| Retention options threaded into the file-sink factory            | `threads retention options into the FileAuditSink factory`            |
| Default retention fallback (90 days / 60 files)                  | `falls back to default retention defaults when no policy supplied`    |
| Default `logDir = ${homedir()}/.rox`                              | `defaults logDir to ${homedir()}/.rox when not supplied`              |
| `enforceRetentionNow()` forwards to the file-sink handle         | `enforceRetentionNow forwards to the file-sink handle`                |
| Producer stamps `ts` + `correlationId` when omitted              | `producer.emit stamps ts + correlationId when omitted by caller`      |
| Multi-event ordering preserved                                   | `emits multiple events in order through to the file sink`             |
| `LoginFailed` → warn, `MissionFailed` → error                    | `escalates LoginFailed → warn and MissionFailed → error in the log`   |
| NDJSON output (one JSON / line, newline-terminated)              | `writes NDJSON: one JSON object per line, newline-terminated`         |
| Structured logger surfaced for host wiring                       | `exposes the structured logger so hosts can log around emits`         |
| No-op default `logSink` doesn't throw                            | `drops log records when no logSink is supplied (production default)` |

Tests run against the real `FileAuditSink` under a per-test temp
dir LOCAL to the test cwd (never `/tmp`, never `$HOME`). A
`createFileSink` test seam covers dispose/flush/close call ordering
directly via an in-memory stub.

## 5. Expected failing test output

Initial `bunx tsc --noEmit` (after first test draft) reported:

```
src/observability/__tests__/host.test.ts(198,22): error TS2339:
  Property 'maxAgeMs' does not exist on type 'never'.
src/observability/__tests__/host.test.ts(199,22): error TS2339:
  Property 'maxFiles' does not exist on type 'never'.
…
```

Root cause: TypeScript narrowed a `let captured: T | null = null`
to `null` at the `expect()` call sites because it couldn't prove
the `createFileSink` lambda had executed. Fix: replace the
nullable with a pre-populated object `{ maxAgeMs: -1, maxFiles: -1
}` and mutate fields in place. No semantic change to the test —
the `-1` sentinel is overwritten by the real factory call before
the assertion fires.

## 6. Implementation changes

`packages/server-core/src/observability/host.ts` (new, 167 LOC):

- `createHostAuditProducer(options)` builds:
  - A `StructuredLogger` against `options.logSink ?? noop` at
    `threshold: 'debug'`.
  - A `FileAuditSink` via `options.createFileSink ?? default`,
    threading `path = ${logDir}/audit.log`, the injected clock and
    homedir, and the retention defaults.
  - A `fanOut: AuditSink` that calls the file sink first (durable
    write) and then iterates `options.sinks` with per-sink
    try/catch that logs `audit.extraSinkError`.
  - An `AuditProducer` via `createAuditProducer({ sink: fanOut,
    logger, clock })`.
- `dispose()` is guarded by a local `disposed` flag for
  idempotency. It awaits `fileSink.flush()`, runs
  `fileSink.enforceRetentionNow()`, then awaits `fileSink.close()`.
  Errors from flush and retention are logged via the producer's
  own logger (`audit.flushError`, `audit.retentionError`) and
  never propagate.
- `enforceRetentionNow()` on the returned chain delegates straight
  through to the file-sink handle so hosts can force a sweep at
  boot.

Exports `DEFAULT_HOST_MAX_AGE_MS` (90 days), `DEFAULT_HOST_MAX_FILES`
(60), `DEFAULT_HOST_LOG_DIR_NAME` (`.rox`),
`DEFAULT_HOST_LOG_FILE_NAME` (`audit.log`).

`packages/server-core/src/observability/index.ts` (extended):
re-export the T246b factory + types, the T248
`FileAuditSinkRetention` type, and the T249 retention surface so
consumers import the full story from a single subpath
(`@rox-one/server-core/observability`).

## 7. Validation commands run

```
bun test packages/server-core/src/observability/__tests__/host.test.ts
bun test packages/server-core/src/observability/__tests__/
bun run validate:rebrand
cd packages/server-core && bunx tsc --noEmit
```

## 8. Passing test output summary

```
$ bun test packages/server-core/src/observability/__tests__/host.test.ts
 18 pass / 0 fail / 55 expects
 Ran 18 tests across 1 file. [72ms]

$ bun test packages/server-core/src/observability/__tests__/
 57 pass / 0 fail / 183 expects
 Ran 57 tests across 3 files. [73ms]
```

## 9. Build output summary

`bunx tsc --noEmit` (server-core) — no errors. Shared was untouched.

## 10. Remaining risks

- **No host adoption yet.** The factory is ready but no host (Electron-main,
  server-build bootstrap) is calling it yet. That adoption is a small
  follow-up slice; until it lands, the durable on-disk trail is not active
  in shipped builds.
- **No scheduled sweep.** Retention fires after every rotation and on
  dispose, but on long-running low-traffic hosts where the active
  `audit.log` never rotates, stale rotated files can persist past their
  cutoff. A periodic `setInterval` retention call is a Phase-2 follow-up.
- **Hash-chain integration deferred.** Disposal does not anchor the
  in-memory `AuditEventStore` hash chain. The on-disk trail remains
  independent.

## 11. Acceptance criteria matrix

| Criterion                                              | Status                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| Host factory builds chain end-to-end                   | Pass — `builds the producer + sink + logger chain end-to-end`       |
| Default `logDir = ${homedir()}/.rox`                   | Pass — `defaults logDir to ${homedir()}/.rox when not supplied`     |
| Default retention `{ 90 days, 60 files }`              | Pass — `falls back to default retention defaults when no policy supplied` |
| Emit lands in sink + structured logger                 | Pass — `emits to both the file sink and the structured logger`      |
| Dispose flushes pending writes + closes handle         | Pass — `dispose() flushes pending writes then closes the file handle` |
| Dispose runs final retention sweep                     | Pass — covered by `dispose()` flush/close ordering test             |
| Dispose tolerates flush/retention errors               | Pass — two dedicated tolerance tests                                |
| Extra-sink fan-out + throw isolation                   | Pass — `fan-outs to extra sinks` + `isolates a throwing extra sink` |
| ≥15 `expect()` calls                                   | Pass — 55                                                           |
| Source LOC ≤200, test LOC ≤300                         | Pass — 167 / 297                                                    |
| `bun test` of observability dir green                  | Pass — 57 / 57                                                      |
| `validate:rebrand`                                     | Pass                                                                |
| `bunx tsc --noEmit` (server-core)                      | Pass                                                                |
| Barrel re-exports T246b + T249 + T248 retention types  | Pass — `packages/server-core/src/observability/index.ts`            |
| Ticket + worklog present                               | This document + `docs/tickets/T246b-fileauditsink-host.md`          |
| No modifications to T245/T246/T248/T249 surfaces       | Pass — `git log --stat` shows only `host.ts` + barrel touched       |
