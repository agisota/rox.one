/**
 * T272 — server emit RPC tests for the M.9 Experience Layer.
 *
 * Covers emit fan-out, owner-gate rejection, subscribe/unsubscribe
 * lifecycle, validation envelopes, cross-actor isolation, idempotent
 * unsubscribe, the rbac-not-configured fallback, and the bus helper.
 */

import { describe, expect, it } from 'bun:test'
import { InMemoryGrantStore, RbacResolver, type RoleGrant } from '@rox-one/shared/auth'
import type { HandlerFn, RequestContext, RpcServer } from '@rox-one/server-core/transport'
import type { PushTarget } from '@rox-one/shared/protocol'
import { idle, loading, ready, type ExperienceState } from '../../../../../shared/src/experience-layer/index.ts'
import type { HandlerDeps } from '../../handler-deps'
import { createExperienceBus } from '../experience-bus'
import { EXPERIENCE_CHANNELS, registerExperienceCoreHandlers } from '../experience'

const WORKSPACE_A = 'W_A'
const WORKSPACE_B = 'W_B'
const ACTOR_ID = '0193b3f9-1234-7abc-9def-000000000001'
const OTHER_ACTOR_ID = '0193b3f9-1234-7abc-9def-000000000002'

interface PushRecord { channel: string; target: PushTarget; args: any[] }
interface Harness { handlers: Map<string, HandlerFn>; pushes: PushRecord[] }

function userGrant(actorId: string, scopeKind: RoleGrant['scopeKind'], scopeId: string | null, roleId: string): RoleGrant {
  return { roleId, actorKind: 'user', actorId, scopeKind, scopeId }
}

function platformStub(): HandlerDeps['platform'] {
  return {
    appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test', isDebugMode: true,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
  } as HandlerDeps['platform']
}

function createHarness(initialGrants: ReadonlyArray<RoleGrant> = [], opts: { withResolver?: boolean } = {}): Harness {
  const handlers = new Map<string, HandlerFn>()
  const pushes: PushRecord[] = []
  const server: RpcServer = {
    handle: (channel, handler) => { handlers.set(channel, handler) },
    push: (channel, target, ...args) => { pushes.push({ channel, target, args }) },
    invokeClient: async () => undefined,
  }
  const grantStore = new InMemoryGrantStore(initialGrants)
  const resolver = new RbacResolver(grantStore)
  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rbacResolver: opts.withResolver === false ? undefined : resolver,
    platform: platformStub(),
  }
  registerExperienceCoreHandlers(server, deps)
  return { handlers, pushes }
}

function ctxFor(userId: string | null, workspaceId: string | null = WORKSPACE_A, clientId = 'c1'): RequestContext {
  return { clientId, workspaceId, webContentsId: null, userId, sessionId: 's1' }
}

function readyState(id: string, version = 1): ExperienceState<{ value: string }> {
  return ready(id as any, { value: 'snapshot' }, version)
}

describe('experience handler registration', () => {
  it('registers all three core channels', () => {
    const { handlers } = createHarness()
    expect(handlers.has(EXPERIENCE_CHANNELS.EMIT)).toBe(true)
    expect(handlers.has(EXPERIENCE_CHANNELS.SUBSCRIBE)).toBe(true)
    expect(handlers.has(EXPERIENCE_CHANNELS.UNSUBSCRIBE)).toBe(true)
  })
})

