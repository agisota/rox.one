/**
 * Tests for the Experience Layer IPC bridge — M.9 T273. Covers subscribe
 * lifecycle, payload forwarding, actor-id filtering, multi-subscriber
 * multiplexing, malformed-payload rejection, and observer-error isolation.
 */
import { describe, it, expect } from 'bun:test'
import {
  createExperienceIpcBridge,
  EXPERIENCE_EVENT_CHANNEL,
  type ExperienceEventEnvelope,
  type ExperienceIpcRpcClient,
} from '../ipc-bridge.ts'
import {
  idle,
  loading,
  ready,
  unsafeExperienceId,
  type ExperienceState,
} from '../../../../../../packages/shared/src/experience-layer/index.ts'

const ACTOR_ID = 'actor-a'
const OTHER_ACTOR_ID = 'actor-b'
const STATE_ID = unsafeExperienceId('0190a4d2-1234-7abc-89de-0123456789ab')

interface Snapshot { readonly count: number }

interface FakeRpc {
  client: ExperienceIpcRpcClient
  subscribeCount: number
  unsubscribeCount: number
  channels: string[]
  push(payload: unknown): void
}

function fakeRpc(): FakeRpc {
  let handler: ((p: unknown) => void) | null = null
  const channels: string[] = []
  let subCount = 0
  let unsubCount = 0
  const client: ExperienceIpcRpcClient = {
    subscribe(channel, fn) {
      subCount += 1
      channels.push(channel)
      handler = fn as (p: unknown) => void
      return () => {
        unsubCount += 1
        if (handler === fn) handler = null
      }
    },
  }
  return {
    client,
    get subscribeCount() { return subCount },
    get unsubscribeCount() { return unsubCount },
    channels,
    push(p) { if (!handler) throw new Error('no active handler'); handler(p) },
  }
}

describe('createExperienceIpcBridge · subscribe + forwarding', () => {
  it('does not subscribe upstream until the first observer subscribes', () => {
    const rpc = fakeRpc()
    createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    expect(rpc.subscribeCount).toBe(0)
  })

  it('subscribes once to the default experience.event channel', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const unsub = bridge$.subscribe({ next: () => {} })
    expect(rpc.subscribeCount).toBe(1)
    expect(rpc.channels[0]).toBe(EXPERIENCE_EVENT_CHANNEL)
    expect(rpc.unsubscribeCount).toBe(0)
    unsub()
  })

  it('respects a custom channel override', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(
      rpc.client, { actorId: ACTOR_ID }, { channel: 'custom.channel' },
    )
    const unsub = bridge$.subscribe({ next: () => {} })
    expect(rpc.channels[0]).toBe('custom.channel')
    unsub()
  })

  it('forwards inbound payloads as ExperienceState emissions', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const received: ExperienceState<Snapshot>[] = []
    bridge$.subscribe({ next: (s) => received.push(s) })
    const snap: ExperienceState<Snapshot> = ready(STATE_ID, { count: 1 }, 1)
    const envelope: ExperienceEventEnvelope<Snapshot> = { actorId: ACTOR_ID, state: snap }
    rpc.push(envelope)
    rpc.push({ actorId: ACTOR_ID, state: loading(STATE_ID, 2) })
    expect(received.length).toBe(2)
    expect(received[0]).toBe(snap)
    expect(received[1]!.kind).toBe('loading')
  })

  it('drops payloads bound to a different actorId', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const received: ExperienceState<Snapshot>[] = []
    bridge$.subscribe({ next: (s) => received.push(s) })
    rpc.push({ actorId: OTHER_ACTOR_ID, state: ready(STATE_ID, { count: 1 }, 1) })
    expect(received.length).toBe(0)
  })
})

describe('createExperienceIpcBridge · malformed payloads', () => {
  it('drops null, primitives, and structurally-invalid envelopes', () => {
    const rpc = fakeRpc()
    const dropped: string[] = []
    const bridge$ = createExperienceIpcBridge<Snapshot>(
      rpc.client, { actorId: ACTOR_ID },
      { onPayloadError: (_, reason) => dropped.push(reason) },
    )
    const received: unknown[] = []
    bridge$.subscribe({ next: (s) => received.push(s) })
    rpc.push(null)
    rpc.push(42)
    rpc.push('not-an-envelope')
    rpc.push({})
    rpc.push({ actorId: '', state: idle(STATE_ID) })
    rpc.push({ actorId: ACTOR_ID, state: { kind: 'unknown', id: 'x' } })
    rpc.push({ actorId: ACTOR_ID, state: { kind: 'idle', id: '' } })
    expect(received.length).toBe(0)
    expect(dropped.length).toBe(7)
    expect(dropped.every((r) => r === 'invalid-envelope')).toBe(true)
  })

  it('silently swallows malformed payloads when no error sink is provided', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const received: unknown[] = []
    bridge$.subscribe({ next: (s) => received.push(s) })
    expect(() => rpc.push(null)).not.toThrow()
    expect(() => rpc.push({ actorId: ACTOR_ID })).not.toThrow()
    expect(received.length).toBe(0)
  })
})

