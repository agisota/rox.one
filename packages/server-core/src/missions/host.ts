/**
 * Mission store composition root — M.8 T244b.
 *
 * T241 introduced the `MissionStore` interface and the
 * `InMemoryMissionStore` reference implementation. T244-sqlite added
 * `SqliteMissionStore` on top of the T247 `bun:sqlite` adapter. This
 * factory is the seam that picks one or the other at host boot time:
 *
 *   - When `dbPath` is a non-empty string, open a `bun:sqlite` database
 *     at that path through `openSqliteAdapter`, apply every registered
 *     migration via `runMigrations`, and return a `SqliteMissionStore`
 *     bound to the resulting handle. The returned `dispose()` closes
 *     the underlying database.
 *   - When `dbPath` is falsy (undefined / empty string), return an
 *     `InMemoryMissionStore`. `dispose()` is a no-op in that mode.
 *
 * The factory exposes its dependencies (`open`, `migrate`) as injection
 * points so the host test suite can drive both code paths without ever
 * touching the real filesystem. The default wiring is the production
 * one: `openSqliteAdapter` + `runMigrations` from the T247 adapter.
 *
 * Callers own the returned handle's lifecycle — wire `dispose()` into
 * the existing host shutdown hooks so the database is closed on SIGTERM.
 */

import { Database } from 'bun:sqlite'

import { openSqliteAdapter, type SqliteHandle } from '../persistence/sqlite/connection.ts'
import { runMigrations, type RunMigrationsResult } from '../persistence/sqlite/migrations.ts'
import {
  InMemoryMissionStore,
  type MissionStore,
} from './mission-store.ts'
import {
  SqliteMissionStore,
  type SqliteMissionStoreOptions,
} from './sqlite-mission-store.ts'

/** Backend selected by the factory — exposed for telemetry / log lines. */
export type MissionStoreBackend = 'in-memory' | 'sqlite'

export interface CreateMissionStoreOptions {
  /**
   * Filesystem path for the sqlite database, or ':memory:' for an
   * ephemeral in-process db. Falsy values (undefined, '') select the
   * in-memory store. Wire this from `process.env.ROX_DB_PATH`.
   */
  readonly dbPath?: string | undefined
  /**
   * Clock override forwarded to `SqliteMissionStore.now`. ISO-8601 UTC.
   * Ignored when the in-memory backend is selected.
   */
  readonly now?: SqliteMissionStoreOptions['now']
  /**
   * Open a sqlite handle for the given path. Defaults to
   * `openSqliteAdapter` from the T247 connection module. Tests inject a
   * stub here to avoid touching the filesystem.
   */
  readonly open?: (path: string) => SqliteHandle
  /**
   * Apply pending migrations against an already-opened handle. Defaults
   * to `runMigrations`. Tests inject a spy to assert that migrations
   * ran before any read/write.
   */
  readonly migrate?: (db: Database) => RunMigrationsResult
}

export interface MissionStoreHandle {
  /** The store the rest of the host code path consumes. */
  readonly store: MissionStore
  /** Which backend was selected — useful for boot-log telemetry. */
  readonly backend: MissionStoreBackend
  /** Resolved sqlite path, or `undefined` for the in-memory backend. */
  readonly dbPath: string | undefined
  /**
   * Release any underlying resources. For sqlite this closes the
   * database; for in-memory it is a no-op. Safe to call repeatedly.
   */
  dispose(): void
}

/**
 * Pick the right `MissionStore` implementation for the host. Pure
 * factory — never reads `process.env` itself, the caller passes the
 * resolved `dbPath` in. That keeps this module testable and lets the
 * env-var contract live next to the host bootstrap.
 */
export function createMissionStore(
  options: CreateMissionStoreOptions = {},
): MissionStoreHandle {
  const { dbPath, now, open = openSqliteAdapter1, migrate = runMigrations } = options

  if (!dbPath) {
    return {
      store: new InMemoryMissionStore(),
      backend: 'in-memory',
      dbPath: undefined,
      dispose: () => {},
    }
  }

  const handle = open(dbPath)
  // Apply 0001 + 0002 (and any future migrations) before the first
  // read/write so the store never observes a half-built schema.
  migrate(handle.db)
  const store = new SqliteMissionStore(handle.db, now ? { now } : {})

  let disposed = false
  return {
    store,
    backend: 'sqlite',
    dbPath: handle.path,
    dispose: () => {
      if (disposed) return
      disposed = true
      handle.close()
    },
  }
}

/** Adapter for the default open function so the option signature is a
 * plain `(path) => SqliteHandle` even though `openSqliteAdapter` takes
 * an options object. Keeping it inline avoids leaking the option shape
 * into the public factory contract. */
function openSqliteAdapter1(path: string): SqliteHandle {
  return openSqliteAdapter({ path })
}
