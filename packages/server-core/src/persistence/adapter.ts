/**
 * Minimal `PersistenceAdapter` interface for the M.6 production persistence
 * lane.
 *
 * Scope of T247 is the storage seam — a generic, narrow contract that the
 * sqlite implementation can satisfy first and that future Postgres or
 * Cloud-SQL drivers can satisfy without breaking the consumer call sites.
 *
 * This contract is deliberately smaller than the in-memory
 * `AgentWorkbenchPersistenceAdapter` (which is the legacy session-store
 * facade). T266 will wire handlers against this surface; T267 will add
 * backup / restore.
 *
 * All timestamps are epoch milliseconds (UTC). IDs are UUID v7 strings.
 *
 * No money columns are exposed yet; when they land, the contract MUST take
 * integer cents (or a `Decimal`-shaped wrapper), never floats.
 */

export type Iso8601String = string
export type EpochMillis = number
export type Uuid = string

export interface AccountRow {
  id: Uuid
  email: string
  createdAt: Iso8601String
}

export interface WorkspaceRow {
  id: Uuid
  accountId: Uuid
  name: string
  createdAt: Iso8601String
}

export type ScopeKind = 'account' | 'workspace' | 'team' | 'global'

export interface RoleGrantRow {
  id: Uuid
  actorId: Uuid
  roleId: string
  scopeKind: ScopeKind
  scopeId: string | null
  createdAt: Iso8601String
}

export interface AuditEventRow {
  id: Uuid
  kind: string
  actor: string
  subject: string
  scopeKind: ScopeKind
  scopeId: string | null
  timestampMs: EpochMillis
  correlationId: string | null
  payload: Record<string, unknown>
}

export interface PersistenceAdapter {
  getAccount(id: Uuid): Promise<AccountRow | null>
  putAccount(row: AccountRow): Promise<void>
  listWorkspaces(accountId: Uuid): Promise<readonly WorkspaceRow[]>
  putWorkspace(row: WorkspaceRow): Promise<void>
  getGrants(actorId: Uuid): Promise<readonly RoleGrantRow[]>
  putGrant(row: RoleGrantRow): Promise<void>
  appendAuditEvent(row: AuditEventRow): Promise<void>
  close(): Promise<void>
}
