# T248 worklog — FileAuditSink (NDJSON to `~/.rox/audit.log` + daily/size rotation)

## 1. Task summary

Ship the default `FileAuditSink` implementation of the M.14 `AuditSink`
interface defined in `@rox-one/shared/observability`. The sink writes
one JSON object per line to a configurable path (default
`${homedir()}/.rox/audit.log`) and rotates on UTC-daily boundaries and
when a configurable size cap (default 10 MB) is breached. Hosts compose
this sink with `createAuditProducer({ sink, logger, clock })` at boot.

## 2. Repo context discovered

- `packages/shared/src/observability/` (T245) defines `AuditSink` as
  `(event: AuditEvent) => void`. The producer fans out to both this
  sink and a structured logger after validating the event.
- `packages/shared/src/observability/audit-event.ts` exports the
  exhaustive discriminated union; every variant carries `kind`, `ts`
  (ISO-8601), `correlationId` (branded string), `actor`, `subject`,
  `scope` plus kind-specific extras (e.g. `roleName` on
  `RoleGranted`).
- `packages/server-core` had no `observability/` directory before this
  task. It exposes one subpath per consumer surface
  (`./audit`, `./sessions`, …) in `package.json` exports.
- T246 (already merged) wired the producer into RBAC + scheduler call
  sites as an optional dependency, so hosts that omit the sink remain
  unchanged. T248 fills in the missing concrete sink.
- The roadmap historically reserved T247 for the file sink, but T247
  was consumed by the sqlite production persistence work. The current
  ticket number is T248; the originally-planned T248 (renderer
  telemetry) shifts forward in the sequence.

## 3. Files inspected

- `packages/shared/src/observability/index.ts`
- `packages/shared/src/observability/audit-producer.ts`
- `packages/shared/src/observability/audit-event.ts`
- `packages/shared/src/observability/correlation.ts`
- `packages/shared/src/observability/__tests__/audit-producer.test.ts`
- `packages/server-core/package.json`
- `packages/server-core/src/audit/audit-event-store.ts`
- `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts`
  (existing `mkdtempSync` test conventions — though we deliberately
   route under the test cwd, not `os.tmpdir()`, per the T248 prompt)
- `scripts/validate-agent-contract.ts`
- `scripts/validate-roadmap-coherence.cjs`
- `docs/tickets/T245-observability-producer-surface.md`
- `docs/tickets/T246-audit-wire-rbac-missions.md`
- `docs/worklog/T246-audit-wire-rbac-missions.md`

## 4. Tests added first

`packages/server-core/src/observability/__tests__/file-audit-sink.test.ts`
— 17 cases / 70 expect() calls covering:

| Concern                                                      | Test                                  |
| ------------------------------------------------------------ | ------------------------------------- |
| File created on first write                                  | `creates the log file on first write` |
| NDJSON shape (one JSON per line, newline-terminated)         | `writes NDJSON`                       |
| Canonical event shape preserved (kind/actor/subject/scope/ts) | `preserves the canonical event shape` |
| Append-only across batches                                   | `appends across multiple emit batches` |
| No rotation on same-date append                              | `appends to a pre-existing file from today` |
| Daily rotation on UTC date change                            | `rotates when the file head date does not match today` |
| Rotation uses UTC calendar day, not local offset             | `rotates using the UTC date even when the local clock differs` |
| Size-cap rotation                                            | `rotates when the file size meets or exceeds the configured cap` |
| No data loss across the rotation point                       | `rotation does not lose events queued before the rotation point` |
| Parent directory created if missing                          | `creates the parent directory if missing` |
| Default `${homedir()}/.rox/audit.log` (via injected `homedir`) | `defaults the path to ${homedir()}/.rox/audit.log` |
| Discriminated-union extras (e.g. `roleName`) round-trip      | `preserves discriminated-union extras` |
| `close()` flushes + rejects further writes                   | `close() flushes pending writes`      |
| Corrupted head → no rotate, keep appending                   | `handles a corrupted/empty existing file` |
| Rotation filename collision disambiguation                   | `disambiguates the rotated filename on collision` |
| NDJSON parseability across 25-event burst                    | `writes are JSON-parseable for every emitted event` |
| Default `maxSizeBytes` does not trigger spurious rotation    | `uses the configured maxSizeBytes default` |

Tests use a local `.tmp-test-file-audit-sink/` directory under the test
cwd (NOT `/tmp`) and clean up via `afterEach`. The clock and homedir
helpers are injected so rotation logic is deterministic and `$HOME` is
never touched.

## 5. Expected failing test output