describe('createExperienceIpcBridge · unsubscribe lifecycle', () => {
  it('releases the upstream when the last observer unsubscribes', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const unsub = bridge$.subscribe({ next: () => {} })
    expect(rpc.subscribeCount).toBe(1)
    expect(rpc.unsubscribeCount).toBe(0)
    unsub()
    expect(rpc.unsubscribeCount).toBe(1)
  })

  it('keeps the upstream alive while another observer remains', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const u1 = bridge$.subscribe({ next: () => {} })
    const u2 = bridge$.subscribe({ next: () => {} })
    expect(rpc.subscribeCount).toBe(1)
    u1()
    expect(rpc.unsubscribeCount).toBe(0)
    u2()
    expect(rpc.unsubscribeCount).toBe(1)
  })

  it('double unsubscribe on the same observer is a no-op', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const unsub = bridge$.subscribe({ next: () => {} })
    unsub()
    unsub()
    expect(rpc.unsubscribeCount).toBe(1)
  })

  it('does not deliver to observers after they unsubscribe', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const received: ExperienceState<Snapshot>[] = []
    const unsub = bridge$.subscribe({ next: (s) => received.push(s) })
    rpc.push({ actorId: ACTOR_ID, state: ready(STATE_ID, { count: 1 }, 1) })
    unsub()
    const u2 = bridge$.subscribe({ next: () => {} })
    rpc.push({ actorId: ACTOR_ID, state: ready(STATE_ID, { count: 2 }, 2) })
    expect(received.length).toBe(1)
    expect(received[0]!.kind).toBe('ready')
    u2()
  })
})

describe('createExperienceIpcBridge · multi-subscriber', () => {
  it('shares one upstream subscription across N observers', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const a: ExperienceState<Snapshot>[] = []
    const b: ExperienceState<Snapshot>[] = []
    const c: ExperienceState<Snapshot>[] = []
    const ua = bridge$.subscribe({ next: (s) => a.push(s) })
    const ub = bridge$.subscribe({ next: (s) => b.push(s) })
    const uc = bridge$.subscribe({ next: (s) => c.push(s) })
    expect(rpc.subscribeCount).toBe(1)
    rpc.push({ actorId: ACTOR_ID, state: ready(STATE_ID, { count: 5 }, 5) })
    expect(a.length).toBe(1)
    expect(b.length).toBe(1)
    expect(c.length).toBe(1)
    ua(); ub(); uc()
    expect(rpc.unsubscribeCount).toBe(1)
  })

  it('re-acquires the upstream when a new observer arrives after release', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const u1 = bridge$.subscribe({ next: () => {} })
    u1()
    expect(rpc.unsubscribeCount).toBe(1)
    const u2 = bridge$.subscribe({ next: () => {} })
    expect(rpc.subscribeCount).toBe(2)
    u2()
    expect(rpc.unsubscribeCount).toBe(2)
  })

  it('isolates observer exceptions from sibling handlers', () => {
    const rpc = fakeRpc()
    const bridge$ = createExperienceIpcBridge<Snapshot>(rpc.client, { actorId: ACTOR_ID })
    const good: ExperienceState<Snapshot>[] = []
    bridge$.subscribe({ next: () => { throw new Error('boom') } })
    bridge$.subscribe({ next: (s) => good.push(s) })
    expect(() =>
      rpc.push({ actorId: ACTOR_ID, state: ready(STATE_ID, { count: 1 }, 1) }),
    ).not.toThrow()
    expect(good.length).toBe(1)
  })

  it('upstream unsubscribe that throws does not break the bridge', () => {
    let handler: ((p: unknown) => void) | null = null
    const client: ExperienceIpcRpcClient = {
      subscribe(_, fn) {
        handler = fn as (p: unknown) => void
        return () => { handler = null; throw new Error('release-boom') }
      },
    }
    const bridge$ = createExperienceIpcBridge<Snapshot>(client, { actorId: ACTOR_ID })
    const unsub = bridge$.subscribe({ next: () => {} })
    expect(() => unsub()).not.toThrow()
    const u2 = bridge$.subscribe({ next: () => {} })
    expect(typeof handler).toBe('function')
    u2()
  })
})
