# T244-sqlite — Durable `MissionStore` over `bun:sqlite`

Status: DONE
Phase: M.8

## Context

T241 (PR #88, merged) introduced the `MissionStore` interface and the
`InMemoryMissionStore` reference implementation under
`packages/server-core/src/missions/`. T247 (PR #94, merged) shipped a
production-grade sqlite adapter under
`packages/server-core/src/persistence/sqlite/`, complete with WAL,
foreign-key enforcement, a versioned migration runner, and the
`schema_migrations` ledger.

T244-sqlite is the bridge: a `SqliteMissionStore` that implements the
`MissionStore` contract against a `bun:sqlite` database. With this
ticket landed, the mission scheduler can persist to disk instead of
holding state in a `Map`, which is the prerequisite for crash recovery
in T245-host (server wiring) and downstream RBAC/audit work.

Ticket id `T244` is already taken by the RBAC schema-reservation ticket
(`docs/tickets/T244-schema-reservation-asterisk.md`). This work is
filed under the `T244-sqlite` suffix to disambiguate without renumbering
the roadmap.

## Goal

Add `SqliteMissionStore` and the underlying `missions` table:

- `packages/server-core/src/missions/sqlite-mission-store.ts` —
  `SqliteMissionStore implements MissionStore` over a caller-owned
  `Database` handle.
- `packages/server-core/src/persistence/sqlite/migrations/0002-missions.ts`
  — adds the `missions(id, state_kind, state_payload_json, created_at,
  updated_at)` table with indexes on `state_kind` and `updated_at`.
- Re-export `SqliteMissionStore` from `packages/server-core/src/missions/index.ts`.
- ≥25 `expect()` calls in `__tests__/sqlite-mission-store.test.ts`.

## Required UI

None — this is a storage seam, identical surface area to T241's
in-memory store.

## Required Data/API

New table from migration 0002-missions:

- `missions(id TEXT PRIMARY KEY, state_kind TEXT NOT NULL,
  state_payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL)`

Indexes:

- `idx_missions_state_kind` — for `list({ kinds })` probes.
- `idx_missions_updated_at` — for newest-first scans and audit replays.

## Required Automations

None at this layer. T245-host wires the store into the server
bootstrap so the scheduler can pick it up from configuration.

## TDD Requirements

Tests live in `__tests__/sqlite-mission-store.test.ts` and cover:

1. **CRUD basics** — `get`/`put`/`delete`/`list` against `:memory:` DBs.
2. **State-payload round-trip** — every `MissionState` variant
   (`Pending`, `Running`, `Paused`, `Awaiting`, `Completed`, `Failed`,
   `Cancelled`); payloads with JSON-unsafe characters, unicode, emoji.
3. **List filters** — single kind, multi-kind, empty kinds tuple,
   unknown kind (validated, throws).
4. **Corruption guards** — invalid `state_kind` and malformed JSON
   throw with a clear message instead of silent failure.
5. **Clock injection** — `created_at` preserved across `put`s,
   `updated_at` rewritten from the injected clock.
6. **Isolation** — two `:memory:` databases stay independent; a fresh
   store instance against the same handle sees the same rows; list
   snapshots are independent of subsequent mutations.

Confirm ≥25 `expect()` calls before considering the ticket green.
Final tally: **22 tests / 57 expect() calls**.

## Implementation Requirements

- Use prepared statements only — no string interpolation of mission
  payloads. (The lone exception is the dynamic `IN (?, ?, ...)` clause
  in `list`, which builds positional placeholders from the kind count;
  the kinds themselves are bound as parameters and pre-validated.)
- `state_payload_json` must be a JSON object decoded back to the exact
  state shape. Reject arrays, primitives, and malformed text.
- All timestamps are ISO-8601 UTC strings — the data-integrity rule.
- No `any` in source. Strict generics on row shapes.
- Caller owns the `Database` handle's lifecycle — the store does not
  open or close it. This matches the `SqliteAdapter` pattern and keeps
  multi-store hosting straightforward.
- No new external dependency.

## Validation Commands

- `bun test packages/server-core/src/missions/__tests__/sqlite-mission-store.test.ts`
- `bun test packages/server-core/src/persistence/sqlite/__tests__/`
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `cd packages/server-core && bun run tsc --noEmit`

## Acceptance Criteria

- [x] `SqliteMissionStore` implements every method on `MissionStore`.
- [x] Migration 0002-missions creates the `missions` table with indexes
      and a working `down()` that drops it.
- [x] Migration is registered in `ALL_MIGRATIONS` and re-exported from
      the sqlite barrel.
- [x] Existing migration runner tests stay green (no pin to head==1).
- [x] `SqliteMissionStore` re-exported from
      `packages/server-core/src/missions/index.ts`.
- [x] ≥25 `expect()` calls in the new test file (delivered: 57).
- [x] Source ≤300 LOC, migration ≤100 LOC, tests ≤400 LOC.
- [x] `bun run tsc --noEmit` is green for `server-core`.

## Rollback Plan

- Application code: revert the `SqliteMissionStore` import and fall
  back to `InMemoryMissionStore`. The interfaces are identical.
- Schema: run `rollback(db, 1)` against the sqlite handle — the
  migration runner reverses migration 0002 by dropping the `missions`
  table and removing the ledger row.

## Worklog

Update `docs/worklog/T244-sqlite-mission-store.md`.
