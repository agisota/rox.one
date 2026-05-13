/**
 * `SqliteMissionStore` — `bun:sqlite`-backed implementation of the
 * `MissionStore` interface introduced by T241.
 *
 * Storage shape (migration 0002-missions):
 *
 *   missions(
 *     id                  TEXT PRIMARY KEY,
 *     state_kind          TEXT NOT NULL,
 *     state_payload_json  TEXT NOT NULL,
 *     created_at          TEXT NOT NULL,
 *     updated_at          TEXT NOT NULL
 *   )
 *
 * The `MissionState` discriminated union is encoded as
 * `(state_kind, state_payload_json)` so:
 *
 *   - `list({ kinds })` probes the `idx_missions_state_kind` B-tree
 *     instead of decoding every row.
 *   - Adding a new variant to the algebra is a single-file change in
 *     `encodeState` / `decodeState`. No schema migration needed.
 *
 * `created_at` is the ISO-8601 timestamp embedded in the state at the
 * moment the row was first inserted; `updated_at` is rewritten on every
 * `put`. Both columns are stored as UTC ISO-8601 strings so they sort
 * lexicographically and match the codebase's "UTC at rest" data rule.
 *
 * The class is a pure async facade over the sync `bun:sqlite` API — the
 * `MissionStore` interface is async so the seam can later swap to an
 * async driver (libsql, pg) without changing call sites.
 */

import { Database } from 'bun:sqlite'

import type { MissionId } from './mission-id.ts'
import type {
  MissionListFilter,
  MissionRecord,
  MissionStore,
} from './mission-store.ts'
import type { MissionState, MissionStateKind } from './state.ts'
import { MISSION_STATE_KINDS } from './state.ts'

interface MissionDbRow {
  id: string
  state_kind: string
  state_payload_json: string
  created_at: string
  updated_at: string
}

const VALID_STATE_KINDS: ReadonlySet<MissionStateKind> = new Set(MISSION_STATE_KINDS)

function assertStateKind(value: string): asserts value is MissionStateKind {
  if (!VALID_STATE_KINDS.has(value as MissionStateKind)) {
    throw new Error(`SqliteMissionStore: invalid state_kind '${value}'`)
  }
}

/**
 * Encode a `MissionState` as the `(kind, payload)` pair we persist. The
 * payload omits the `kind` field — it's already stored in its own column.
 */
function encodeState(state: MissionState): {
  kind: MissionStateKind
  payload: Record<string, string>
  timestamp: string
} {
  switch (state.kind) {
    case 'Pending':
      return {
        kind: 'Pending',
        payload: { createdAt: state.createdAt },
        timestamp: state.createdAt,
      }
    case 'Running':
      return {
        kind: 'Running',
        payload: { startedAt: state.startedAt },
        timestamp: state.startedAt,
      }
    case 'Paused':
      return {
        kind: 'Paused',
        payload: { at: state.at, reason: state.reason },
        timestamp: state.at,
      }
    case 'Awaiting':
      return {
        kind: 'Awaiting',
        payload: { at: state.at, prompt: state.prompt },
        timestamp: state.at,
      }
    case 'Completed':
      return {
        kind: 'Completed',
        payload: { at: state.at, output: state.output },
        timestamp: state.at,
      }
    case 'Failed':
      return {
        kind: 'Failed',
        payload: { at: state.at, reason: state.reason },
        timestamp: state.at,
      }
    case 'Cancelled':
      return {
        kind: 'Cancelled',
        payload: { at: state.at, reason: state.reason },
        timestamp: state.at,
      }
  }
}

function asString(payload: Record<string, unknown>, field: string): string {
  const v = payload[field]
  if (typeof v !== 'string') {
    throw new Error(
      `SqliteMissionStore: expected string for payload.${field}, got ${typeof v}`,
    )
  }
  return v
}

