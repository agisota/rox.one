# T245 - Observability producer surface (logger + audit events + correlation)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into the
ROX.ONE Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

M.1.5 (C.4 follow-on, already DONE on `main`) landed the append-only
audit storage substrate. M.14 is the **producer side**: the structured
logger taxonomy, correlation-id propagation, and audit-event helpers
that the rest of the codebase imports without thinking. T245 ships
the shared producer surface; consumer call-site wiring across the
RBAC handlers, missions, and renderer telemetry lands in T246+
(separate slices) so the producer can stabilise first.

## Scope

Add `packages/shared/src/observability/` with five source modules
plus a barrel `index.ts`:

1. `correlation.ts` — `CorrelationId` branded type + `withCorrelationId`
   AsyncLocalStorage helper + `currentCorrelationId()` accessor +
   `mintCorrelationId()` factory (deterministic when seeded for tests).
2. `log-level.ts` — `LogLevel` union (`'trace'|'debug'|'info'|'warn'|'error'|'fatal'`)
   + numeric ordering + `shouldLog(threshold, level)` predicate.
3. `structured-logger.ts` — `StructuredLogger` interface +
   `createStructuredLogger({ sink, threshold })`. The sink is a pure
   injection point: `(event: StructuredLogEvent) => void`. The
   logger never reaches for `console`, `process.stdout`, or any FS.
4. `audit-event.ts` — exhaustive `AuditEvent` discriminated union:
   `RoleGranted`, `RoleRevoked`, `LoginSucceeded`, `LoginFailed`,
   `WorkspaceCreated`, `WorkspaceDeleted`, `MissionStarted`,
   `MissionCompleted`, `MissionFailed`. Every variant carries
   `actor`, `subject`, `scope`, `timestampMs`, `correlationId`.
5. `audit-producer.ts` — `AuditProducer` wraps a `StructuredLogger`
   plus a separate `AuditSink` interface. `emit(event)` validates
   payload structure (no `any` slips in), stamps the current
   correlation id when the event omits one, and fans out to both
   the sink AND the logger at `info` level so audit trails appear in
   both observability planes.

Plus `__tests__/` with five test files (one per source module)
totalling 59 cases / 151 expect() calls / ≤80 ms wall, covering:

- correlation propagation across `await` boundaries (the
  AsyncLocalStorage exact-instance contract)
- log-level numeric ordering + edge cases (`'trace'` vs `'fatal'`)
- logger sink injection + threshold filtering + payload immutability
- audit-event round-trip serialization (every variant)
- audit-producer fan-out (sink + logger both receive)

## Out of scope

- Wiring consumers. The RBAC admin handlers, mission scheduler, and
  renderer telemetry all stay untouched in T245. Their integration
  lands in T246 once the producer surface is stable on `main`.
- Real sinks (file, network, OS log). The interface is pure injection;
  hosts choose the sink at composition time. A file sink lands in
  T247 (Lane M.14 follow-on).

## Rules followed

- `AsyncLocalStorage` is imported from `node:async_hooks`. No external
  dependency was added.
- Clock-dependent code accepts a `() => number` parameter; no
  implicit `Date.now()` lives inside the modules.
- No `any`. Generic constraints sharpen the audit-event variants.
- Source LOC: ~440. Test LOC: ~420. Within budgets.

## Validation gates

- `bun test packages/shared/src/observability/__tests__/` — 59 / 59
  pass, 151 expect() calls, ~77 ms wall (cold).
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass (T245 + 246 tickets known).
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T246** — wire `AuditProducer.emit(...)` into the RBAC admin
  handlers (`registerRolesCoreHandlers`) for `roles.{grant,revoke}`
  mutations, and into the mission scheduler for start/complete/fail.
- **T247** — provide a default `FileAuditSink` that writes
  newline-delimited JSON to `~/.rox/audit.log` with daily rotation.
- **T248** — renderer telemetry consumer that subscribes to the
  audit-event stream via IPC.
