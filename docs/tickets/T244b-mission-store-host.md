# T244b — `MissionStore` host factory (`ROX_DB_PATH` → sqlite | in-memory)

Status: DONE
Phase: M.8

## Context

T241 (PR #88) introduced the `MissionStore` interface and the
`InMemoryMissionStore` reference implementation. T244-sqlite (PR #131)
added `SqliteMissionStore` on top of the T247 `bun:sqlite` adapter.
Neither ticket wired a chooser — every test constructed the store
directly and the host bootstrap still defaulted to a `Map`.

T244b is the composition root: a `createMissionStore({ dbPath })`
factory that picks the sqlite backend when `ROX_DB_PATH` is set and
falls back to the in-memory backend otherwise. T244c (renderer
wiring, separate ticket) will plug the factory into the existing host
bootstrap so the scheduler reaches durable storage end-to-end.

## Goal

Add the chooser without touching the frozen T241 / T244-sqlite / T246
modules:

- `packages/server-core/src/missions/host.ts` — new
  `createMissionStore` factory + the `MissionStoreHandle` /
  `MissionStoreBackend` types it returns.
- `packages/server-core/src/missions/__tests__/host.test.ts` — bun:test
  with ≥10 `expect()` calls covering both branches.
- Extend the missions barrel (`index.ts`) to re-export the factory.

## Required UI

None — this is a server-side composition root.

## Required Data/API

No new endpoints, no new tables. The factory reuses migration 0001
(`schema_migrations` ledger) and migration 0002 (`missions` table) from
T247 / T244-sqlite via `runMigrations`.

## Required Automations

None at this layer. T244c wires the factory into the host bootstrap so
the scheduler is built against a durable store when `ROX_DB_PATH` is
present.

## TDD Requirements

`__tests__/host.test.ts` covers:

1. **In-memory branch** — falsy `dbPath` (undefined, '') returns an
   `InMemoryMissionStore`; no `open`/`migrate` hook is invoked; the
   structural `MissionStore` contract holds.
2. **Sqlite branch** — `':memory:'` returns a `SqliteMissionStore`;
   the missions table is queryable after construction, i.e. migrations
   ran; the injected clock is forwarded; two separate handles stay
   isolated.
3. **Dependency injection** — custom `open` / `migrate` hooks are
   invoked exactly once and in the right order; `dbPath` on the
   returned handle echoes the opened path, not the input string.
4. **Lifecycle** — `dispose()` is idempotent for both backends and
   closes the sqlite handle exactly once; `open()` failures bubble up
   without leaking partial state.

Final tally: **13 tests / 40 expect() calls**.

## Implementation Requirements

- Pure factory — no `process.env` reads. The caller passes the
  resolved `dbPath` in.
- Reuse `openSqliteAdapter` (T247) and `runMigrations` (T247) for the
  sqlite branch. Do not duplicate connection or migration logic.
- Do not modify `mission-store.ts`, `sqlite-mission-store.ts`, or
  `scheduler.ts` — those modules are frozen.
- Inject `open` + `migrate` hooks so tests never touch the filesystem.
- No new external dependency.
- Source ≤200 LOC, tests ≤250 LOC.
- No `any`; `tsc --noEmit` clean.

## Validation Commands

- `bun test packages/server-core/src/missions/__tests__/host.test.ts`
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `cd packages/server-core && bun run tsc --noEmit`

## Acceptance Criteria

- [x] `createMissionStore` returns an `InMemoryMissionStore` when
      `dbPath` is falsy.
- [x] `createMissionStore` returns a `SqliteMissionStore` bound to a
      migrated `bun:sqlite` handle when `dbPath` is set.
- [x] `dispose()` closes the sqlite handle exactly once and is a
      safe no-op for the in-memory backend.
- [x] Injection points (`open`, `migrate`) let tests cover both
      branches without filesystem side-effects.
- [x] ≥10 `expect()` calls in `__tests__/host.test.ts` (delivered: 40).
- [x] Source ≤200 LOC (delivered: 127), tests ≤250 LOC (delivered: 232).
- [x] `bun run tsc --noEmit` is green for `server-core`.

## Rollback Plan

- Revert the import of `createMissionStore` in the T244c host
  bootstrap (separate ticket) and keep building `InMemoryMissionStore`
  directly. The factory module is otherwise inert — removing it does
  not require any schema rollback because no migration ran.
- If the factory has already been deployed and a sqlite file exists,
  use `rollback(db, 1)` from `persistence/sqlite/migrations.ts` to
  reverse migration 0002 (drops the `missions` table).

## Worklog

See `docs/worklog/T244b-mission-store-host.md`.