function decodeState(kind: MissionStateKind, payloadJson: string): MissionState {
  let parsed: unknown
  try {
    parsed = JSON.parse(payloadJson)
  } catch (err) {
    throw new Error(
      `SqliteMissionStore: invalid JSON in state_payload_json (${(err as Error).message})`,
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('SqliteMissionStore: state_payload_json must decode to a JSON object')
  }
  const p = parsed as Record<string, unknown>
  switch (kind) {
    case 'Pending':
      return { kind: 'Pending', createdAt: asString(p, 'createdAt') }
    case 'Running':
      return { kind: 'Running', startedAt: asString(p, 'startedAt') }
    case 'Paused':
      return { kind: 'Paused', at: asString(p, 'at'), reason: asString(p, 'reason') }
    case 'Awaiting':
      return { kind: 'Awaiting', at: asString(p, 'at'), prompt: asString(p, 'prompt') }
    case 'Completed':
      return { kind: 'Completed', at: asString(p, 'at'), output: asString(p, 'output') }
    case 'Failed':
      return { kind: 'Failed', at: asString(p, 'at'), reason: asString(p, 'reason') }
    case 'Cancelled':
      return { kind: 'Cancelled', at: asString(p, 'at'), reason: asString(p, 'reason') }
  }
}

function rowToRecord(row: MissionDbRow): MissionRecord {
  assertStateKind(row.state_kind)
  return {
    id: row.id as MissionId,
    state: decodeState(row.state_kind, row.state_payload_json),
  }
}

export interface SqliteMissionStoreOptions {
  /**
   * Override the clock used to stamp `updated_at`. ISO-8601 UTC string.
   * Defaults to the state's own timestamp, falling back to `new Date()`.
   */
  now?: () => string
}

export class SqliteMissionStore implements MissionStore {
  private readonly db: Database
  private readonly clock: () => string

  /**
   * @param db An already-migrated `bun:sqlite` database. Callers own the
   *   handle's lifecycle — the store does not open or close it.
   */
  constructor(db: Database, options: SqliteMissionStoreOptions = {}) {
    this.db = db
    this.clock = options.now ?? (() => new Date().toISOString())
  }

  async get(id: MissionId): Promise<MissionRecord | undefined> {
    const row = this.db
      .query(
        `SELECT id, state_kind, state_payload_json, created_at, updated_at
         FROM missions WHERE id = ?;`,
      )
      .get(id) as MissionDbRow | null
    if (!row) return undefined
    return rowToRecord(row)
  }

  async put(record: MissionRecord): Promise<void> {
    const { kind, payload, timestamp } = encodeState(record.state)
    const payloadJson = JSON.stringify(payload)
    const updatedAt = this.clock()
    // Preserve the original `created_at` on update by COALESCEing against
    // the existing row; on insert there is no existing row so the
    // candidate (the state's own timestamp) wins.
    this.db.run(
      `INSERT INTO missions (id, state_kind, state_payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         state_kind = excluded.state_kind,
         state_payload_json = excluded.state_payload_json,
         updated_at = excluded.updated_at;`,
      [record.id, kind, payloadJson, timestamp, updatedAt],
    )
  }

  async delete(id: MissionId): Promise<boolean> {
    const before = this.db
      .query('SELECT 1 AS x FROM missions WHERE id = ? LIMIT 1;')
      .get(id) as { x: number } | null
    if (!before) return false
    this.db.run('DELETE FROM missions WHERE id = ?;', [id])
    return true
  }

  async list(filter: MissionListFilter): Promise<readonly MissionRecord[]> {
    const kinds = filter.kinds
    let rows: MissionDbRow[]
    if (!kinds) {
      rows = this.db
        .query(
          `SELECT id, state_kind, state_payload_json, created_at, updated_at
           FROM missions
           ORDER BY created_at ASC, id ASC;`,
        )
        .all() as MissionDbRow[]
    } else if (kinds.length === 0) {
      // Caller asked for *no* kinds — return nothing without round-tripping
      // a `WHERE state_kind IN ()` (which SQLite would reject anyway).
      return []
    } else {
      // Validate every requested kind so a typo at the boundary fails
      // loudly instead of returning a silent empty list.
      for (const k of kinds) {
        assertStateKind(k)
      }
      const placeholders = kinds.map(() => '?').join(', ')
      rows = this.db
        .query(
          `SELECT id, state_kind, state_payload_json, created_at, updated_at
           FROM missions
           WHERE state_kind IN (${placeholders})
           ORDER BY created_at ASC, id ASC;`,
        )
        .all(...kinds) as MissionDbRow[]
    }
    return Object.freeze(rows.map(rowToRecord))
  }
}
