# Decision 0015: Audit-Trail Producer + Durable NDJSON Sink Architecture

- Status: accepted
- Date: 2026-05-13
- Implements: T245 (producer surface), T246 (RBAC + missions wire),
  T246b (FileAuditSink host composition), T246c (bootstrap helper),
  T248 (FileAuditSink), T249 (retention policy).
- Source tickets:
  `docs/tickets/T245-observability-producer-surface.md`,
  `docs/tickets/T246-audit-wire-rbac-missions.md`,
  `docs/tickets/T246b-fileauditsink-host.md`,
  `docs/tickets/T246c-bootstrap-host-audit.md`,
  `docs/tickets/T248-file-audit-sink.md`,
  `docs/tickets/T249-audit-retention.md`.
- Companion: ADR 0008 (audit storage backend).

## Canonical

Audit events are produced via a typed AuditProducer surface that
fans out to a structured logger AND a durable NDJSON sink with
daily+size rotation and 90d/60-file retention.

```text
audit_trail:
  producer_surface:
    dir:      packages/shared/src/observability/
    modules:  correlation, log-level, structured-logger,
              audit-event, audit-producer
    variants: RoleGranted | RoleRevoked | LoginSucceeded | LoginFailed
              WorkspaceCreated | WorkspaceDeleted
              MissionStarted | MissionCompleted | MissionFailed
    fields:   actor, subject, scope, timestampMs, correlationId
  consumer_wiring:
    rbac:       roles.ts emit RoleGranted on success
                          emit RoleRevoked on revoked === true (no emit on no-op)
    missions:   scheduler.ts MissionStarted | MissionCompleted (durationMs)
                              MissionFailed (errorMessage)
    contract:   emit AFTER store mutation; failed write -> no emit
  durable_sink:
    file:         packages/server-core/src/observability/file-audit-sink.ts
    factory:      createFileAuditSink({ path?, homedir?, clock?,
                                          maxSizeBytes?, retention? })
    format:       NDJSON, one JSON object per line, append-only
    default_path: ${homedir()}/.rox/audit.log
    rotation:     UTC daily; size cap (default 10 MB); collision -> -N suffix
  retention:
    file:     audit-retention.ts
    defaults: maxAgeMs = 90 days, maxFiles = 60
    runs:     on every rotation; enforceRetentionNow() on boot
              never deletes active audit.log
  host_composition:
    factory:  createHostAuditProducer(...) -> { producer, dispose,
                                                activeLogPath, logger,
                                                enforceRetentionNow }
    seam:     attachAuditProducer(deps, options?)
    killsw:   ROX_AUDIT_DISABLE truthy -> no-op producer
```

## Decisions

Six decisions, each with rationale.

### 1. Producer surface lives in `@rox-one/shared/observability`

The taxonomy (`AuditEvent` discriminated union), the producer
(`AuditProducer`), and the sink interface (`AuditSink`) all live
in `packages/shared/src/observability/`. No runtime services are
imported by the producer surface beyond `AsyncLocalStorage`.

**Reasons.**

- **Shared between server, renderer, and edge.** Every layer
  emits with the same event shapes and the same correlation
  propagation. Renderer code can emit `LoginFailed` without
  pulling in `node:fs`.
- **Pure injection point.** Hosts choose their sink at
  composition time. The producer never reaches for a logger
  global or an audit file.

### 2. Optional wiring; producer absence is a hot no-op

`HandlerDeps.auditProducer` is `optional`. Handlers that emit
gate on `deps.auditProducer && deps.auditProducer.emit(...)`. A
host that has not adopted observability sees zero behaviour
change versus the pre-T246 baseline.

**Reasons.**

- **Backward compat at scale.** The producer wire landed across
  RBAC + missions in a single slice; the optionality kept every
  pre-existing host green.
- **Tests opt in.** A test that asserts audit emission wires a
  stub `AuditProducer`. A test that does not care leaves the
  dep undefined.
- **Renderer telemetry path stays decoupled.** Renderer wires
  its own producer when the IPC channel lands; the server
  producer continues independently.

