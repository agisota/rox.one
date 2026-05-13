import { describe, expect, it } from 'bun:test'

import { InMemoryMissionStore, type MissionRecord, type MissionStore } from '../mission-store.ts'
import { unsafeMissionId } from '../mission-id.ts'

const T = '2026-05-13T00:00:00.000Z'
const ID_A = unsafeMissionId('mission-a')
const ID_B = unsafeMissionId('mission-b')

function record(id: typeof ID_A, kind: 'Pending' | 'Running' | 'Completed'): MissionRecord {
  if (kind === 'Pending') return { id, state: { kind: 'Pending', createdAt: T } }
  if (kind === 'Running') return { id, state: { kind: 'Running', startedAt: T } }
  return { id, state: { kind: 'Completed', at: T, output: 'ok' } }
}

describe('InMemoryMissionStore', () => {
  it('stores and reads a record by id', async () => {
    const store: MissionStore = new InMemoryMissionStore()
    const r = record(ID_A, 'Pending')
    await store.put(r)
    const got = await store.get(ID_A)
    expect(got).toEqual(r)
  })

  it('returns undefined for missing ids', async () => {
    const store = new InMemoryMissionStore()
    const got = await store.get(unsafeMissionId('nope'))
    expect(got).toBeUndefined()
  })

  it('put overwrites an existing record', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    await store.put(record(ID_A, 'Running'))
    const got = await store.get(ID_A)
    expect(got?.state.kind).toBe('Running')
  })

  it('list returns all records when filter is empty', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    await store.put(record(ID_B, 'Running'))
    const all = await store.list({})
    expect(all).toHaveLength(2)
    const ids = all.map((r) => r.id).sort()
    expect(ids).toEqual([ID_A, ID_B].sort())
  })

  it('list filters by state kind', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    await store.put(record(ID_B, 'Running'))
    const pending = await store.list({ kinds: ['Pending'] })
    expect(pending).toHaveLength(1)
    expect(pending[0]?.id).toBe(ID_A)
    const running = await store.list({ kinds: ['Running'] })
    expect(running).toHaveLength(1)
    expect(running[0]?.id).toBe(ID_B)
  })

  it('list filters by multiple state kinds', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    await store.put(record(ID_B, 'Completed'))
    const live = await store.list({ kinds: ['Pending', 'Running'] })
    expect(live).toHaveLength(1)
    const terminal = await store.list({ kinds: ['Completed', 'Failed', 'Cancelled'] })
    expect(terminal).toHaveLength(1)
    expect(terminal[0]?.id).toBe(ID_B)
  })

  it('list returns an empty array when nothing matches', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    const got = await store.list({ kinds: ['Failed'] })
    expect(got).toEqual([])
  })

  it('delete removes a record', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    const removed = await store.delete(ID_A)
    expect(removed).toBe(true)
    const got = await store.get(ID_A)
    expect(got).toBeUndefined()
  })

  it('delete returns false for missing ids', async () => {
    const store = new InMemoryMissionStore()
    const removed = await store.delete(unsafeMissionId('nope'))
    expect(removed).toBe(false)
  })

  it('list snapshot is independent of internal map mutation', async () => {
    const store = new InMemoryMissionStore()
    await store.put(record(ID_A, 'Pending'))
    const snapshot = await store.list({})
    await store.put(record(ID_B, 'Running'))
    expect(snapshot).toHaveLength(1)
  })
})