describe('experience.subscribe', () => {
  it('returns a subscription id for a permitted reader', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'viewer')])
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor('u1'), { actorId: ACTOR_ID })
    expect(result.ok).toBe(true)
    expect(typeof result.subscriptionId).toBe('string')
    expect(result.subscriptionId.length).toBeGreaterThan(0)
    expect(result.actorId).toBe(ACTOR_ID)
  })

  it('rejects anonymous callers with permission-denied/no-user', async () => {
    const h = createHarness()
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor(null), { actorId: ACTOR_ID })
    expect(result.error).toBe('permission-denied')
    expect(result.reason).toBe('no-user')
  })

  it('rejects unrelated workspace readers with permission-denied/no-read-grant', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_B, 'viewer')])
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor('u1', WORKSPACE_A), { actorId: ACTOR_ID })
    expect(result.error).toBe('permission-denied')
    expect(result.reason).toBe('no-read-grant')
  })

  it('rejects missing or invalid input envelope', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'viewer')])
    const sub = h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!
    const bad1 = await sub(ctxFor('u1'), { actorId: '' })
    expect(bad1.error).toBe('invalid-argument')
    expect(bad1.reason).toBe('invalid-actor-id')
    const bad2 = await sub(ctxFor('u1'), null as any)
    expect(bad2.error).toBe('invalid-argument')
    expect(bad2.reason).toBe('invalid-input')
  })
})

describe('experience.emit', () => {
  it('returns ok:true with delivered:0 when no subscribers exist', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'owner')])
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), {
      actorId: ACTOR_ID, state: idle(ACTOR_ID as any),
    })
    expect(result.ok).toBe(true)
    expect(result.delivered).toBe(0)
  })

  it('rejects non-owner callers with permission-denied/no-owner-grant', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'viewer')])
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), {
      actorId: ACTOR_ID, state: idle(ACTOR_ID as any),
    })
    expect(result.error).toBe('permission-denied')
    expect(result.reason).toBe('no-owner-grant')
  })

  it('rejects anonymous emitters', async () => {
    const h = createHarness()
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor(null), {
      actorId: ACTOR_ID, state: idle(ACTOR_ID as any),
    })
    expect(result.error).toBe('permission-denied')
  })

  it('rejects invalid payload envelopes', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const emit = h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!
    const badState = await emit(ctxFor('u1'), { actorId: ACTOR_ID, state: { kind: 'bogus', id: ACTOR_ID } as any })
    expect(badState.error).toBe('invalid-argument')
    expect(badState.reason).toBe('invalid-state')
    const badActor = await emit(ctxFor('u1'), { actorId: '', state: idle(ACTOR_ID as any) })
    expect(badActor.error).toBe('invalid-argument')
    expect(badActor.reason).toBe('invalid-actor-id')
  })

  it('allows global-owner callers to emit on any workspace', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1', WORKSPACE_B), {
      actorId: ACTOR_ID, state: loading(ACTOR_ID as any, 100),
    })
    expect(result.ok).toBe(true)
  })
})

