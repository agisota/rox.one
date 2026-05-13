import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import type { Database } from 'bun:sqlite'

import { openSqliteAdapter, type SqliteHandle } from '../../persistence/sqlite/connection.ts'
import { runMigrations } from '../../persistence/sqlite/migrations.ts'
import { unsafeMissionId } from '../mission-id.ts'
import { SqliteMissionStore } from '../sqlite-mission-store.ts'
import type { MissionRecord } from '../mission-store.ts'

// Valid uuid-v7 strings — handcrafted so they parse against the
// MissionId branded regex (lowercase hex; version nibble 7; variant
// 8/9/a/b).
const ID_A = unsafeMissionId('0192f6e1-2a8b-7c00-9c1f-0000000000aa')
const ID_B = unsafeMissionId('0192f6e1-2a8b-7c00-9c1f-0000000000bb')
const ID_C = unsafeMissionId('0192f6e1-2a8b-7c00-9c1f-0000000000cc')

const T0 = '2026-05-13T00:00:00.000Z'
const T1 = '2026-05-13T00:05:00.000Z'
const T2 = '2026-05-13T00:10:00.000Z'

function openMigratedDb(): { handle: SqliteHandle; db: Database } {
  const handle = openSqliteAdapter({ path: ':memory:' })
  runMigrations(handle.db)
  return { handle, db: handle.db }
}

describe('SqliteMissionStore — CRUD', () => {
  let handle: SqliteHandle
  let store: SqliteMissionStore

  beforeEach(() => {
    const opened = openMigratedDb()
    handle = opened.handle
    store = new SqliteMissionStore(opened.db, { now: () => T0 })
  })

  afterEach(() => {
    handle.close()
  })

  it('returns undefined for a missing id', async () => {
    const got = await store.get(ID_A)
    expect(got).toBeUndefined()
  })

  it('put + get round-trips a Pending record', async () => {
    const rec: MissionRecord = { id: ID_A, state: { kind: 'Pending', createdAt: T0 } }
    await store.put(rec)
    const got = await store.get(ID_A)
    expect(got).toBeDefined()
    expect(got?.id).toBe(ID_A)
    expect(got?.state.kind).toBe('Pending')
    if (got?.state.kind === 'Pending') {
      expect(got.state.createdAt).toBe(T0)
    }
  })

  it('put overwrites an existing record (Pending -> Running)', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await store.put({ id: ID_A, state: { kind: 'Running', startedAt: T1 } })
    const got = await store.get(ID_A)
    expect(got?.state.kind).toBe('Running')
    if (got?.state.kind === 'Running') {
      expect(got.state.startedAt).toBe(T1)
    }
  })

  it('delete returns false for an unknown id', async () => {
    const removed = await store.delete(ID_A)
    expect(removed).toBe(false)
  })

  it('delete removes an existing row and returns true', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    const removed = await store.delete(ID_A)
    expect(removed).toBe(true)
    const got = await store.get(ID_A)
    expect(got).toBeUndefined()
  })

  it('list returns every row when no filter is supplied', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await store.put({ id: ID_B, state: { kind: 'Running', startedAt: T1 } })
    const all = await store.list({})
    expect(all).toHaveLength(2)
    const ids = all.map((r) => r.id).sort()
    expect(ids).toEqual([ID_A, ID_B].sort())
  })

  it('list filters by a single state kind', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await store.put({ id: ID_B, state: { kind: 'Running', startedAt: T1 } })
    const pending = await store.list({ kinds: ['Pending'] })
    expect(pending).toHaveLength(1)
    expect(pending[0]?.id).toBe(ID_A)
    const running = await store.list({ kinds: ['Running'] })
    expect(running).toHaveLength(1)
    expect(running[0]?.id).toBe(ID_B)
  })

  it('list filters by multiple state kinds', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await store.put({ id: ID_B, state: { kind: 'Completed', at: T1, output: 'ok' } })
    await store.put({ id: ID_C, state: { kind: 'Failed', at: T2, reason: 'oom' } })

    const terminal = await store.list({ kinds: ['Completed', 'Failed', 'Cancelled'] })
    expect(terminal).toHaveLength(2)
    const terminalIds = terminal.map((r) => r.id).sort()
    expect(terminalIds).toEqual([ID_B, ID_C].sort())

    const live = await store.list({ kinds: ['Pending', 'Running'] })
    expect(live).toHaveLength(1)
    expect(live[0]?.id).toBe(ID_A)
  })

  it('list returns an empty array when nothing matches the filter', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    const got = await store.list({ kinds: ['Failed'] })
    expect(got).toEqual([])
  })

  it('list returns an empty array when called with an empty kinds tuple', async () => {
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    const got = await store.list({ kinds: [] })
    expect(got).toEqual([])
  })
})

