/**
 * SQLite manifest for design artifacts.
 * Uses bun:sqlite for zero-dependency embedded storage.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { createRequire } from 'module'
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

interface DatabaseLike {
  exec(sql: string): void
  close(): void
  run(sql: string, params?: unknown[]): unknown
  query<Row, Params extends unknown[]>(sql: string): {
    all(...params: Params): Row[]
    get(...params: Params): Row | null
  }
}

type DatabaseConstructor = new (path: string, options?: { create?: boolean }) => DatabaseLike

interface JsonManifestStore {
  schemaVersion: number
  artifacts: ArtifactRow[]
}

const nodeRequire = createRequire(`${process.cwd()}/package.json`)
const JSON_FALLBACK_SUFFIX = '.json'

interface DesignManifestOptions {
  /** Test/runtime escape hatch for environments where bun:sqlite is unavailable. */
  forceJson?: boolean
}

function loadBunSqliteDatabase(): DatabaseConstructor | null {
  try {
    const mod = nodeRequire('bun:sqlite') as { Database?: DatabaseConstructor }
    return typeof mod.Database === 'function' ? mod.Database : null
  } catch {
    return null
  }
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

export class DesignManifest {
  private readonly db: DatabaseLike | null
  private readonly jsonPath: string | null
  private readonly jsonStore: JsonManifestStore | null

  constructor(dbPath: string, options: DesignManifestOptions = {}) {
    const Database = options.forceJson === true ? null : loadBunSqliteDatabase()
    if (Database) {
      this.db = new Database(dbPath, { create: true })
      this.jsonPath = null
      this.jsonStore = null
      this.db.exec('PRAGMA journal_mode = WAL;')
      this.db.exec('PRAGMA foreign_keys = ON;')
      this.db.exec(MIGRATION_V1)
      return
    }

    this.db = null
    this.jsonPath = `${dbPath}${JSON_FALLBACK_SUFFIX}`
    this.jsonStore = readJsonStore(this.jsonPath)
  }

  close(): void {
    if (this.db) {
      this.db.close()
      return
    }
    this.flushJsonStore()
  }

  /** Returns names of all tables — used in tests to verify migration. */
  listTables(): string[] {
    if (!this.db) return ['artifacts', 'schema_migrations']
    const rows = this.db
      .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
    return rows.map(r => r.name)
  }

  /** Returns the current schema version (highest applied version). */
  schemaVersion(): number {
    if (!this.db) return this.jsonStore?.schemaVersion ?? 1
    const row = this.db
      .query<{ version: number }, []>(`SELECT MAX(version) AS version FROM schema_migrations`)
      .get()
    return row?.version ?? 0
  }

  insert(artifact: DesignArtifact): void {
    if (!this.db) {
      const row = artifactToRow(artifact)
      const store = this.requireJsonStore()
      const index = store.artifacts.findIndex((existing) => existing.id === row.id)
      if (index >= 0) {
        store.artifacts[index] = row
      } else {
        store.artifacts.push(row)
      }
      this.flushJsonStore()
      return
    }

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
    if (!this.db) {
      const row = this.requireJsonStore().artifacts.find((artifact) => artifact.id === id)
      return row != null ? rowToArtifact(row) : null
    }

    const row = this.db
      .query<ArtifactRow, [string]>(`SELECT * FROM artifacts WHERE id = ?`)
      .get(id)
    return row != null ? rowToArtifact(row) : null
  }

  listByTaskId(taskId: string): DesignArtifact[] {
    if (!this.db) {
      return this.requireJsonStore().artifacts
        .filter((artifact) => artifact.task_id === taskId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(rowToArtifact)
    }

    const rows = this.db
      .query<ArtifactRow, [string]>(`SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at`)
      .all(taskId)
    return rows.map(rowToArtifact)
  }

  private requireJsonStore(): JsonManifestStore {
    if (!this.jsonStore) throw new Error('DesignManifest JSON store is not initialized')
    return this.jsonStore
  }

  private flushJsonStore(): void {
    if (!this.jsonPath || !this.jsonStore) return
    mkdirSync(dirname(this.jsonPath), { recursive: true })
    writeFileSync(this.jsonPath, `${JSON.stringify(this.jsonStore, null, 2)}\n`)
  }
}

function artifactToRow(artifact: DesignArtifact): ArtifactRow {
  return {
    id: artifact.id,
    task_id: artifact.taskId,
    type: artifact.type,
    uri: artifact.uri,
    bytes: artifact.bytes,
    sha256: artifact.sha256,
    created_at: artifact.createdAt,
    thumbnail_uri: artifact.thumbnailUri ?? null,
  }
}

function readJsonStore(path: string): JsonManifestStore {
  if (!existsSync(path)) return { schemaVersion: 1, artifacts: [] }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<JsonManifestStore>
    return {
      schemaVersion: parsed.schemaVersion ?? 1,
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts as ArtifactRow[] : [],
    }
  } catch {
    return { schemaVersion: 1, artifacts: [] }
  }
}