### 3. NDJSON on disk; one JSON object per line; append-only

The on-disk format is newline-delimited JSON written via append.
Each line is a fully serialised `AuditEvent`. No multi-line
records. Parsers can stream-process the file with line-by-line
deserialisation.

**Reasons.**

- **Crash-safe.** A torn write produces at most one corrupt
  trailing line; parsers skip and resume. A structured format
  with multi-line records would corrupt the file globally.
- **`grep`-friendly.** `grep RoleGranted audit.log` is the
  baseline operator query. Operations does not need a custom
  reader.
- **Streamable.** `for await (const line of readline(file))`
  scales to multi-GB files without loading them into memory.

### 4. Two rotation triggers: UTC daily AND size cap

Daily rotation triggers on the first write whose JSON `ts` does
not match today's UTC date; the rotated file inherits the
first-line date so historic queries are deterministic. Size
rotation triggers when the active file meets or exceeds
`maxSizeBytes` (default 10 MB). Both renames produce
`audit-YYYY-MM-DD[-N].log` with numeric suffix on collision.

**Reasons.** Daily anchors investigation queries ("yesterday's
RBAC grants" maps to one file). Size cap prevents pathologically
large files. Naming collisions never overwrite — historic data
is immutable.

### 5. Retention: 90 days OR 60 files, whichever is more restrictive

`enforceRetention({ maxAgeMs, maxFiles })` deletes files older
than `maxAgeMs` (default 90d), then drops oldest until at most
`maxFiles` (default 60) remain. Active `audit.log` is never
deleted. Runs on every rotation plus once at boot via
`enforceRetentionNow()`.

**Reasons.** Disk pressure stays bounded. 90 days exceeds the
typical incident-response window. The "never delete active
`audit.log`" rule is enforced by structure: the rotated-file
regex excludes the active name so a misconfigured sweep cannot
destroy live data.

### 6. Host composition root + bootstrap helper

`createHostAuditProducer` (T246b) is the single factory hosts
call to assemble the chain. `attachAuditProducer` (T246c) is
the seam hosts call after `bootstrapServer(...)`; it writes the
producer onto `deps.auditProducer` and honours
`ROX_AUDIT_DISABLE` as a kill switch for hermetic dev runs.

**Reasons.** Electron-main, server-build, and integration tests
all assemble the chain via one factory call — wiring drift is
impossible. `dispose()` flushes, runs a final retention sweep,
closes the stream, and is idempotent. `ROX_AUDIT_DISABLE=1`
installs a no-op producer so dev runs never touch
`~/.rox/audit.log` while the handler happy path still fires.

## Invariants

Three invariants the audit-trail slice holds.

### 1. Emit AFTER store mutation; failed write -> no emit

Enforced by structure across every consumer (`roles.ts`,
`scheduler.ts`). A handler that fails to mutate the store
returns its typed error envelope and never reaches the emit
line.

### 2. Idempotent revoke does NOT emit

`roles.revoke` emits only when `revoked === true`. A revoke on
a non-existent grant returns `{ok: true, revoked: false}` and
the audit log stays meaningful.

### 3. NDJSON output is parseable line-by-line

Enforced by:

- `file-audit-sink.test.ts` — bulk-write JSON-parseability
  case, NDJSON-shape pinning, corrupted-head no-rotate case.

## Out of scope

- **Renderer audit feed.** A ring-buffer sink composed into the
  `sinks` array exposes audit events to the renderer via IPC.
  Lands when the channel is approved.
- **Tamper-evident hash chain integration.** The in-memory
  `AuditEventStore` (ADR 0008) maintains a hash chain. The
  on-disk NDJSON remains independent today; a future slice
  pulls the chain anchor into the file format.
- **Scheduled retention sweep.** Retention runs after rotation
  and at boot. A `setInterval` sweep for low-traffic days is a
  future concern.
- **Multi-process audit emission.** The sink is single-writer
  per active file; cross-process audit is a separate design.
