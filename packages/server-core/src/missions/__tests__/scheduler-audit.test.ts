/**
 * T246: AuditProducer wiring in MissionScheduler.
 *
 * Scoped to the audit side-effect — broad scheduler behaviour lives
 * in `scheduler.test.ts`. Verifies emit-on-Start/Complete/Fail with
 * correct payload shape, silence on every non-lifecycle path, the
 * optional-producer contract, and workspace-id scope plumbing.
 */

import { describe, expect, it } from 'bun:test'

import {
  type AuditEvent,
  type AuditSink,
  createAuditProducer,
  createStructuredLogger,
} from '@rox-one/shared/observability'

import { InMemoryMissionStore } from '../mission-store.ts'
import { MissionScheduler, type UuidGenerator } from '../scheduler.ts'
import { unsafeMissionId } from '../mission-id.ts'

const SEED = '2026-05-13T00:00:00.000Z'
const noopClock = (): Date => new Date(SEED)

function fakeClock(): { now: () => string; advance: (ms: number) => void } {
  let n = Date.parse(SEED)
  return { now: () => new Date(n).toISOString(), advance: (ms) => { n += ms } }
}

function fakeUuidGen(): UuidGenerator {
  let i = 0
  return () => {
    i += 1
    return unsafeMissionId(`01977a3b-5c4d-7abc-9def-${i.toString(16).padStart(12, '0')}`)
  }
}

function makeProducer(): ReturnType<typeof createAuditProducer> & { __audit: AuditEvent[] } {
  const audit: AuditEvent[] = []
  const sink: AuditSink = (e) => { audit.push(e) }
  const logger = createStructuredLogger({ sink: () => {}, threshold: 'trace', clock: noopClock })
  const producer = createAuditProducer({ sink, logger, clock: noopClock })
  return Object.assign(producer, { __audit: audit })
}

interface Harness {
  scheduler: MissionScheduler
  clock: ReturnType<typeof fakeClock>
  producer?: ReturnType<typeof makeProducer>
}

function makeHarness(opts: { producer?: ReturnType<typeof makeProducer>; workspaceId?: string } = {}): Harness {
  const clock = fakeClock()
  const scheduler = new MissionScheduler({
    store: new InMemoryMissionStore(),
    clock,
    uuid: fakeUuidGen(),
    auditProducer: opts.producer,
    workspaceId: opts.workspaceId,
  })
  return { scheduler, clock, producer: opts.producer }
}

describe('MissionScheduler — audit emission on lifecycle transitions', () => {
  it('emits MissionStarted on Pending -> Running', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })

    expect(producer.__audit).toHaveLength(1)
    const event = producer.__audit[0]!
    expect(event.kind).toBe('MissionStarted')
    expect(event.actor).toEqual({ type: 'system' })
    expect(event.subject).toEqual({ type: 'mission', id: m.id })
    expect(event.scope).toEqual({ kind: 'global' })
    if (event.kind === 'MissionStarted') expect(event.missionId).toBe(m.id)
  })

  it('emits MissionCompleted with positive durationMs on Running -> Completed', async () => {
    const producer = makeProducer()
    const { scheduler, clock } = makeHarness({ producer })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    clock.advance(5000)
    await scheduler.dispatchEvent(m.id, { kind: 'Complete', output: 'done' })

    expect(producer.__audit).toHaveLength(2)
    const completed = producer.__audit[1]!
    expect(completed.kind).toBe('MissionCompleted')
    if (completed.kind === 'MissionCompleted') {
      expect(completed.durationMs).toBe(5000)
      expect(completed.missionId).toBe(m.id)
    }
  })

  it('emits MissionFailed with errorMessage on Running -> Failed', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    await scheduler.dispatchEvent(m.id, { kind: 'Fail', reason: 'OOM' })

    expect(producer.__audit).toHaveLength(2)
    const failed = producer.__audit[1]!
    expect(failed.kind).toBe('MissionFailed')
    if (failed.kind === 'MissionFailed') {
      expect(failed.errorMessage).toBe('OOM')
      expect(failed.missionId).toBe(m.id)
    }
  })

  it('emits exactly once per matching transition (no duplicates on repeat-Start)', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    await scheduler.dispatchEvent(m.id, { kind: 'Start' }) // illegal, must NOT emit

    expect(producer.__audit).toHaveLength(1)
    expect(producer.__audit[0]!.kind).toBe('MissionStarted')
  })
})

describe('MissionScheduler — non-emitting transitions', () => {
  it('does not emit on Pause/Resume/AwaitInput/ProvideInput', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    producer.__audit.length = 0

    await scheduler.dispatchEvent(m.id, { kind: 'Pause', reason: 'rate-limit' })
    await scheduler.dispatchEvent(m.id, { kind: 'Resume' })
    await scheduler.dispatchEvent(m.id, { kind: 'AwaitInput', prompt: 'a or b?' })
    await scheduler.dispatchEvent(m.id, { kind: 'ProvideInput', input: 'a' })

    expect(producer.__audit).toEqual([])
  })

  it('does not emit on Cancel (not in the M.14 taxonomy)', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Cancel', reason: 'user' })
    expect(producer.__audit).toEqual([])
  })

  it('does not emit when the transition is illegal (Resume from Pending)', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const m = await scheduler.create()
    const r = await scheduler.dispatchEvent(m.id, { kind: 'Resume' })
    expect(r.ok).toBe(false)
    expect(producer.__audit).toEqual([])
  })

  it('does not emit when the mission does not exist', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer })
    const r = await scheduler.dispatchEvent(unsafeMissionId('ghost'), { kind: 'Start' })
    expect(r.ok).toBe(false)
    expect(producer.__audit).toEqual([])
  })
})

describe('MissionScheduler — optional producer and workspace scope', () => {
  it('runs identically when no auditProducer is provided', async () => {
    const store = new InMemoryMissionStore()
    const scheduler = new MissionScheduler({ store, clock: fakeClock(), uuid: fakeUuidGen() })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })
    await scheduler.dispatchEvent(m.id, { kind: 'Complete', output: 'done' })
    expect((await store.get(m.id))?.state.kind).toBe('Completed')
  })

  it('stamps mission scope when a workspaceId is provided', async () => {
    const producer = makeProducer()
    const { scheduler } = makeHarness({ producer, workspaceId: 'ws-42' })
    const m = await scheduler.create()
    await scheduler.dispatchEvent(m.id, { kind: 'Start' })

    const event = producer.__audit[0]!
    expect(event.scope).toEqual({ kind: 'mission', workspaceId: 'ws-42', missionId: m.id })
  })
})