describe('experience.emit fan-out', () => {
  it('pushes a snapshot to a single subscriber via RpcServer.push', async () => {
    const h = createHarness([
      userGrant('u1', 'workspace', WORKSPACE_A, 'owner'),
      userGrant('u2', 'workspace', WORKSPACE_A, 'viewer'),
    ])
    await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor('u2', WORKSPACE_A, 'c-renderer'), { actorId: ACTOR_ID })
    const snapshot = readyState(ACTOR_ID, 7)
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), { actorId: ACTOR_ID, state: snapshot })
    expect(result.delivered).toBe(1)
    expect(h.pushes.length).toBe(1)
    expect(h.pushes[0]!.channel).toBe(EXPERIENCE_CHANNELS.EVENT)
    expect(h.pushes[0]!.target).toEqual({ to: 'client', clientId: 'c-renderer' })
    expect(h.pushes[0]!.args[0]).toEqual({ actorId: ACTOR_ID, state: snapshot })
  })

  it('fans out to every subscriber for the same actor', async () => {
    const h = createHarness([
      userGrant('u1', 'workspace', WORKSPACE_A, 'owner'),
      userGrant('u2', 'workspace', WORKSPACE_A, 'viewer'),
      userGrant('u3', 'workspace', WORKSPACE_A, 'viewer'),
    ])
    const sub = h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!
    await sub(ctxFor('u2', WORKSPACE_A, 'c-a'), { actorId: ACTOR_ID })
    await sub(ctxFor('u3', WORKSPACE_A, 'c-b'), { actorId: ACTOR_ID })
    await sub(ctxFor('u3', WORKSPACE_A, 'c-c'), { actorId: ACTOR_ID })
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), {
      actorId: ACTOR_ID, state: readyState(ACTOR_ID, 1),
    })
    expect(result.delivered).toBe(3)
    expect(h.pushes.length).toBe(3)
    const clientIds = h.pushes.map((p) => (p.target as { clientId: string }).clientId).sort()
    expect(clientIds).toEqual(['c-a', 'c-b', 'c-c'])
  })

  it('isolates subscribers across distinct actor ids', async () => {
    const h = createHarness([
      userGrant('u1', 'global', null, 'owner'),
      userGrant('u2', 'global', null, 'viewer'),
    ])
    const sub = h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!
    await sub(ctxFor('u2', WORKSPACE_A, 'c-a'), { actorId: ACTOR_ID })
    await sub(ctxFor('u2', WORKSPACE_A, 'c-b'), { actorId: OTHER_ACTOR_ID })
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), {
      actorId: ACTOR_ID, state: idle(ACTOR_ID as any),
    })
    expect(result.delivered).toBe(1)
    expect(h.pushes.length).toBe(1)
    expect((h.pushes[0]!.target as { clientId: string }).clientId).toBe('c-a')
  })

  it('subsequent emits keep fan-out stable until unsubscribed', async () => {
    const h = createHarness([
      userGrant('u1', 'global', null, 'owner'),
      userGrant('u2', 'global', null, 'viewer'),
    ])
    await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor('u2', WORKSPACE_A, 'c-x'), { actorId: ACTOR_ID })
    const emit = h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!
    await emit(ctxFor('u1'), { actorId: ACTOR_ID, state: readyState(ACTOR_ID, 1) })
    await emit(ctxFor('u1'), { actorId: ACTOR_ID, state: readyState(ACTOR_ID, 2) })
    await emit(ctxFor('u1'), { actorId: ACTOR_ID, state: readyState(ACTOR_ID, 3) })
    expect(h.pushes.length).toBe(3)
    const versions = h.pushes.map((p) => (p.args[0].state as { version: number }).version)
    expect(versions).toEqual([1, 2, 3])
  })
})

describe('experience.unsubscribe', () => {
  it('releases a known subscription and stops delivering pushes', async () => {
    const h = createHarness([
      userGrant('u1', 'global', null, 'owner'),
      userGrant('u2', 'global', null, 'viewer'),
    ])
    const sub = await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor('u2', WORKSPACE_A, 'c-1'), { actorId: ACTOR_ID })
    const emit = h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!
    await emit(ctxFor('u1'), { actorId: ACTOR_ID, state: idle(ACTOR_ID as any) })
    expect(h.pushes.length).toBe(1)

    const release = await h.handlers.get(EXPERIENCE_CHANNELS.UNSUBSCRIBE)!(ctxFor('u2'), {
      subscriptionId: sub.subscriptionId,
    })
    expect(release.ok).toBe(true)
    expect(release.released).toBe(true)

    const second = await emit(ctxFor('u1'), { actorId: ACTOR_ID, state: idle(ACTOR_ID as any) })
    expect(second.delivered).toBe(0)
    expect(h.pushes.length).toBe(1)
  })

  it('idempotent unsubscribe and rejects bad input', async () => {
    const h = createHarness()
    const unsub = h.handlers.get(EXPERIENCE_CHANNELS.UNSUBSCRIBE)!
    const unknown = await unsub(ctxFor('u1'), { subscriptionId: 'does-not-exist' })
    expect(unknown.ok).toBe(true)
    expect(unknown.released).toBe(false)
    const empty = await unsub(ctxFor('u1'), { subscriptionId: '' })
    expect(empty.error).toBe('invalid-argument')
    expect(empty.reason).toBe('invalid-subscription-id')
    const bad = await unsub(ctxFor('u1'), null as any)
    expect(bad.error).toBe('invalid-argument')
    expect(bad.reason).toBe('invalid-input')
  })

  it('two subscriptions for the same actor require two unsubscribe calls', async () => {
    const h = createHarness([
      userGrant('u1', 'global', null, 'owner'),
      userGrant('u2', 'global', null, 'viewer'),
    ])
    const sub = h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!
    const subA = await sub(ctxFor('u2', WORKSPACE_A, 'c-1'), { actorId: ACTOR_ID })
    const subB = await sub(ctxFor('u2', WORKSPACE_A, 'c-2'), { actorId: ACTOR_ID })
    expect(subA.subscriptionId).not.toBe(subB.subscriptionId)
    await h.handlers.get(EXPERIENCE_CHANNELS.UNSUBSCRIBE)!(ctxFor('u2'), { subscriptionId: subA.subscriptionId })
    const result = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), {
      actorId: ACTOR_ID, state: idle(ACTOR_ID as any),
    })
    expect(result.delivered).toBe(1)
  })
})