Initial run (before refining the drain loop and fixing branded-type
test assertions):

```
12 fail / 5 pass / 27 expect() calls
```

The failures were two flavours: (a) writes that had not yet flushed to
disk by the time the test read the file back, and (b) `CorrelationId`
brand mismatches between `string` literals and the `asCorrelationId(...)`
return type. Both were resolved before the first commit.

## 6. Implementation changes

`packages/server-core/src/observability/file-audit-sink.ts` (new, 282
LOC):

- `createFileAuditSink(options)` returns a `FileAuditSinkHandle` with
  a pure-function `sink: AuditSink`, plus `flush()`, `close()`, and
  `activePath()` lifecycle helpers.
- Path defaults to `join(homedir(), '.rox', 'audit.log')` — both
  `homedir` and `path` are test seams.
- Each `sink(event)` call serialises to NDJSON and pushes onto an
  in-memory queue. A non-blocking `scheduleDrain` runs the rotation
  check once and then writes the queued lines through a single
  `createWriteStream(path, { flags: 'a' })`.
- `rotateIfNeeded` reads the first line's `ts`, compares against
  today's UTC date, and renames the file when they differ; size-cap
  rotation falls back to today's UTC date. Naming collisions iterate
  with a numeric suffix until a free slot is found.
- `flush()` awaits the in-flight drain in a loop (up to 8 passes) so
  events arriving while a drain is in flight are captured before the
  promise resolves.
- `close()` drains, then ends the stream and rejects subsequent
  `sink()` calls.

`packages/server-core/src/observability/index.ts` (new, ~15 LOC):
re-exports the factory and its public types.

`packages/server-core/package.json` (modified, +1 line): registers the
`./observability` subpath export.

## 7. Validation commands run

```
bun test packages/server-core/src/observability/__tests__/
bun run validate:agent-contract
bun run validate:roadmap
cd packages/server-core && bunx tsc --noEmit
```

## 8. Passing test output summary

```
$ bun test packages/server-core/src/observability/__tests__/
 17 pass / 0 fail / 70 expect() calls
 Ran 17 tests across 1 file. [68.00ms]
```

## 9. Build output summary

`bunx tsc --noEmit` (server-core) — no errors. The shared package was
not modified so its build is unaffected.

## 10. Remaining risks

- **Hash-chain integration.** The on-disk NDJSON is independent of the
  in-memory `AuditEventStore` hash chain. T249 (retention policy) will
  decide how the file sink interacts with re-anchored retention
  passes; the current sink writes unchained events for the local-host
  trail.
- **Multi-process writers.** The sink assumes a single writer per
  active file. Multi-process emission would require an external lock
  or per-process filenames; this is a follow-up if/when emission
  fans out beyond the main process.
- **Backpressure.** `write()` is fire-and-forget with a callback; the
  drain loop awaits each callback so kernel acceptance is confirmed,
  but the OS page-cache flush is not awaited (we do not `fsync`). For
  audit volumes a `fsync` per write would be excessive; for higher
  durability requirements a periodic `fsync` could be layered on.

## 11. Acceptance criteria matrix

| Criterion                                                | Status                                       |
| -------------------------------------------------------- | -------------------------------------------- |
| FileAuditSink writes NDJSON to configurable path         | Pass — see `writes NDJSON` test              |
| Defaults to `${homedir()}/.rox/audit.log`                | Pass — `defaults the path to …` test         |
| Daily rotation on UTC date change                        | Pass — `rotates when the file head date …` test |
| Size-cap rotation at `maxSizeBytes`                      | Pass — `rotates when the file size …` test   |
| Append-only (no truncation across runs)                  | Pass — `appends across multiple emit batches` test |
| No-data-loss across rotation                             | Pass — `rotation does not lose events …` test |
| Filesystem deps injected (no real `$HOME` in tests)      | Pass — `homedir` test seam                   |
| Clock injected for deterministic rotation tests          | Pass — `clock` option threaded through       |
| Tests use local temp dir (NOT `/tmp`)                    | Pass — `.tmp-test-file-audit-sink/`          |
| No new external deps                                     | Pass — Node built-ins only                   |
| Source LOC ≤300, test LOC ≤400                           | Pass — 282 / 327                             |
| `bun test` of new dir green                              | Pass — 17 / 17                               |
| `validate:agent-contract`                                | Pass                                          |
| `validate:roadmap`                                       | Pass                                          |
| `bunx tsc --noEmit` (server-core)                        | Pass                                          |
| Worklog complete                                         | This document                                |
| Commits exist for the task                               | feat/sink+tests + barrel + ticket/worklog   |
