# T244b worklog — `MissionStore` host factory

## 1. Goal

Bridge the T241 `MissionStore` interface, the T244-sqlite
`SqliteMissionStore`, and the T247 `bun:sqlite` adapter behind a single
factory function that the host bootstrap can call once at boot time.
The contract is "give me a `dbPath` (or don't) and I'll hand you back a
ready-to-use store + a `dispose()`".

## 2. Approach

One source file, one test file, one barrel touch:

1. **`missions/host.ts`** — exports `createMissionStore({ dbPath, now,
   open, migrate })`. When `dbPath` is truthy the factory calls
   `open(dbPath)` (default: `openSqliteAdapter` from T247), then
   `migrate(handle.db)` (default: `runMigrations`), then constructs
   `SqliteMissionStore` against the resulting handle. When `dbPath` is
   falsy it returns `InMemoryMissionStore` and a no-op `dispose()`.
   The `open` / `migrate` parameters are exposed for testability — the
   defaults are the production wiring.
2. **`missions/__tests__/host.test.ts`** — 13 tests / 40 expect()
   calls. Two test groups cover the two branches; a third group
   exercises injection, lifecycle, and error propagation.
3. **`missions/index.ts`** — re-exports `createMissionStore` and the
   three new types so the host bootstrap can import from the barrel.

## 3. Test coverage

```
$ bun test packages/server-core/src/missions/__tests__/host.test.ts
 13 pass
 0 fail
 40 expect() calls
Ran 13 tests across 1 file. [53.00ms]
```

| Group                       | Cases | Notes |
| --------------------------- | ----- | ----- |
| In-memory selection         |   5   | undefined / '' dbPath, dispose idempotency, hook non-invocation, round-trip |
| Sqlite selection            |   4   | `:memory:` returns SqliteMissionStore, migrations ran, clock forwarded, isolation |
| Injection + lifecycle       |   4   | custom open/migrate, dispose idempotency, ordering, open() failure propagation |

Wider mission suite stayed green:

```
$ bun test packages/server-core/src/missions/__tests__/
 125 pass
 0 fail
 352 expect() calls
Ran 125 tests across 8 files. [97.00ms]
```

## 4. Decisions

- **Factory does not read `process.env`.** The host bootstrap is the
  one place that translates `ROX_DB_PATH` into a `dbPath` string. The
  factory itself is pure so it can be unit-tested without env mutation
  and reused in environments where the env var lives elsewhere (CLI
  flag, config file, integration-test fixture).
- **Caller owns disposal.** `MissionStoreHandle` exposes `dispose()`
  rather than a `using`-style auto-close because the existing host
  shutdown machinery is sync-or-callback. `dispose()` is idempotent so
  a SIGTERM that fires the same hook twice is safe.
- **`dbPath` on the handle echoes the opened path, not the input.**
  For `:memory:` and absolute paths these match, but the convention is
  that the handle reflects what the database was actually opened with
  — anything else hides relative-path normalization bugs.
- **Injectable open + migrate.** The two defaults are the production
  wiring; tests pass stubs. This keeps the test suite filesystem-clean
  without leaking ad-hoc mocks into the module.
- **Migration runs before the store sees the handle.** The factory
  always calls `migrate(handle.db)` before constructing
  `SqliteMissionStore`, so the store never observes a half-built
  schema. The ordering is asserted explicitly in the test suite.

## 5. Constraints respected

- `mission-store.ts` (T241 frozen) — unchanged.
- `sqlite-mission-store.ts` (T244-sqlite frozen) — unchanged.
- `scheduler.ts` (T241/T246 frozen) — unchanged.
- `persistence/sqlite/connection.ts` / `migrations.ts` (T247 frozen) —
  unchanged, only consumed.
- `.swarm/master-roadmap-log.md` — untouched.
- No new external dependency.
- No `/tmp` writes, no `git worktree add`, no `bun install`.
- Source ≤200 LOC (127), tests ≤250 LOC (232).

## 6. Follow-up

- **T244c** wires `createMissionStore` into the renderer/host
  bootstrap, threading `process.env.ROX_DB_PATH` into the `dbPath`
  argument and registering `dispose()` with the shutdown hooks.
- **Backup/restore** for the missions file still falls under T267
  alongside accounts and audit.