describe('rbac-not-configured fallbacks', () => {
  it('emit and subscribe both respond when no resolver is wired', async () => {
    const h = createHarness([], { withResolver: false })
    const emit = await h.handlers.get(EXPERIENCE_CHANNELS.EMIT)!(ctxFor('u1'), {
      actorId: ACTOR_ID, state: idle(ACTOR_ID as any),
    })
    expect(emit.error).toBe('rbac-not-configured')
    expect(emit.reason).toBe('no-rbac-resolver')
    const sub = await h.handlers.get(EXPERIENCE_CHANNELS.SUBSCRIBE)!(ctxFor('u1'), { actorId: ACTOR_ID })
    expect(sub.error).toBe('rbac-not-configured')
  })
})

describe('createExperienceBus', () => {
  it('tracks subscriber counts and describes by id', () => {
    const bus = createExperienceBus()
    const a = bus.subscribe(ACTOR_ID, () => {})
    bus.subscribe(ACTOR_ID, () => {})
    bus.subscribe(OTHER_ACTOR_ID, () => {})
    expect(bus.subscriberCount(ACTOR_ID)).toBe(2)
    expect(bus.subscriberCount(OTHER_ACTOR_ID)).toBe(1)
    expect(bus.subscriberCount('missing')).toBe(0)
    expect(bus.size()).toBe(3)
    expect(bus.describe(a.id)).toEqual({ id: a.id, actorId: ACTOR_ID })
    expect(bus.describe('nope')).toBeUndefined()
  })

  it('clear drops every subscription', () => {
    const bus = createExperienceBus()
    bus.subscribe(ACTOR_ID, () => {})
    bus.subscribe(OTHER_ACTOR_ID, () => {})
    expect(bus.size()).toBe(2)
    bus.clear()
    expect(bus.size()).toBe(0)
    expect(bus.subscriberCount(ACTOR_ID)).toBe(0)
  })

  it('isolates listener exceptions via the error sink', () => {
    const errors: Array<{ id: string; err: unknown }> = []
    const bus = createExperienceBus({ onListenerError: (id, err) => errors.push({ id, err }) })
    let goodCalls = 0
    bus.subscribe(ACTOR_ID, () => { throw new Error('boom') })
    bus.subscribe(ACTOR_ID, () => { goodCalls += 1 })
    const delivered = bus.emit(ACTOR_ID, idle(ACTOR_ID as any))
    expect(delivered).toBe(1)
    expect(goodCalls).toBe(1)
    expect(errors.length).toBe(1)
    expect((errors[0]!.err as Error).message).toBe('boom')
  })

  it('uses injected subscription id generator', () => {
    let i = 0
    const bus = createExperienceBus({ newSubscriptionId: () => { i += 1; return `injected-${i}` } })
    expect(bus.subscribe(ACTOR_ID, () => {}).id).toBe('injected-1')
    expect(bus.subscribe(ACTOR_ID, () => {}).id).toBe('injected-2')
  })
})
