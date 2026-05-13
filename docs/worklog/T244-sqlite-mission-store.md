# T244-sqlite worklog — Durable `MissionStore` over `bun:sqlite`

## 1. Goal

Bridge the T241 `MissionStore` interface with the T247 sqlite adapter
so the mission scheduler can persist state across process restarts.
Concretely: a `SqliteMissionStore` that talks to a `missions` table
shaped to fit the existing `MissionState` discriminated union without
locking the schema into any single variant.

## 2. Approach

Three pieces, each in its own commit:

1. **Migration 0002-missions** under `persistence/sqlite/migrations/`.
   The table stores the state as a `(state_kind, state_payload_json)`
   pair, with indexes on the discriminator column and on `updated_at`.
   Registered in `ALL_MIGRATIONS` and re-exported from the sqlite
   barrel. The migration runner tests and one sqlite-adapter
   assertion were widened from "head must equal 1" to "head must equal
   ALL_MIGRATIONS.length" so future migrations don't have to rewrite
   the runner suite each time.

2. **`SqliteMissionStore`** under `missions/sqlite-mission-store.ts`.
   Takes an already-migrated `bun:sqlite` `Database` handle through
   the constructor — the store does not own the lifecycle, mirroring
   the `SqliteAdapter` pattern. All writes use prepared statements;
   the only dynamic SQL is the positional-placeholder `IN (?, ?, ...)`
   clause in `list`, and every kind is pre-validated against
   `MISSION_STATE_KINDS`.

3. **Ticket + worklog**. The ticket id `T244` is already taken by the
   RBAC schema-reservation ticket, so this work is filed under the
   `T244-sqlite` suffix per the instructions.

Tests use `:memory:` databases — no fs side-effects, no test fixtures.

## 3. Test coverage

```
$ bun test packages/server-core/src/missions/__tests__/sqlite-mission-store.test.ts
 22 pass
 0 fail
 57 expect() calls
Ran 22 tests across 1 file. [58.00ms]
```

| Section                          | Cases | Notes |
| -------------------------------- | ----- | ----- |
| CRUD                             | 9     | get / put / delete / list with filters |
| State payload round-trip         | 8     | every variant, unicode + emoji, JSON shape on disk, corruption guards |
| Durability + isolation           | 3     | two `:memory:` DBs, two stores on one handle, snapshot independence |

Full sweep (missions + persistence/sqlite):

```
$ bun test packages/server-core/src/missions/__tests__/ \
           packages/server-core/src/persistence/sqlite/__tests__/
 144 pass
 0 fail
 392 expect() calls
Ran 144 tests across 10 files. [149.00ms]
```

## 4. Decisions

- **Caller owns the handle.** The store takes an existing `Database`
  through the constructor rather than opening one itself. This mirrors
  the way `SqliteAdapter.open` separates resource ownership from row
  access, and it lets one process keep accounts, RBAC, audit, and
  missions on a single sqlite file without contention.
- **Discriminator-as-column.** `state_kind` lives in its own indexed
  column so `list({ kinds })` is a B-tree probe, not a JSON scan. The
  payload omits the `kind` field — there is one source of truth.
- **No re-export bloat.** Only `SqliteMissionStore` and
  `SqliteMissionStoreOptions` are added to the missions barrel; the
  `MissionRecord` / `MissionStore` types continue to come from the
  T241 interface module.
- **No schema lock-in.** Adding a new variant to `MissionState` is a
  one-file change in the encode/decode block — no migration needed.
  The schema's only commitment is "JSON object payload".
- **Clock injection.** The `now` option keeps `updated_at` testable
  and lets the future host wire in the same monotonic clock the
  scheduler already takes.

## 5. Constraints respected

- `mission-store.ts` (T241 frozen) — unchanged.
- `scheduler.ts` (T241/T246 frozen) — unchanged.
- `persistence/sqlite/sqlite-adapter.ts` (T247 frozen) — unchanged.
- `.swarm/master-roadmap-log.md` — untouched.
- No new external dependency.
- No `/tmp` writes, no `git worktree add`, no `bun install`.

## 6. Follow-up

- **T245-host** (separate ticket) wires `SqliteMissionStore` into the
  server bootstrap and routes the mission scheduler at it.
- **Backup/restore** for missions falls under T267 alongside accounts
  and audit; the table shape was deliberately kept simple so the
  existing JSON-export tooling applies without changes.
