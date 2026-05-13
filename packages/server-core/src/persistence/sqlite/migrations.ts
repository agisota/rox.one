/**
 * Versioned migration runner for the M.6 sqlite persistence adapter.
 *
 * Contract:
 *   - Each migration is a self-contained object with numeric `version`, a
 *     human-readable `name`, and `up()` / `down()` functions.
 *   - `runMigrations(db, migrations?)` applies every migration whose
 *     version is strictly greater than the current head, in ascending
 *     order, inside a single transaction per migration. The version row
 *     is inserted as part of the same transaction so partial application
 *     is impossible.
 *   - `rollback(db, migrations?, toVersion)` runs `down()` in descending
 *     order for every applied migration with `version > toVersion`. Each
 *     rollback is inside its own transaction.
 *
 * The `schema_migrations` ledger lives outside the application schema
 * and is created lazily on the first run.
 */

import { Database } from 'bun:sqlite'
import { migration0001Initial } from './migrations/0001-initial'
import { migration0002Missions } from './migrations/0002-missions'

export interface SqliteMigration {
  readonly version: number
  readonly name: string
  up(db: Database): void
  down(db: Database): void
}

export interface MigrationLedgerRow {
  version: number
  name: string
  appliedAtMs: number
}

const LEDGER_TABLE = 'schema_migrations'

function ensureLedger(db: Database): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at_ms INTEGER NOT NULL
    );`,
  )
}

export function readMigrationLedger(db: Database): readonly MigrationLedgerRow[] {
  ensureLedger(db)
  const rows = db
    .query(`SELECT version, name, applied_at_ms FROM ${LEDGER_TABLE} ORDER BY version ASC;`)
    .all() as Array<{ version: number; name: string; applied_at_ms: number }>
  return rows.map((r) => ({ version: r.version, name: r.name, appliedAtMs: r.applied_at_ms }))
}

export function currentMigrationVersion(db: Database): number {
  ensureLedger(db)
  const row = db
    .query(`SELECT MAX(version) AS v FROM ${LEDGER_TABLE};`)
    .get() as { v: number | null } | null
  if (!row || row.v == null) return 0
  return row.v
}

export const ALL_MIGRATIONS: readonly SqliteMigration[] = [
  migration0001Initial,
  migration0002Missions,
]

function assertContiguousVersions(migrations: readonly SqliteMigration[]): void {
  const seen = new Set<number>()
  for (const m of migrations) {
    if (!Number.isInteger(m.version) || m.version <= 0) {
      throw new Error(`migration version must be a positive integer (got ${m.version} for ${m.name})`)
    }
    if (seen.has(m.version)) {
      throw new Error(`duplicate migration version ${m.version} (${m.name})`)
    }
    seen.add(m.version)
  }
}

export interface RunMigrationsResult {
  applied: readonly { version: number; name: string }[]
  head: number
}

export function runMigrations(
  db: Database,
  migrations: readonly SqliteMigration[] = ALL_MIGRATIONS,
): RunMigrationsResult {
  assertContiguousVersions(migrations)
  ensureLedger(db)

  const sorted = [...migrations].sort((a, b) => a.version - b.version)
  const head = currentMigrationVersion(db)
  const applied: { version: number; name: string }[] = []

  for (const m of sorted) {
    if (m.version <= head) continue
    db.transaction(() => {
      m.up(db)
      db.run(
        `INSERT INTO ${LEDGER_TABLE} (version, name, applied_at_ms) VALUES (?, ?, ?);`,
        [m.version, m.name, Date.now()],
      )
    })()
    applied.push({ version: m.version, name: m.name })
  }

  return { applied, head: currentMigrationVersion(db) }
}

export interface RollbackResult {
  reverted: readonly { version: number; name: string }[]
  head: number
}

export function rollback(
  db: Database,
  toVersion: number,
  migrations: readonly SqliteMigration[] = ALL_MIGRATIONS,
): RollbackResult {
  if (!Number.isInteger(toVersion) || toVersion < 0) {
    throw new Error(`rollback target must be a non-negative integer (got ${toVersion})`)
  }
  assertContiguousVersions(migrations)
  ensureLedger(db)

  const sortedDesc = [...migrations].sort((a, b) => b.version - a.version)
  const head = currentMigrationVersion(db)
  const reverted: { version: number; name: string }[] = []

  for (const m of sortedDesc) {
    if (m.version > head) continue
    if (m.version <= toVersion) break
    db.transaction(() => {
      m.down(db)
      db.run(`DELETE FROM ${LEDGER_TABLE} WHERE version = ?;`, [m.version])
    })()
    reverted.push({ version: m.version, name: m.name })
  }

  return { reverted, head: currentMigrationVersion(db) }
}
