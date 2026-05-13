import { describe, expect, it } from 'bun:test'

import { InMemoryMissionStore } from '../mission-store.ts'
import { MissionScheduler, type UuidGenerator } from '../scheduler.ts'
import { unsafeMissionId } from '../mission-id.ts'

function fakeClock(seed: string) {
  let n = Date.parse(seed)
  return {
    now: () => new Date(n).toISOString(),
    advance(ms: number) {
      n += ms
    },
  }
}

function fakeUuidGen(): UuidGenerator {
  let i = 0
  return () => {
    i += 1
    const hex = i.toString(16).padStart(12, '0')
    return unsafeMissionId(`01977a3b-5c4d-7abc-9def-${hex}`)
  }
}

describe('MissionScheduler.create', () => {
  it('creates a Pending mission with a generated v7 id', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const created = await scheduler.create()
    expect(created.state.kind).toBe('Pending')
    if (created.state.kind === 'Pending') {
      expect(created.state.createdAt).toBe('2026-05-13T00:00:00.000Z')
    }
    expect(created.id).toBe(unsafeMissionId('01977a3b-5c4d-7abc-9def-000000000001'))
    const got = await store.get(created.id)
    expect(got).toEqual(created)
  })

  it('creates monotonically distinct ids', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    const a = await scheduler.create()
    const b = await scheduler.create()
    expect(a.id).not.toBe(b.id)
  })
})

describe('MissionScheduler.dispatchEvent', () => {
  it('drives Pending -> Running on Start', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const mission = await scheduler.create()
    clock.advance(1000)
    const r = await scheduler.dispatchEvent(mission.id, { kind: 'Start' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.state.kind).toBe('Running')
    }
  })

  it('persists the new state after a successful dispatch', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    const got = await store.get(m.id)
    expect(got?.state.kind).toBe('Running')
  })

  it('returns an error for an illegal event', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()
    const r = await scheduler.dispatchEvent(m.id, { kind: 'Resume' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.kind).toBe('illegal_transition')
    }
  })

  it('does not mutate state on a rejected event', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Resume' })
    const got = await store.get(m.id)
    expect(got?.state.kind).toBe('Pending')
  })

  it('returns a typed error when the mission does not exist', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    const r = await scheduler.dispatchEvent(unsafeMissionId('ghost'), { kind: 'Start' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.kind).toBe('mission_not_found')
    }
  })

  it('walks the full happy path: create -> Start -> AwaitInput -> ProvideInput -> Complete', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()

    clock.advance(1000)
    const r1 = await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    expect(r1.ok).toBe(true)

    clock.advance(1000)
    const r2 = await scheduler.dispatchEvent(m.id, { kind: 'AwaitInput', prompt: 'a or b?' })
    expect(r2.ok).toBe(true)

    clock.advance(1000)
    const r3 = await scheduler.dispatchEvent(m.id, { kind: 'ProvideInput', input: 'a' })
    expect(r3.ok).toBe(true)

    clock.advance(1000)
    const r4 = await scheduler.dispatchEvent(m.id, { kind: 'Complete', output: 'shipped' })
    expect(r4.ok).toBe(true)
    if (r4.ok && r4.value.state.kind === 'Completed') {
      expect(r4.value.state.output).toBe('shipped')
    }
  })

  it('walks pause/resume path: Start -> Pause -> Resume -> Fail', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    await scheduler.dispatchEvent(m.id, { kind: 'Pause', reason: 'rate-limit' })
    const paused = await store.get(m.id)
    expect(paused?.state.kind).toBe('Paused')
    await scheduler.dispatchEvent(m.id, { kind: 'Resume' })
    const resumed = await store.get(m.id)
    expect(resumed?.state.kind).toBe('Running')
    await scheduler.dispatchEvent(m.id, { kind: 'Fail', reason: 'OOM' })
    const failed = await store.get(m.id)
    expect(failed?.state.kind).toBe('Failed')
  })

  it('stamps each transition with the clock-provided ISO timestamp', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()
    clock.advance(60_000)
    const r = await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.state.kind === 'Running') {
      expect(r.value.state.startedAt).toBe('2026-05-13T00:01:00.000Z')
    }
  })
})

describe('MissionScheduler.get and list', () => {
  it('get returns the latest stored record', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    const m = await scheduler.create()
    const got = await scheduler.get(m.id)
    expect(got?.id).toBe(m.id)
  })

  it('get returns undefined for unknown ids', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    const got = await scheduler.get(unsafeMissionId('nope'))
    expect(got).toBeUndefined()
  })

  it('list with no filter returns every record', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    await scheduler.create()
    await scheduler.create()
    const all = await scheduler.list({})
    expect(all).toHaveLength(2)
  })

  it('list filters by state kind', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    const a = await scheduler.create()
    await scheduler.create()
    await scheduler.dispatchEvent(a.id, { kind: 'Start' })
    const pending = await scheduler.list({ kinds: ['Pending'] })
    expect(pending).toHaveLength(1)
    const running = await scheduler.list({ kinds: ['Running'] })
    expect(running).toHaveLength(1)
    expect(running[0]?.id).toBe(a.id)
  })

  it('list returns an empty array when nothing matches', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({
      store,
      clock: fakeClock('2026-05-13T00:00:00.000Z'),
      uuid: fakeUuidGen(),
    })
    await scheduler.create()
    const got = await scheduler.list({ kinds: ['Cancelled'] })
    expect(got).toEqual([])
  })
})

describe('MissionScheduler — defaults and integration', () => {
  it('uses sane defaults when only a store is provided', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({ store })
    const m = await scheduler.create()
    expect(m.state.kind).toBe('Pending')
    if (m.state.kind === 'Pending') {
      // ISO string with a trailing Z
      expect(m.state.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }
  })

  it('rejects events on a terminal mission', async () => {
    const store = new InMemoryMissionStore()
    const clock = fakeClock('2026-05-13T00:00:00.000Z')
    const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Cancel', reason: 'user' })
    const r = await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.kind).toBe('terminal_state')
    }
  })
})
