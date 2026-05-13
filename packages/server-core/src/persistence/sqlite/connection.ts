/**
 * Open a `bun:sqlite` database configured for production use:
 *
 * - WAL journal mode (concurrent readers + single writer with no blocking).
 * - `foreign_keys = ON` (FK constraints are enforced).
 * - `synchronous = NORMAL` (durable on WAL while still fast).
 * - `busy_timeout = 5_000 ms` (avoid spurious SQLITE_BUSY under contention).
 *
 * `':memory:'` is accepted for in-process testing; WAL is silently skipped
 * for memory DBs since the mode is not supported there.
 *
 * `bun:sqlite` is built into the Bun runtime, so no new dependency is
 * required (the package matches the M.6 cost constraint).
 */

import { Database } from 'bun:sqlite'

export interface OpenSqliteAdapterOptions {
  /** Filesystem path, or ':memory:' for an ephemeral in-memory DB. */
  path: string
  /** Disable WAL — used by tests that need :memory: pragma compatibility. */
  disableWal?: boolean
  /** Override the SQLite busy timeout (ms). */
  busyTimeoutMs?: number
}

export interface SqliteHandle {
  readonly db: Database
  readonly path: string
  close(): void
}

const DEFAULT_BUSY_TIMEOUT_MS = 5_000

function runPragma(db: Database, sql: string): void {
  // Thin wrapper around the bun:sqlite raw-SQL API. Only fixed PRAGMA
  // strings constructed in this module are passed in — there is no user
  // input here.
  db.run(sql)
}

export function openSqliteAdapter(options: OpenSqliteAdapterOptions): SqliteHandle {
  const { path, disableWal = false, busyTimeoutMs = DEFAULT_BUSY_TIMEOUT_MS } = options

  if (!path || typeof path !== 'string') {
    throw new TypeError(
      `openSqliteAdapter: path must be a non-empty string (received ${typeof path})`,
    )
  }

  const db = new Database(path, { create: true })

  // `:memory:` does not support WAL — silently skip the pragma there.
  const wantsWal = !disableWal && path !== ':memory:'
  if (wantsWal) {
    runPragma(db, 'PRAGMA journal_mode = WAL;')
  }

  runPragma(db, 'PRAGMA foreign_keys = ON;')
  runPragma(db, 'PRAGMA synchronous = NORMAL;')
  const timeoutMs = Math.max(0, Math.floor(busyTimeoutMs))
  runPragma(db, `PRAGMA busy_timeout = ${timeoutMs};`)

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    db.close()
  }

  return { db, path, close }
}

/**
 * Read a single PRAGMA value as a string. Used by tests and the migration
 * runner to assert pragma state without bringing in another wrapper.
 */
export function readPragma(db: Database, name: string): string | null {
  const row = db.query(`PRAGMA ${name};`).get() as Record<string, unknown> | null
  if (!row) return null
  const first = Object.values(row)[0]
  return first == null ? null : String(first)
}
