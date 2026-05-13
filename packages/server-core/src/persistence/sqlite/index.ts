/**
 * Public surface of the M.6 sqlite persistence adapter.
 *
 * The persistence barrel (`packages/server-core/src/persistence/index.ts`)
 * intentionally does NOT re-export this — wiring is opt-in until T266
 * lands the handler integration, so consumers that still use the in-memory
 * adapter remain undisturbed.
 */

export { openSqliteAdapter, readPragma } from './connection'
export type { OpenSqliteAdapterOptions, SqliteHandle } from './connection'

export {
  runMigrations,
  rollback,
  currentMigrationVersion,
  readMigrationLedger,
  ALL_MIGRATIONS,
} from './migrations'
export type {
  SqliteMigration,
  MigrationLedgerRow,
  RunMigrationsResult,
  RollbackResult,
} from './migrations'

export { SqliteAdapter } from './sqlite-adapter'
export type { CreateSqliteAdapterOptions } from './sqlite-adapter'

export { uuidV7, uuidV7TimestampMs } from './uuid-v7'

export { migration0001Initial } from './migrations/0001-initial'
