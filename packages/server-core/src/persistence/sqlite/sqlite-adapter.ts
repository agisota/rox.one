/**
 * `SqliteAdapter` — implementation of `PersistenceAdapter` backed by
 * `bun:sqlite`.
 *
 * - All writes use prepared statements (no string interpolation).
 * - `appendAuditEvent` serializes `payload` to JSON.
 * - Read APIs return frozen rows so callers cannot mutate the cache.
 *
 * The adapter is async-facade over sync sqlite calls; this keeps the
 * `PersistenceAdapter` interface portable to async drivers (Postgres,
 * libsql) without forcing every consumer to be sync.
 */

import { Database } from 'bun:sqlite'
import { openSqliteAdapter, type SqliteHandle } from './connection'
import { runMigrations, type RunMigrationsResult, ALL_MIGRATIONS } from './migrations'
import type {
  AccountRow,
  AuditEventRow,
  PersistenceAdapter,
  RoleGrantRow,
  ScopeKind,
  Uuid,
  WorkspaceRow,
} from '../adapter'

export interface CreateSqliteAdapterOptions {
  path: string
  /** Run migrations on open (default: true). */
  runMigrationsOnOpen?: boolean
  /** Disable WAL — only useful for in-memory tests. */
  disableWal?: boolean
}

const VALID_SCOPE_KINDS: ReadonlySet<ScopeKind> = new Set([
  'account',
  'workspace',
  'team',
  'global',
])

function assertScopeKind(value: string): asserts value is ScopeKind {
  if (!VALID_SCOPE_KINDS.has(value as ScopeKind)) {
    throw new Error(`SqliteAdapter: invalid scope_kind '${value}'`)
  }
}

function freeze<T>(value: T): T {
  return Object.freeze(value) as T
}

interface AccountDbRow {
  id: string
  email: string
  created_at: string
}

interface WorkspaceDbRow {
  id: string
  account_id: string
  name: string
  created_at: string
}

interface RoleGrantDbRow {
  id: string
  actor_id: string
  role_id: string
  scope_kind: string
  scope_id: string | null
  created_at: string
}

export class SqliteAdapter implements PersistenceAdapter {
  private readonly handle: SqliteHandle
  private readonly migrationResult: RunMigrationsResult
  private closed = false

  constructor(handle: SqliteHandle, migrationResult: RunMigrationsResult) {
    this.handle = handle
    this.migrationResult = migrationResult
  }

  static open(options: CreateSqliteAdapterOptions): SqliteAdapter {
    const handle = openSqliteAdapter({
      path: options.path,
      disableWal: options.disableWal,
    })
    const migrationResult =
      options.runMigrationsOnOpen === false
        ? { applied: [], head: 0 }
        : runMigrations(handle.db, ALL_MIGRATIONS)
    return new SqliteAdapter(handle, migrationResult)
  }

  get db(): Database {
    return this.handle.db
  }

  get path(): string {
    return this.handle.path
  }

