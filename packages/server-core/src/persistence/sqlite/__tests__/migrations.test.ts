import { describe, expect, it } from 'bun:test'

import { openSqliteAdapter } from '../connection'
import {
  ALL_MIGRATIONS,
  currentMigrationVersion,
  readMigrationLedger,
  rollback,
  runMigrations,
  type SqliteMigration,
} from '../migrations'

function withMemoryDb<T>(fn: (db: import('bun:sqlite').Database) => T): T {
  const handle = openSqliteAdapter({ path: ':memory:' })
  try {
    return fn(handle.db)
  } finally {
    handle.close()
  }
}

describe('runMigrations', () => {
  it('applies the registered migrations from a fresh database and records ledger rows', () => {
    withMemoryDb((db) => {
      expect(currentMigrationVersion(db)).toBe(0)

      const result = runMigrations(db)
      expect(result.head).toBe(ALL_MIGRATIONS.length)
      expect(result.applied).toHaveLength(ALL_MIGRATIONS.length)
      expect(result.applied[0]?.version).toBe(1)
      expect(result.applied[0]?.name).toBe('0001-initial')

      const ledger = readMigrationLedger(db)
      expect(ledger).toHaveLength(ALL_MIGRATIONS.length)
      expect(ledger[0]?.version).toBe(1)
      expect(ledger[0]?.appliedAtMs).toBeGreaterThan(0)
    })
  })

  it('is idempotent — re-running does not re-apply migrations', () => {
    withMemoryDb((db) => {
      runMigrations(db)
      const second = runMigrations(db)
      expect(second.applied).toHaveLength(0)
      expect(second.head).toBe(ALL_MIGRATIONS.length)
      expect(readMigrationLedger(db)).toHaveLength(ALL_MIGRATIONS.length)
    })
  })

  it('round-trips up() then down() and leaves no application tables behind', () => {
    withMemoryDb((db) => {
      runMigrations(db)

      const tablesAfterUp = db
        .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;")
        .all() as Array<{ name: string }>
      const namesAfterUp = tablesAfterUp.map((r) => r.name)
      expect(namesAfterUp).toContain('accounts')
      expect(namesAfterUp).toContain('workspaces')
      expect(namesAfterUp).toContain('role_grants')
      expect(namesAfterUp).toContain('audit_events')

      const reverted = rollback(db, 0)
      expect(reverted.reverted).toHaveLength(ALL_MIGRATIONS.length)
      expect(reverted.head).toBe(0)

      const tablesAfterDown = db
        .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;")
        .all() as Array<{ name: string }>
      const namesAfterDown = tablesAfterDown.map((r) => r.name)
      expect(namesAfterDown).not.toContain('accounts')
      expect(namesAfterDown).not.toContain('workspaces')
      expect(namesAfterDown).not.toContain('role_grants')
      expect(namesAfterDown).not.toContain('audit_events')
      // The ledger table stays — only its rows are removed.
      expect(namesAfterDown).toContain('schema_migrations')
      expect(readMigrationLedger(db)).toHaveLength(0)
    })
  })

  it('rejects duplicate versions at runtime', () => {
    withMemoryDb((db) => {
      const bad: SqliteMigration[] = [
        { version: 1, name: 'a', up: () => undefined, down: () => undefined },
        { version: 1, name: 'b', up: () => undefined, down: () => undefined },
      ]
      expect(() => runMigrations(db, bad)).toThrow(/duplicate migration version/)
    })
  })

  it('rejects non-positive integer versions', () => {
    withMemoryDb((db) => {
      const bad: SqliteMigration[] = [
        { version: 0, name: 'zero', up: () => undefined, down: () => undefined },
      ]
      expect(() => runMigrations(db, bad)).toThrow(/positive integer/)
    })
  })

  it('rolls back only the migrations above the target version', () => {
    withMemoryDb((db) => {
      let upCount = 0
      let downCount = 0
      const headBefore = ALL_MIGRATIONS.reduce((m, x) => Math.max(m, x.version), 0)
      const syntheticVersion = headBefore + 1
      const extra: SqliteMigration = {
        version: syntheticVersion,
        name: `${String(syntheticVersion).padStart(4, '0')}-noop`,
        up: () => {
          upCount += 1
        },
        down: () => {
          downCount += 1
        },
      }
      const migrations = [...ALL_MIGRATIONS, extra]
      runMigrations(db, migrations)
      expect(upCount).toBe(1)
      expect(currentMigrationVersion(db)).toBe(syntheticVersion)

      const result = rollback(db, headBefore, migrations)
      expect(result.reverted).toHaveLength(1)
      expect(result.reverted[0]?.version).toBe(syntheticVersion)
      expect(result.head).toBe(headBefore)
      expect(downCount).toBe(1)
    })
  })

  it('rollback rejects negative targets', () => {
    withMemoryDb((db) => {
      runMigrations(db)
      expect(() => rollback(db, -1)).toThrow(/non-negative integer/)
    })
  })
})
