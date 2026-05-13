/**
 * T243-rpc — admin RPC handler tests for the M.8 mission scheduler.
 *
 * Covers:
 *  - create/dispatchEvent/get/list happy paths
 *  - owner-gate rejection for mutating handlers
 *  - read-permission rejection for unrelated workspaces
 *  - validation envelopes for malformed inputs
 *  - missions-not-configured fallback when no scheduler is wired
 *
 * The harness reuses the same patterns as `roles.test.ts`: a stub
 * `RpcServer` that records `handle()` registrations, an
 * `InMemoryMissionStore` plus a real `MissionScheduler` (with fake
 * clock + uuid generator), and the canonical `InMemoryGrantStore` /
 * `RbacResolver` from `@rox-one/shared/auth`.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import {
  InMemoryGrantStore,
  RbacResolver,
  type RoleGrant,
} from '@rox-one/shared/auth'
import type {
  HandlerFn,
  RequestContext,
  RpcServer,
} from '@rox-one/server-core/transport'

import type { HandlerDeps } from '../../handler-deps'
import {
  InMemoryMissionStore,
  MissionScheduler,
  type UuidGenerator,
} from '../../../missions'
import { unsafeMissionId, type MissionId } from '../../../missions/mission-id.ts'
import { registerMissionsCoreHandlers } from '../missions'

const WORKSPACE_A = 'W_A'
const WORKSPACE_B = 'W_B'

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

interface Harness {
  handlers: Map<string, HandlerFn>
  scheduler: MissionScheduler
  clock: ReturnType<typeof fakeClock>
  grantStore: InMemoryGrantStore
}

function userGrant(
  actorId: string,
  scopeKind: RoleGrant['scopeKind'],
  scopeId: string | null,
  roleId: string,
): RoleGrant {
  return { roleId, actorKind: 'user', actorId, scopeKind, scopeId }
}

function createHarness(
  initialGrants: ReadonlyArray<RoleGrant> = [],
  options: { withScheduler?: boolean } = {},
): Harness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (channel, handler) => {
      handlers.set(channel, handler)
    },
    push: () => {},
    invokeClient: async () => undefined,
  }

  const clock = fakeClock('2026-05-14T00:00:00.000Z')
  const store = new InMemoryMissionStore()
  const scheduler = new MissionScheduler({ store, clock, uuid: fakeUuidGen() })

  const grantStore = new InMemoryGrantStore(initialGrants)
  const resolver = new RbacResolver(grantStore)

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rbacResolver: resolver,
    missionScheduler: options.withScheduler !== false ? scheduler : undefined,
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerMissionsCoreHandlers(server, deps)
  return { handlers, scheduler, clock, grantStore }
}

function ctxFor(
  userId: string | null,
  workspaceId: string | null = WORKSPACE_A,
): RequestContext {
  return {
    clientId: 'c1',
    workspaceId,
    webContentsId: null,
    userId,
    sessionId: 's1',
  }
}

const FAKE_MISSION_ID = unsafeMissionId('01977a3b-5c4d-7abc-9def-000000000001')

describe('missions.create', () => {
  it('mints a Pending mission for a workspace owner', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1'))
    expect(result.ok).toBe(true)
    expect(result.mission.id).toBe(FAKE_MISSION_ID)
    expect(result.mission.state.kind).toBe('Pending')
  })

  it('persists the mission in the scheduler store', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1'))
    expect(result.ok).toBe(true)
    const got = await h.scheduler.get(result.mission.id as MissionId)
    expect(got?.state.kind).toBe('Pending')
  })

  it('accepts global-owner regardless of request workspaceId', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1', WORKSPACE_B))
    expect(result.ok).toBe(true)
  })

  it('rejects anonymous callers', async () => {
    const h = createHarness()
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor(null))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-user' })
  })

  it('rejects callers with no owner grant', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'editor')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1'))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects owners of a different workspace', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_B, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1', WORKSPACE_A))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('reports missions-not-configured when no scheduler is wired', async () => {
    const h = createHarness(
      [userGrant('u1', 'global', null, 'owner')],
      { withScheduler: false },
    )
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1'))
    expect(result).toEqual({ error: 'missions-not-configured', reason: 'no-mission-scheduler' })
  })
})

describe('missions.dispatchEvent — happy paths', () => {
  it('drives Pending -> Running via Start event', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const created = await create(ctxFor('u1'))
    h.clock.advance(1_000)
    const result = await dispatch(ctxFor('u1'), {
      id: created.mission.id,
      event: { kind: 'Start' },
    })
    expect(result.ok).toBe(true)
    expect(result.mission.state.kind).toBe('Running')
  })

  it('drives Running -> Completed with output payload', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const created = await create(ctxFor('u1'))
    await dispatch(ctxFor('u1'), { id: created.mission.id, event: { kind: 'Start' } })
    h.clock.advance(5_000)
    const completed = await dispatch(ctxFor('u1'), {
      id: created.mission.id,
      event: { kind: 'Complete', output: 'all-clear' },
    })
    expect(completed.ok).toBe(true)
    expect(completed.mission.state.kind).toBe('Completed')
    if (completed.mission.state.kind === 'Completed') {
      expect(completed.mission.state.output).toBe('all-clear')
    }
  })
})

describe('missions.dispatchEvent — errors', () => {
  it('returns mission-not-found for unknown id', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const ghost = unsafeMissionId('01977a3b-5c4d-7abc-9def-deadbeefcafe')
    const result = await dispatch(ctxFor('u1'), { id: ghost, event: { kind: 'Start' } })
    expect(result.error).toBe('mission-not-found')
    expect(result.reason).toBe(ghost)
  })

  it('returns invalid-transition on an illegal event', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const created = await create(ctxFor('u1'))
    const result = await dispatch(ctxFor('u1'), {
      id: created.mission.id,
      event: { kind: 'Resume' },
    })
    expect(result.error).toBe('invalid-transition')
    expect(result.reason).toBe('illegal_transition')
    expect(result.from).toBe('Pending')
    expect(result.event).toBe('Resume')
  })

  it('rejects malformed input envelope', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1'), null)
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-input' })
  })

  it('rejects non-uuid mission ids', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1'), {
      id: 'not-a-uuid',
      event: { kind: 'Start' },
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-mission-id' })
  })

  it('rejects missing event payload', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1'), { id: FAKE_MISSION_ID, event: null })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-event' })
  })

  it('rejects unknown event kind', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1'), {
      id: FAKE_MISSION_ID,
      event: { kind: 'Detonate' },
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-event-kind' })
  })
})

describe('missions.dispatchEvent — owner gating', () => {
  it('rejects callers without owner grant', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_A, 'editor')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1'), {
      id: FAKE_MISSION_ID,
      event: { kind: 'Start' },
    })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects callers with owner on a different workspace', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_B, 'owner')])
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1', WORKSPACE_A), {
      id: FAKE_MISSION_ID,
      event: { kind: 'Start' },
    })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('reports missions-not-configured when no scheduler is wired', async () => {
    const h = createHarness(
      [userGrant('u1', 'global', null, 'owner')],
      { withScheduler: false },
    )
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const result = await dispatch(ctxFor('u1'), {
      id: FAKE_MISSION_ID,
      event: { kind: 'Start' },
    })
    expect(result).toEqual({ error: 'missions-not-configured', reason: 'no-mission-scheduler' })
  })
})

describe('missions.get', () => {
  it('returns a mission visible to a workspace reader', async () => {
    // Caller holds a viewer grant on WORKSPACE_A; the scheduler is
    // populated by a global owner from a separate handler call.
    const h = createHarness([
      userGrant('admin', 'global', null, 'owner'),
      userGrant('reader', 'workspace', WORKSPACE_A, 'viewer'),
    ])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const created = await create(ctxFor('admin'))
    const result = await get(ctxFor('reader'), created.mission.id)
    expect(result.ok).toBe(true)
    expect(result.mission.id).toBe(created.mission.id)
  })

  it('returns mission-not-found for unknown ids', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const ghost = unsafeMissionId('01977a3b-5c4d-7abc-9def-000000000099')
    const result = await get(ctxFor('u1'), ghost)
    expect(result).toEqual({ error: 'mission-not-found', reason: ghost })
  })

  it('rejects anonymous callers', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const result = await get(ctxFor(null), FAKE_MISSION_ID)
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-user' })
  })

  it('rejects callers with no grants', async () => {
    const h = createHarness()
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const result = await get(ctxFor('u_stranger'), FAKE_MISSION_ID)
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-read-grant' })
  })

  it('rejects callers whose grant covers a different workspace', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_B, 'viewer')])
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const result = await get(ctxFor('u1', WORKSPACE_A), FAKE_MISSION_ID)
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-read-grant' })
  })

  it('rejects malformed mission ids', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const result = await get(ctxFor('u1'), 'bogus')
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-mission-id' })
  })

  it('reports missions-not-configured when no scheduler is wired', async () => {
    const h = createHarness(
      [userGrant('u1', 'global', null, 'owner')],
      { withScheduler: false },
    )
    const get = h.handlers.get(RPC_CHANNELS.missions.GET)!
    const result = await get(ctxFor('u1'), FAKE_MISSION_ID)
    expect(result).toEqual({ error: 'missions-not-configured', reason: 'no-mission-scheduler' })
  })
})

describe('missions.list', () => {
  it('returns all missions for a workspace reader', async () => {
    const h = createHarness([
      userGrant('admin', 'global', null, 'owner'),
      userGrant('reader', 'workspace', WORKSPACE_A, 'viewer'),
    ])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    await create(ctxFor('admin'))
    await create(ctxFor('admin'))
    const result = await list(ctxFor('reader'))
    expect(result.ok).toBe(true)
    expect(result.missions).toHaveLength(2)
  })

  it('applies the `kinds` filter when provided', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const dispatch = h.handlers.get(RPC_CHANNELS.missions.DISPATCH_EVENT)!
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const a = await create(ctxFor('u1'))
    await create(ctxFor('u1'))
    await dispatch(ctxFor('u1'), { id: a.mission.id, event: { kind: 'Start' } })
    const onlyRunning = await list(ctxFor('u1'), { kinds: ['Running'] })
    expect(onlyRunning.ok).toBe(true)
    expect(onlyRunning.missions).toHaveLength(1)
    expect(onlyRunning.missions[0].state.kind).toBe('Running')
    const onlyPending = await list(ctxFor('u1'), { kinds: ['Pending'] })
    expect(onlyPending.missions).toHaveLength(1)
    expect(onlyPending.missions[0].state.kind).toBe('Pending')
  })

  it('returns an empty array when no missions exist', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1'))
    expect(result.ok).toBe(true)
    expect(result.missions).toEqual([])
  })

  it('rejects callers whose grants do not cover the workspace', async () => {
    const h = createHarness([userGrant('u1', 'workspace', WORKSPACE_B, 'viewer')])
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1', WORKSPACE_A))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-read-grant' })
  })

  it('rejects anonymous callers', async () => {
    const h = createHarness()
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor(null))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-user' })
  })

  it('rejects non-array kinds', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1'), { kinds: 'Running' })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-kinds' })
  })

  it('rejects unknown state kinds in filter', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1'), { kinds: ['Exploded'] })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-kind' })
  })

  it('rejects non-object filter', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1'), 'all')
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-filter' })
  })

  it('reports missions-not-configured when no scheduler is wired', async () => {
    const h = createHarness(
      [userGrant('u1', 'global', null, 'owner')],
      { withScheduler: false },
    )
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1'))
    expect(result).toEqual({ error: 'missions-not-configured', reason: 'no-mission-scheduler' })
  })
})

describe('missions admin — global owner shortcuts', () => {
  it('global owner can create on any workspace context', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = h.handlers.get(RPC_CHANNELS.missions.CREATE)!
    const result = await create(ctxFor('u1', null))
    expect(result.ok).toBe(true)
  })

  it('global owner can list across any workspace context', async () => {
    const h = createHarness([userGrant('u1', 'global', null, 'owner')])
    const list = h.handlers.get(RPC_CHANNELS.missions.LIST)!
    const result = await list(ctxFor('u1', WORKSPACE_B))
    expect(result.ok).toBe(true)
  })
})

describe('missions admin — registered channels', () => {
  it('registers exactly the four documented channels', () => {
    const h = createHarness()
    expect(h.handlers.size).toBe(4)
    expect(h.handlers.has(RPC_CHANNELS.missions.CREATE)).toBe(true)
    expect(h.handlers.has(RPC_CHANNELS.missions.DISPATCH_EVENT)).toBe(true)
    expect(h.handlers.has(RPC_CHANNELS.missions.GET)).toBe(true)
    expect(h.handlers.has(RPC_CHANNELS.missions.LIST)).toBe(true)
  })
})
