# T241 worklog — Durable mission scheduler (state machine + InMemoryMissionStore)

## 1. Goal

Build a pure, side-effect-free mission state machine at
`packages/server-core/src/missions/` plus a pluggable `MissionStore`
interface (with an in-memory reference implementation) so that
later milestones can layer a sqlite store (T242) and RPC handlers
(T243) without dragging in the upstream workbench mission run schema.

## 2. Approach

TDD-first. Six modules + an `index.ts` barrel:

- `mission-id.ts` — branded `MissionId` (uuid v7 shape) + parser
- `state.ts` — exhaustive `MissionState` union (`Pending`, `Running`,
  `Paused`, `Awaiting`, `Completed`, `Failed`, `Cancelled`) carrying
  metadata payloads for each variant
- `transitions.ts` — pure `transition(state, event)` returning
  `Result<MissionState, TransitionError>`. Events: `Start`, `Pause`,
  `Resume`, `AwaitInput`, `ProvideInput`, `Complete`, `Fail`, `Cancel`.
  Every illegal pair returns a typed error.
- `scheduler.ts` — `MissionScheduler` wraps a `MissionStore` and the
  transitions. Methods: `create`, `dispatchEvent`, `get`,
  `list(filter)`. No I/O of its own. Clock injected.
- `mission-store.ts` — `MissionStore` interface + `InMemoryMissionStore`
  reference implementation using a plain `Map<MissionId, Mission>`.

Tests colocated in `__tests__/`, one file per source module.

## 3. Truth-table coverage

The transitions test is the source of truth: every `(state, event)`
pair is asserted — most return a typed error, valid pairs return the
next state. This is what gives the 231-assertion count for an 80-case
suite.

```
$ bun test packages/server-core/src/missions/__tests__/
 80 pass
 0 fail
 231 expect() calls
Ran 80 tests across 5 files. [52.00ms]
```

Breakdown:

| Module           | Cases | Notes |
| ---------------- | ----- | ----- |
| mission-id       |  10   | branded parser + uuid v7 shape |
| state            |   8   | discriminated union, payload shape |
| transitions      |  32   | the truth-table itself |
| mission-store    |  12   | CRUD + isolation + filter |
| scheduler        |  18   | composition + clock injection |

## 4. Decisions

- **Pure transitions** — `transition(state, event)` is a function over
  data. No mutation. The scheduler is the only place that calls into
  the store.
- **Clock injection** — `MissionScheduler({ now: () => number })`.
  No `Date.now()` lives inside the modules; tests pass a deterministic
  clock and assert exact `timestampMs` values.
- **`Result<T, E>`** — the local `Result` helper in `transitions.ts`
  matches the policy-engine pattern; no shared types module yet.
- **`satisfies` on the state union** — exhaustiveness checking
  catches missing variants at compile time when the union grows.
- **`InMemoryMissionStore`** — backed by a plain `Map`. No library.
- **`MissionStore` interface** — read+mutate. Persistence-agnostic so
  T242 can drop a sqlite store in without renaming.

## 5. Validation matrix

| Gate                                  | Result                              |
| ------------------------------------- | ----------------------------------- |
| `bun test missions/__tests__/`        | 80 / 80 pass, 231 assertions, 52 ms |
| `bun run validate:rebrand`            | pass                                |
| `bun run validate:agent-contract`     | pass                                |
| `bun run validate:roadmap`            | pass                                |

## 6. Deviations

- Source LOC: 443 (target ≤600). Tests: 848 (target ~500 — exceeded
  because the `transitions` truth-table needs explicit assertions for
  every event × state pair; the `scheduler` test exercises the
  clock-injection contract in depth).
- The prompt asked for a `uuid v7` brand; the parser only validates
  the **shape** (length, hex segments). True v7 generation lands in
  T242 alongside the sqlite store (which needs the time-sorted prefix
  for B-tree friendliness). The brand discipline is identical so the
  swap is transparent.

## 7. Files touched

| Path                                                                          | Status |
| ----------------------------------------------------------------------------- | ------ |
| `packages/server-core/src/missions/mission-id.ts`                             | new    |
| `packages/server-core/src/missions/state.ts`                                  | new    |
| `packages/server-core/src/missions/transitions.ts`                            | new    |
| `packages/server-core/src/missions/scheduler.ts`                              | new    |
| `packages/server-core/src/missions/mission-store.ts`                          | new    |
| `packages/server-core/src/missions/index.ts`                                  | new    |
| `packages/server-core/src/missions/__tests__/mission-id.test.ts`              | new    |
| `packages/server-core/src/missions/__tests__/state.test.ts`                   | new    |
| `packages/server-core/src/missions/__tests__/transitions.test.ts`             | new    |
| `packages/server-core/src/missions/__tests__/scheduler.test.ts`               | new    |
| `packages/server-core/src/missions/__tests__/mission-store.test.ts`           | new    |
| `docs/tickets/T241-durable-mission-scheduler.md`                              | new    |
| `docs/worklog/T241-durable-mission-scheduler.md`                              | new    |

## 8. Follow-ups

- **T242** — sqlite-backed `MissionStore` (drop-in for the
  in-memory one). Adds true uuid v7 minting.
- **T243** — RPC handlers (`missions.{create, dispatch, get, list}`)
  composed on top of the scheduler. Owner-gated via the same
  `assertOwnerOnScope` helper as the RBAC handlers.
- **T244** — wire `AuditProducer.emit` (from T245) into the
  scheduler so start/complete/fail emit audit events.

## 9. Closeout

- Pure kernel lands at `packages/server-core/src/missions/`.
- 80 tests / 231 assertions / 52 ms wall — green.
- Validators pass with T241 ticket carrying `Status: DONE`.
- The kernel intentionally does NOT replace the existing
  `mission-scheduler/` adapter (which is workbench-specific). T242+
  decides whether the workbench layer migrates onto the new kernel
  or stays adjacent.
