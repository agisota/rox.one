# Decision 0110: RBAC Audit Log Design

- Status: accepted
- Date: 2026-05-14

## Canonical
```text
audit events are written by:
  FileAuditSink at packages/server-core/src/observability/

sink writes to:
  ~/.rox/audit.log (default)
  path overridable via createFileAuditSink({ path })

file format is:
  NDJSON (one JSON object per line)
  append-only within the active file

rotation triggers fire on every drain:
  UTC daily — first-line ts date no longer matches today
    rotated filename: audit-YYYY-MM-DD.log (date from first line)
  size cap — active file size >= maxSizeBytes (default 10 MB)
    rotated filename: audit-YYYY-MM-DD.log (today's UTC date)

naming collisions resolve by numeric suffix:
  audit-YYYY-MM-DD-1.log, -2.log, ...
  historic data is never overwritten

FileAuditSink is composed at host bootstrap:
  not wired inside individual handlers
  AuditEventSource interface injected into the admin panel (T232)
  real RPC handler deferred to T232b

clock and homedir are injected dependencies:
  rotation tests are deterministic
  tests never touch real $HOME
```

## Why
- NDJSON is append-only, line-addressable, and parseable without loading the entire file into memory — suitable for long-running server processes and large audit trails.
- UTC-date rotation keeps log files aligned to calendar days without timezone ambiguity; the rotated filename reflects the content's actual day (harvested from the first line) rather than the clock at rotation time.
- A size cap (10 MB default) prevents unbounded file growth between midnight rotations on high-traffic hosts.
- Injecting clock and filesystem paths as parameters keeps the implementation pure and the test suite deterministic without mocking global state.
- Composing the sink at host bootstrap (rather than inside handlers) keeps `server-core` handler code free of I/O concerns and lets different hosts substitute alternate sinks (e.g., in-memory for tests, remote sink for cloud deployments).
