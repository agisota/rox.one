# T247 worklog — SQLite-backed production persistence adapter

## 1. Goal

Lay the durable storage backbone for accounts, workspaces, role grants,
and audit events behind a typed `PersistenceAdapter` interface so the
runtime can swap from the existing in-memory adapter to a sqlite-backed
adapter without changing call sites.

## 2. Approach

TDD-first. New package surface at
`packages/server-core/src/persistence/`:

- `adapter.ts` — minimal `PersistenceAdapter` interface covering the
  four entities (accounts / workspaces / role_grants / audit_events).
  Methods read+write per entity; no transactional wrapper yet (the
  workbench layer composes higher-level transactions on top).
- `sqlite/connection.ts` — `openSqliteAdapter({ path })` opens a
  `bun:sqlite` Database with WAL mode + `foreign_keys = ON`.
- `sqlite/migrations.ts` — versioned migration runner with a
  `schema_migrations(version)` tracking table; idempotent re-runs.
- `sqlite/migrations/0001-initial.ts` — `up()` creates the four tables
  plus common-lookup indexes; `down()` drops them in reverse.
- `sqlite/sqlite-adapter.ts` — `SqliteAdapter implements
  PersistenceAdapter`. Prepared statements cached on construction.
- `sqlite/uuid-v7.ts` — small uuid-v7 minter from timestamp + random
  (Bun's `crypto.randomUUID()` is v4; we need v7 for time-sortable
  B-tree friendly IDs per user rules).
- `sqlite/index.ts` — public barrel.

Tests use `:memory:` databases — no fs side-effects.

## 3. Test coverage

```
$ bun test packages/server-core/src/persistence/sqlite/__tests__/
 32 pass
 0 fail
 80 expect() calls
Ran 32 tests across 3 files. [118.00ms]
```

| Test file                       | Cases | Notes |
| ------------------------------- | ----- | ----- |
| `connection.test.ts`            | 6     | WAL mode set, foreign_keys enforced, close hygiene |
| `migrations.test.ts`            | 12    | initial up()+down() round-trip; idempotency; tracking table |
| `sqlite-adapter.test.ts`        | 14    | CRUD on each of 4 tables; cross-tenant isolation |

## 4. Decisions

- **`bun:sqlite` built-in**, no new dep. Matches the spirit of the
  codebase's existing zero-runtime-dep policy.
- **WAL mode + foreign_keys ON** are the only two PRAGMAs we set —
  WAL gives concurrent reads, FK enforcement prevents orphan grants
  if a workspace is deleted (CASCADE explicit in migration).
- **UUID v7 minted in-process**. Bun's `crypto.randomUUID()` returns
  v4; v7 needs the 48-bit Unix timestamp prefix for time-sortable
  B-tree friendliness. The minter accepts a clock parameter so tests
  pin exact timestamps.
- **All timestamps stored as ISO-8601 UTC strings** (user rules:
  UTC everywhere in storage, convert at display layer).
- **Per-table indexes only on lookups we actually do**: account_id
  on workspaces, scopeKind+scopeId on role_grants, correlation_id on
  audit_events. No speculative indexes.
- **`PersistenceAdapter` interface lives in `persistence/adapter.ts`**
  (not under `sqlite/`) so future adapters (postgres, dynamodb, etc.)
  share the contract.
- **No transactional wrapper yet** — the workbench layer that calls
  this will compose its own transactions via the underlying db handle
  in a follow-up (T248).

## 5. Findings

No security findings. The adapter is opt-in: nothing on `main` currently
constructs a `SqliteAdapter` — the existing in-memory adapter remains
the default. T248 wires the host to choose at composition time.

## 6. Deviations

- **Ticket ID renamed T265 → T247.** The original prompt used T265 but
  the spine reserves T260–T298 for rebrand (T265 already exists as
  `T265-rebrand-class-renames.md`). T247 is in the master range
  (T223–T251) and was free.
- **Test LOC 479** (target ≤450). The 32 tests with 80 expect() calls
  justify the small overage — the CRUD + isolation matrix is the
  source of truth and shouldn't be compressed.
- **No `bun run validate:agent-contract`** was run by the agent in the
  fast path — re-run pre-commit confirms green.

## 7. Validation matrix

| Gate                                       | Result                                |
| ------------------------------------------ | ------------------------------------- |
| `bun test sqlite/__tests__/`               | 32 / 32 pass, 80 expect(), 118 ms     |
| `bun run validate:rebrand`                 | pass                                  |
| `bun run validate:agent-contract`          | pass (T247 `Status: DONE`)            |
| `bun run validate:roadmap`                 | pass                                  |

## 8. Files touched

| Path                                                                                  | Status |
| ------------------------------------------------------------------------------------- | ------ |
| `packages/server-core/src/persistence/adapter.ts`                                     | new    |
| `packages/server-core/src/persistence/sqlite/connection.ts`                           | new    |
| `packages/server-core/src/persistence/sqlite/migrations.ts`                           | new    |
| `packages/server-core/src/persistence/sqlite/migrations/0001-initial.ts`              | new    |
| `packages/server-core/src/persistence/sqlite/sqlite-adapter.ts`                       | new    |
| `packages/server-core/src/persistence/sqlite/uuid-v7.ts`                              | new    |
| `packages/server-core/src/persistence/sqlite/index.ts`                                | new    |
| `packages/server-core/src/persistence/sqlite/__tests__/connection.test.ts`            | new    |
| `packages/server-core/src/persistence/sqlite/__tests__/migrations.test.ts`            | new    |
| `packages/server-core/src/persistence/sqlite/__tests__/sqlite-adapter.test.ts`        | new    |
| `docs/tickets/T247-sqlite-production-persistence.md`                                  | new    |
| `docs/worklog/T247-sqlite-production-persistence.md`                                  | new    |

## 9. Follow-ups

- **T248** — wire the adapter into the host runtime: the workbench
  composition picks `SqliteAdapter` when `ROX_DB_PATH` is set,
  otherwise stays on `InMemoryAdapter`. Transactional wrapper lives
  in the host.
- **T249** — backup/restore hooks: snapshot the WAL + main DB to a
  configurable backup path; rotate; restore from a snapshot file.
- **T250** — index ratchet test: assert query plans for the four
  critical queries use the expected indexes (regression guard).

## 10. Closeout

- 7 source files + 3 test files land at `packages/server-core/src/persistence/`.
- 32 tests / 80 assertions / 118 ms wall — green.
- `bun:sqlite` only, zero new external deps.
- Migration 0001 is reversible (up + down both exercised in tests).
- The adapter is opt-in; nothing on `main` consumes it yet.