describe('SqliteMissionStore — state payload round-trip', () => {
  let handle: SqliteHandle
  let store: SqliteMissionStore

  beforeEach(() => {
    const opened = openMigratedDb()
    handle = opened.handle
    store = new SqliteMissionStore(opened.db, { now: () => T0 })
  })

  afterEach(() => {
    handle.close()
  })

  it('round-trips Paused with reason', async () => {
    const rec: MissionRecord = {
      id: ID_A,
      state: { kind: 'Paused', at: T1, reason: 'user_paused' },
    }
    await store.put(rec)
    const got = await store.get(ID_A)
    expect(got?.state.kind).toBe('Paused')
    if (got?.state.kind === 'Paused') {
      expect(got.state.at).toBe(T1)
      expect(got.state.reason).toBe('user_paused')
    }
  })

  it('round-trips Awaiting with prompt containing JSON-unsafe characters', async () => {
    const prompt = 'pick "yes" or \\no\\ — \nnewline OK'
    await store.put({
      id: ID_B,
      state: { kind: 'Awaiting', at: T1, prompt },
    })
    const got = await store.get(ID_B)
    expect(got?.state.kind).toBe('Awaiting')
    if (got?.state.kind === 'Awaiting') {
      expect(got.state.prompt).toBe(prompt)
    }
  })

  it('round-trips Completed with output containing unicode + emoji', async () => {
    const output = 'done — 完了 🚀 100%'
    await store.put({
      id: ID_A,
      state: { kind: 'Completed', at: T2, output },
    })
    const got = await store.get(ID_A)
    expect(got?.state.kind).toBe('Completed')
    if (got?.state.kind === 'Completed') {
      expect(got.state.output).toBe(output)
      expect(got.state.at).toBe(T2)
    }
  })

  it('round-trips Failed and Cancelled', async () => {
    await store.put({ id: ID_A, state: { kind: 'Failed', at: T1, reason: 'oom' } })
    await store.put({ id: ID_B, state: { kind: 'Cancelled', at: T2, reason: 'sigint' } })
    const a = await store.get(ID_A)
    const b = await store.get(ID_B)
    expect(a?.state.kind).toBe('Failed')
    expect(b?.state.kind).toBe('Cancelled')
    if (a?.state.kind === 'Failed') expect(a.state.reason).toBe('oom')
    if (b?.state.kind === 'Cancelled') expect(b.state.reason).toBe('sigint')
  })

  it('stores the state payload as JSON (decode-able by a third party)', async () => {
    await store.put({
      id: ID_A,
      state: { kind: 'Paused', at: T1, reason: 'breakpoint' },
    })
    const raw = handle.db
      .query('SELECT state_kind, state_payload_json FROM missions WHERE id = ?;')
      .get(ID_A) as { state_kind: string; state_payload_json: string } | null
    expect(raw).not.toBeNull()
    expect(raw?.state_kind).toBe('Paused')
    const parsed = JSON.parse(raw!.state_payload_json) as Record<string, unknown>
    expect(parsed['at']).toBe(T1)
    expect(parsed['reason']).toBe('breakpoint')
    // The kind field is intentionally NOT duplicated inside the payload —
    // it lives in its own indexed column.
    expect(parsed['kind']).toBeUndefined()
  })

  it('uses the injected clock for updated_at and preserves created_at across updates', async () => {
    const clockReads: string[] = [T0, T1, T2]
    const tickingStore = new SqliteMissionStore(handle.db, {
      now: () => clockReads.shift() ?? T2,
    })
    await tickingStore.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await tickingStore.put({ id: ID_A, state: { kind: 'Running', startedAt: T1 } })

    const raw = handle.db
      .query('SELECT created_at, updated_at FROM missions WHERE id = ?;')
      .get(ID_A) as { created_at: string; updated_at: string } | null
    expect(raw).not.toBeNull()
    // created_at carries the Pending state's createdAt (the timestamp at
    // first insert), so even after the Running update the original
    // creation time is preserved.
    expect(raw?.created_at).toBe(T0)
    expect(raw?.updated_at).toBe(T1)
  })

  it('rejects rows whose state_kind column has been corrupted', async () => {
    handle.db.run(
      `INSERT INTO missions (id, state_kind, state_payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      [ID_A, 'NotARealKind', '{"createdAt":"' + T0 + '"}', T0, T0],
    )
    await expect(store.get(ID_A)).rejects.toThrow(/invalid state_kind/)
  })

  it('rejects rows whose payload JSON is malformed', async () => {
    handle.db.run(
      `INSERT INTO missions (id, state_kind, state_payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      [ID_A, 'Pending', 'not-json', T0, T0],
    )
    await expect(store.get(ID_A)).rejects.toThrow(/invalid JSON/)
  })

  it('rejects list calls that name an unknown kind', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.list({ kinds: ['Bogus' as any] }),
    ).rejects.toThrow(/invalid state_kind/)
  })
})

