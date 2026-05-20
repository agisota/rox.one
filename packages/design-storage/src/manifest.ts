/**
 * SQLite manifest for design artifacts.
 * Uses bun:sqlite for zero-dependency embedded storage.
 */
import type { Database as BunSqliteDatabase } from 'bun:sqlite'
import type { DesignArtifact } from '@rox-one/design-contract'

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS artifacts (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL,
  type          TEXT NOT NULL,
  uri           TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  thumbnail_uri TEXT
);

CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);

INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
`

interface ArtifactRow {
  id: string
  task_id: string
  type: string
  uri: string
  bytes: number
  sha256: string
  created_at: string
  thumbnail_uri: string | null
}

function rowToArtifact(row: ArtifactRow): DesignArtifact {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type as DesignArtifact['type'],
    uri: row.uri,
    bytes: row.bytes,
    sha256: row.sha256,
    createdAt: row.created_at,
    ...(row.thumbnail_uri != null ? { thumbnailUri: row.thumbnail_uri } : {}),
  }
}

function openDatabase(dbPath: string): BunSqliteDatabase {
  // Keep bun:sqlite out of Electron's esbuild graph; Bun resolves it at runtime
  // when tests or Bun-hosted tools actually open a manifest.
  const requireBunSqlite = (
    typeof require === 'function' ? require : import.meta.require
  ) as (specifier: 'bun:sqlite') => typeof import('bun:sqlite')
  const { Database } = requireBunSqlite('bun:sqlite')
  return new Database(dbPath, { create: true })
}

export class DesignManifest {
  private readonly db: BunSqliteDatabase

  constructor(dbPath: string) {
    this.db = openDatabase(dbPath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec(MIGRATION_V1)
  }

  close(): void {
    this.db.close()
  }

  /** Returns names of all tables — used in tests to verify migration. */
  listTables(): string[] {
    const rows = this.db
      .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
    return rows.map(r => r.name)
  }

  /** Returns the current schema version (highest applied version). */
  schemaVersion(): number {
    const row = this.db
      .query<{ version: number }, []>(`SELECT MAX(version) AS version FROM schema_migrations`)
      .get()
    return row?.version ?? 0
  }

  insert(artifact: DesignArtifact): void {
    this.db.run(
      `INSERT OR REPLACE INTO artifacts
         (id, task_id, type, uri, bytes, sha256, created_at, thumbnail_uri)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        artifact.id,
        artifact.taskId,
        artifact.type,
        artifact.uri,
        artifact.bytes,
        artifact.sha256,
        artifact.createdAt,
        artifact.thumbnailUri ?? null,
      ],
    )
  }

  findById(id: string): DesignArtifact | null {
    const row = this.db
      .query<ArtifactRow, [string]>(`SELECT * FROM artifacts WHERE id = ?`)
      .get(id)
    return row != null ? rowToArtifact(row) : null
  }

  listByTaskId(taskId: string): DesignArtifact[] {
    const rows = this.db
      .query<ArtifactRow, [string]>(`SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at`)
      .all(taskId)
    return rows.map(rowToArtifact)
  }
}
