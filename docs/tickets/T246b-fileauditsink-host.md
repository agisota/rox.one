# T246b - FileAuditSink host composition (producer + sink + retention chain)

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into the
ROX.ONE Agent Workbench Suite.

T245 (on `main`) shipped the `AuditProducer` + `AuditSink` interface.
T246 (on `main`) wired emit points into RBAC + missions. T248 (on
`main`) shipped `FileAuditSink` (NDJSON to `~/.rox/audit.log`). T249
(on `main`) added the retention policy. T246b is the **composition
root**: a single host-side factory that constructs `AuditProducer +
FileAuditSink + retention` and exposes the producer for handlers to
inject.

Prior to this ticket each host (Electron-main, server-build bootstrap,
integration tests) would have to repeat the wiring by hand — assemble
the structured logger, build a `FileAuditSink` with the right
retention, fan out into `createAuditProducer`, and manually flush +
close on shutdown. T246b centralises that into one factory call.

## Scope

1. **`packages/server-core/src/observability/host.ts`** (new, 167
   LOC): `createHostAuditProducer({ logDir, homedir, retention,
   clock, logSink, sinks, createFileSink })` factory.
   - Default `logDir = ${homedir()}/.rox`
   - Default retention: `{ maxAgeMs: 90 * DAY, maxFiles: 60 }`
     (matches the T249 `DEFAULT_MAX_AGE_MS` / `DEFAULT_MAX_FILES`
     constants).
   - Constructs `StructuredLogger` + `FileAuditSink` + `AuditProducer`
     chain. Optional extra `AuditSink[]` fan-out alongside the file
     sink (e.g. an in-memory ring buffer for the renderer feed).
   - Returns `{ producer, dispose, activeLogPath, logger,
     enforceRetentionNow }`.
   - `dispose()` flushes the file sink, runs a final retention sweep,
     and closes the underlying write stream. Idempotent across
     multiple calls so app-quit / test-teardown paths are safe.
   - Errors during dispose (`flush`, `enforceRetentionNow`) are logged
     via the producer's own structured logger and never propagate.
   - Throwing extra sinks are isolated: the file sink still wins and
     the error is logged on `audit.extraSinkError`.

2. **`packages/server-core/src/observability/__tests__/host.test.ts`**
   (new, 297 LOC) — 18 cases / 55 expects covering:
   - Factory builds the chain end-to-end (`producer`, `logger`,
     `activeLogPath`, `dispose` all present).
   - Emitting an event lands in both the file sink and the structured
     logger.
   - Extra-sink fan-out alongside the file sink.
   - Throwing extra sink is isolated; file sink still wins.
   - `dispose()` flushes pending writes then closes the handle (in
     that order, asserted via stub).
   - `dispose()` is idempotent across multiple calls.
   - `dispose()` tolerates a throwing flush.
   - `dispose()` tolerates a throwing retention sweep.
   - Retention options threaded into the file-sink factory.
   - Default retention fallback (90 days / 60 files) when no policy
     supplied.
   - Default `logDir = ${homedir()}/.rox` resolves via injected
     `homedir()`.
   - `enforceRetentionNow()` forwards to the file-sink handle.
   - `producer.emit` stamps `ts` + `correlationId` when omitted.
   - Multi-event ordering preserved through to the file sink.
   - `LoginFailed` escalates to `warn`, `MissionFailed` to `error`
     in the structured log.
   - NDJSON output (one JSON object per line, newline-terminated).
   - Structured logger surfaced for host wiring (`host.bootstrap`
     log line round-trip).
   - Log records dropped silently when no `logSink` supplied
     (production default).

3. **Barrel update** —
   `packages/server-core/src/observability/index.ts` re-exports the
   T246b host factory + types, the T248 `FileAuditSinkRetention`
   type, and the T249 retention surface so consumers can import
   the full observability story from a single subpath
   (`@rox-one/server-core/observability`).

## Out of scope

- Wiring `createHostAuditProducer` into the Electron-main and
  server-build bootstrap paths. The factory is now ready for
  consumption; the actual call-site adoption is tracked in a
  follow-up bootstrap slice so the host-side composition lands
  independently of any host bootstrap changes.
- Renderer telemetry consumer (T247).
- Hash-chain integration. The on-disk NDJSON remains independent
  of the in-memory `AuditEventStore` hash chain — disposal does
  not touch the chain anchor.
- Scheduled retention sweep (`setInterval`). Retention still runs
  on rotation events + a final pass on dispose.

## Rules followed

- T245/T246/T248/T249 surfaces imported verbatim; no modifications
  to `packages/shared/src/observability/`, `file-audit-sink.ts`, or
  `audit-retention.ts`.
- File handles, retention scheduling, clock, homedir, and the
  file-sink factory are all injectable. Tests never touch real
  `$HOME` and never write outside the per-test temp dir under
  `cwd/.tmp-test-host-audit-producer/`.
- No new external dependencies — Node built-ins (`node:os`,
  `node:path`) plus the existing observability packages.
- Source LOC: 167 (≤200 budget). Test LOC: 297 (≤300 budget).
- File budget honoured: host factory + tests + barrel extension +
  ticket + worklog only.

## Validation gates

- `bun test packages/server-core/src/observability/__tests__/` —
  57 pass / 0 fail / 183 expects across 3 files (18 host + 19
  file-audit-sink + 20 retention).
- `bun run validate:rebrand` — pass.
- `bunx tsc --noEmit` (server-core) — pass.

`validate:agent-contract` and `validate:roadmap` already fail at the
base commit (T223 status format + pre-existing M.1.3b roadmap
violation); both failures are outside the T246b file set and were
documented as pre-existing in T249's worklog.

## Follow-ups

- **Host bootstrap adoption.** Call `createHostAuditProducer` from
  the Electron-main boot path and from the server-build bootstrap so
  the file sink is live in shipped builds. The factory is the
  composition root — the call-site adoption is a small, isolated
  slice that can land on its own schedule.
- **Renderer audit feed.** Drop an in-memory ring-buffer sink into
  the `sinks` array; the renderer reads it via IPC on demand.
- **Scheduled sweep.** Layer a `setInterval` retention call so the
  policy fires on low-traffic days where rotations never trigger.

## M.14 closeout

T245 (producer) + T246 (RBAC/missions wire) + T248 (file sink) +
T249 (retention) + T246b (host composition) now form the durable
on-disk audit trail with a single-call host bootstrap. Renderer
audit feed and tamper-evident hash chain integration remain as a
separate slice.