describe('SqliteMissionStore — durability + isolation', () => {
  let handle: SqliteHandle

  afterEach(() => {
    handle?.close()
  })

  it('isolates rows across two independent databases', async () => {
    const a = openMigratedDb()
    const b = openMigratedDb()
    try {
      const storeA = new SqliteMissionStore(a.db, { now: () => T0 })
      const storeB = new SqliteMissionStore(b.db, { now: () => T0 })

      await storeA.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
      await storeB.put({ id: ID_B, state: { kind: 'Running', startedAt: T1 } })

      // Each store sees only its own row.
      const inA = await storeA.list({})
      const inB = await storeB.list({})
      expect(inA).toHaveLength(1)
      expect(inA[0]?.id).toBe(ID_A)
      expect(inB).toHaveLength(1)
      expect(inB[0]?.id).toBe(ID_B)

      // Cross-instance lookups return nothing — independent storage.
      expect(await storeA.get(ID_B)).toBeUndefined()
      expect(await storeB.get(ID_A)).toBeUndefined()

      // Deleting from one does not affect the other.
      expect(await storeA.delete(ID_A)).toBe(true)
      expect(await storeB.get(ID_B)).toBeDefined()
    } finally {
      a.handle.close()
      b.handle.close()
    }
  })

  it('survives a fresh store instance against the same db handle', async () => {
    const opened = openMigratedDb()
    handle = opened.handle
    const first = new SqliteMissionStore(opened.db, { now: () => T0 })
    await first.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await first.put({ id: ID_B, state: { kind: 'Running', startedAt: T1 } })

    // A second store on the same DB handle sees the same rows — proves
    // the data lives in sqlite and not on the JS object.
    const second = new SqliteMissionStore(opened.db, { now: () => T0 })
    const got = await second.get(ID_A)
    expect(got?.state.kind).toBe('Pending')
    const list = await second.list({})
    expect(list).toHaveLength(2)
  })

  it('snapshots are independent of subsequent mutations', async () => {
    const opened = openMigratedDb()
    handle = opened.handle
    const store = new SqliteMissionStore(opened.db, { now: () => T0 })
    await store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    const snapshot = await store.list({})
    await store.put({ id: ID_B, state: { kind: 'Running', startedAt: T1 } })
    expect(snapshot).toHaveLength(1)
    const fresh = await store.list({})
    expect(fresh).toHaveLength(2)
  })
})
