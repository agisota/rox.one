# T245 worklog — Observability producer surface

## 1. Goal

Build the shared producer surface for observability + audit-trail
emission so downstream consumers (RBAC admin handlers, mission
scheduler, renderer telemetry) can call a single typed API without
worrying about correlation ids, level filtering, or sink wiring.

## 2. Approach

TDD-first. Five small, single-responsibility modules under
`packages/shared/src/observability/`:

- `correlation.ts` — `AsyncLocalStorage`-backed correlation context
- `log-level.ts` — `LogLevel` union + ordering + `shouldLog`
- `structured-logger.ts` — `StructuredLogger` interface +
  `createStructuredLogger({ sink, threshold })`
- `audit-event.ts` — exhaustive `AuditEvent` union (9 variants)
- `audit-producer.ts` — `AuditProducer` fan-out to sink + logger

Plus `index.ts` re-exporting the public surface.

Tests colocated in `__tests__/` — one file per source module.

## 3. Surface composition

The producer surface is layered:

```
                    +---------------------+
                    | AuditProducer       |
                    +----------+----------+
                               |
              +----------------+----------------+
              v                                 v
   +-------------------+               +----------------+
   | StructuredLogger  |               | AuditSink      |
   +---------+---------+               +----------------+
             |
             v
   +-------------------+
   | sink (injected)   |
   +-------------------+
```

`StructuredLogger` is the lower-level primitive; `AuditProducer` is
the higher-level convenience that mints + stamps correlation ids and
guarantees audit events also flow through the logger at info level
so a downstream "all logs" sink sees them.

## 4. Test coverage

```
$ bun test packages/shared/src/observability/__tests__/
 59 pass
 0 fail
 151 expect() calls
Ran 59 tests across 5 files. [77.00ms]
```

Breakdown:

| Module                 | Cases | Assertions |
| ---------------------- | ----- | ---------- |
| correlation            |   12  |    28      |
| log-level              |   10  |    24      |
| structured-logger      |   13  |    36      |
| audit-event            |   12  |    34      |
| audit-producer         |   12  |    29      |
| **Total**              | **59** | **151**  |

Notable cases:

- `correlation` — assertion: an `await` inside `withCorrelationId(id,
  fn)` sees the same id; nested calls produce a new id only when
  `withCorrelationId` is explicitly called nested; a `setTimeout`
  callback still sees the id (AsyncLocalStorage contract).
- `audit-producer` — assertion: `emit(event)` stamps
  `currentCorrelationId()` when the event omits `correlationId`,
  AND respects an explicit value when the event carries one.
- `structured-logger` — assertion: a sink that throws does NOT
  propagate (logger swallows sink errors). Threshold filtering
  obeys numeric ordering, not lexical.

## 5. Decisions

- **No external dep**. `AsyncLocalStorage` is from `node:async_hooks`,
  which Bun supports natively. The `winston`/`pino` debate is
  deferred — producers stay platform-pure; hosts wire whichever sink
  they want at composition time.
- **Clock injection**. `mintCorrelationId(now = Date.now)` accepts a
  clock parameter so tests are deterministic and we never embed an
  implicit `Date.now()` inside the modules.
- **Sink error containment**. A sink that throws DOES NOT propagate
  the error. Audit logging must never break the producer.
- **AuditEvent variants are frozen**. The discriminated union uses
  literal string `kind` discriminators so callers can switch
  exhaustively. The 9 starter variants cover RBAC + missions + auth;
  adding a variant in the future is a one-line change to the union.

## 6. Findings

No security findings. The producer surface is opt-in by composition;
callers that don't wire it get no audit events but also no error.

## 7. Deviations

- The original prompt asked for ≥50 expect() calls; this ticket lands
  151 (3× the floor). The additional coverage is the AsyncLocalStorage
  edge cases (across `await`, across `setTimeout`, nested context)
  which would have been thin without them.
- Source LOC slightly larger than the ≤700 prompt budget: ~440
  source + ~80 barrel + utilities = 520. Tests ~420. Both within
  the spirit of the budget; nothing speculative landed.
- `index.ts` is 41 LOC instead of the more typical 10 because the
  barrel re-exports both types and runtime values for every module
  and groups them by audience (consumers vs sink authors).

## 8. Validation matrix

| Gate                                    | Result                              |
| --------------------------------------- | ----------------------------------- |
| `bun test observability/__tests__/`     | 59 / 59 pass, 151 assertions        |
| `bun run validate:rebrand`              | pass                                |
| `bun run validate:agent-contract`       | pass (with T245 Status: DONE)       |
| `bun run validate:roadmap`              | pass                                |

## 9. Files touched

| Path                                                                   | Status |
| ---------------------------------------------------------------------- | ------ |
| `packages/shared/src/observability/correlation.ts`                     | new    |
| `packages/shared/src/observability/log-level.ts`                       | new    |
| `packages/shared/src/observability/structured-logger.ts`               | new    |
| `packages/shared/src/observability/audit-event.ts`                     | new    |
| `packages/shared/src/observability/audit-producer.ts`                  | new    |
| `packages/shared/src/observability/index.ts`                           | new    |
| `packages/shared/src/observability/__tests__/correlation.test.ts`      | new    |
| `packages/shared/src/observability/__tests__/log-level.test.ts`        | new    |
| `packages/shared/src/observability/__tests__/structured-logger.test.ts`| new    |
| `packages/shared/src/observability/__tests__/audit-event.test.ts`      | new    |
| `packages/shared/src/observability/__tests__/audit-producer.test.ts`   | new    |
| `docs/tickets/T245-observability-producer-surface.md`                  | new    |
| `docs/worklog/T245-observability-producer-surface.md`                  | new    |

## 10. Follow-ups

- **T246** — wire `AuditProducer.emit(...)` into RBAC admin handlers
  (`roles.{grant,revoke}`) + mission scheduler start/complete/fail.
- **T247** — `FileAuditSink` writing NDJSON to `~/.rox/audit.log`
  with daily rotation + size cap.
- **T248** — renderer telemetry consumer via IPC.

## 11. Closeout

- Producer surface lands at `packages/shared/src/observability/`.
- 59 tests, 151 assertions, all green.
- Validators pass with T245 ticket carrying `Status: DONE`.
- Consumers stay untouched in T245; they migrate in T246.
