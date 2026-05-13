# T241 - Durable Mission Scheduler (state machine + InMemoryMissionStore)

Status: DONE

## Context

We are building a white-label fork of the upstream OSS into Agent Workbench Suite.

The repo already ships a domain-specific mission scheduler under
`packages/server-core/src/mission-scheduler/` that wires checkpoint execution
through the workbench persistence adapter (T066). M.8 needs a separate,
strictly pure foundation under `packages/server-core/src/missions/` that
later milestones can target without having to drag the entire workbench
mission run schema along — for example, the F.1 / Shiki-era refactors plan
a sqlite store (T242) and RPC handlers (T243) on top of this kernel.

## Goal

Land a small, pure mission state machine in `packages/server-core/src/missions/`
that:

1. Exposes a branded `MissionId` (uuid v7) with a structured parser.
2. Encodes every legal mission status as an exhaustive `MissionState` union
   covering `Pending`, `Running`, `Paused`, `Awaiting`, `Completed`, `Failed`,
   `Cancelled`.
3. Computes state transitions via a pure `transition(state, event)` returning
   `Result<MissionState, TransitionError>`. Illegal transitions surface
   typed errors (no exceptions).
4. Offers a `MissionScheduler` that orchestrates `create`, `dispatchEvent`,
   `get`, `list` over an injectable `MissionStore`.
5. Provides an in-memory reference `InMemoryMissionStore` backed by a plain
   `Map` for tests and dev runs.

The kernel performs no I/O, reads no global clock, and depends on no
external libraries beyond the standard runtime.

## Required UI

None.

## Required Data/API

- `MissionStore` interface (async): `get`, `put`, `delete`, `list(filter)`.
- `InMemoryMissionStore` reference implementation (sqlite/PG come later).

## Required Automations

- `bun test packages/server-core/src/missions/__tests__/` covers a full
  state x event truth table plus error paths and integration walks.

## Required Subagents

None — pure code module, owned by the executor.

## TDD Requirements

1. Tests authored first for all five source modules.
2. Truth-table test enumerates every `MissionState` x `MissionEvent` pair.
3. Each module's contract is covered by direct expects before any
   implementation lands.

## Implementation Requirements

- ≤600 LOC source, ~500 LOC tests.
- `satisfies` on the state-kind tuple guarantees exhaustiveness.
- No `any`, no external libs for the map.
- Clock and uuid generator injected; defaults pull from the runtime only.

## Validation Commands

- `bun test packages/server-core/src/missions/__tests__/`
- `bun run typecheck` (from `packages/server-core/`)
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`

## Acceptance Criteria

- [x] Pure transition function with truth-table coverage.
- [x] Branded `MissionId` with parser + `Result<MissionId, MissionIdError>`.
- [x] `MissionStore` interface with `InMemoryMissionStore` reference.
- [x] `MissionScheduler` orchestrates `create`, `dispatchEvent`, `get`, `list`.
- [x] ≥60 expect() calls across the test suite (actual: 231).
- [x] Tests pass with deterministic clock + uuid.
- [x] Typecheck clean.
- [x] Worklog complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T241-durable-mission-scheduler.md`