  get appliedMigrations(): RunMigrationsResult {
    return this.migrationResult
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('SqliteAdapter: database is closed')
    }
  }

  async getAccount(id: Uuid): Promise<AccountRow | null> {
    this.assertOpen()
    const row = this.handle.db
      .query('SELECT id, email, created_at FROM accounts WHERE id = ?;')
      .get(id) as AccountDbRow | null
    if (!row) return null
    return freeze({ id: row.id, email: row.email, createdAt: row.created_at })
  }

  async putAccount(row: AccountRow): Promise<void> {
    this.assertOpen()
    this.handle.db.run(
      `INSERT INTO accounts (id, email, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         created_at = excluded.created_at;`,
      [row.id, row.email, row.createdAt],
    )
  }

  async listWorkspaces(accountId: Uuid): Promise<readonly WorkspaceRow[]> {
    this.assertOpen()
    const rows = this.handle.db
      .query(
        `SELECT id, account_id, name, created_at
         FROM workspaces
         WHERE account_id = ?
         ORDER BY created_at ASC, id ASC;`,
      )
      .all(accountId) as WorkspaceDbRow[]
    return Object.freeze(
      rows.map((r) =>
        freeze({
          id: r.id,
          accountId: r.account_id,
          name: r.name,
          createdAt: r.created_at,
        }),
      ),
    )
  }

  async putWorkspace(row: WorkspaceRow): Promise<void> {
    this.assertOpen()
    this.handle.db.run(
      `INSERT INTO workspaces (id, account_id, name, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         account_id = excluded.account_id,
         name = excluded.name,
         created_at = excluded.created_at;`,
      [row.id, row.accountId, row.name, row.createdAt],
    )
  }

  async getGrants(actorId: Uuid): Promise<readonly RoleGrantRow[]> {
    this.assertOpen()
    const rows = this.handle.db
      .query(
        `SELECT id, actor_id, role_id, scope_kind, scope_id, created_at
         FROM role_grants
         WHERE actor_id = ?
         ORDER BY created_at ASC, id ASC;`,
      )
      .all(actorId) as RoleGrantDbRow[]
    return Object.freeze(
      rows.map((r) => {
        assertScopeKind(r.scope_kind)
        return freeze({
          id: r.id,
          actorId: r.actor_id,
          roleId: r.role_id,
          scopeKind: r.scope_kind,
          scopeId: r.scope_id,
          createdAt: r.created_at,
        })
      }),
    )
  }

  async putGrant(row: RoleGrantRow): Promise<void> {
    this.assertOpen()
    this.handle.db.run(
      `INSERT INTO role_grants (id, actor_id, role_id, scope_kind, scope_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         actor_id = excluded.actor_id,
         role_id = excluded.role_id,
         scope_kind = excluded.scope_kind,
         scope_id = excluded.scope_id,
         created_at = excluded.created_at;`,
      [row.id, row.actorId, row.roleId, row.scopeKind, row.scopeId, row.createdAt],
    )
  }

  async appendAuditEvent(row: AuditEventRow): Promise<void> {
    this.assertOpen()
    const payload = JSON.stringify(row.payload ?? {})
    this.handle.db.run(
      `INSERT INTO audit_events
        (id, kind, actor, subject, scope_kind, scope_id, timestamp_ms, correlation_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        row.id,
        row.kind,
        row.actor,
        row.subject,
        row.scopeKind,
        row.scopeId,
        row.timestampMs,
        row.correlationId,
        payload,
      ],
    )
  }

  async listAuditEvents(opts: { subject?: string; scopeKind?: ScopeKind; scopeId?: string | null; limit?: number }): Promise<readonly AuditEventRow[]> {
    this.assertOpen()
    const clauses: string[] = []
    const params: Array<string | null> = []
    if (opts.subject !== undefined) {
      clauses.push('subject = ?')
      params.push(opts.subject)
    }
    if (opts.scopeKind !== undefined) {
      clauses.push('scope_kind = ?')
      params.push(opts.scopeKind)
    }
    if (opts.scopeId !== undefined) {
      clauses.push('scope_id IS ?')
      params.push(opts.scopeId)
    }
    const where = clauses.length === 0 ? '' : ` WHERE ${clauses.join(' AND ')}`
    const limit = opts.limit != null && Number.isFinite(opts.limit) && opts.limit > 0
      ? ` LIMIT ${Math.floor(opts.limit)}`
      : ''
    const rows = this.handle.db
      .query(
        `SELECT id, kind, actor, subject, scope_kind, scope_id, timestamp_ms, correlation_id, payload_json
         FROM audit_events${where}
         ORDER BY timestamp_ms ASC, id ASC${limit};`,
      )
      .all(...params) as Array<{
        id: string
        kind: string
        actor: string
        subject: string
        scope_kind: string
        scope_id: string | null
        timestamp_ms: number
        correlation_id: string | null
        payload_json: string
      }>
    return Object.freeze(
      rows.map((r) => {
        assertScopeKind(r.scope_kind)
        const parsed: unknown = JSON.parse(r.payload_json)
        const payload =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : ({} as Record<string, unknown>)
        return freeze({
          id: r.id,
          kind: r.kind,
          actor: r.actor,
          subject: r.subject,
          scopeKind: r.scope_kind,
          scopeId: r.scope_id,
          timestampMs: r.timestamp_ms,
          correlationId: r.correlation_id,
          payload,
        })
      }),
    )
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.handle.close()
  }
}
