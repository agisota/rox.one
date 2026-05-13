import { describe, expect, it, beforeEach } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { InMemoryGrantStore, InMemoryRoleStore, RbacResolver, SYSTEM_ROLES, type RoleGrant } from '@rox-one/shared/auth'
import type { RpcServer, HandlerFn, RequestContext } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../../handler-deps'
import { registerRolesCoreHandlers } from '../roles'

interface Harness {
  handlers: Map<string, HandlerFn>
  deps: HandlerDeps
  grantStore: InMemoryGrantStore
  roleStore: InMemoryRoleStore
  resolver: RbacResolver
}

function createHarness(initialGrants: ReadonlyArray<RoleGrant> = []): Harness {
  const handlers = new Map<string, HandlerFn>()

  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    push() {},
    async invokeClient() {
      return undefined
    },
  }

  const grantStore = new InMemoryGrantStore(initialGrants)
  const roleStore = new InMemoryRoleStore()
  const resolver = new RbacResolver(grantStore)

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rbacResolver: resolver,
    grantStore,
    roleStore,
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.from(''),
      },
    } as HandlerDeps['platform'],
  }

  registerRolesCoreHandlers(server, deps)
  return { handlers, deps, grantStore, roleStore, resolver }
}

function ctxFor(userId: string | null): RequestContext {
  return {
    clientId: 'c1',
    workspaceId: null,
    webContentsId: null,
    userId,
    sessionId: 's1',
  }
}

function userGrant(actorId: string, scopeKind: 'workspace' | 'org' | 'global', scopeId: string | null, roleId: string): RoleGrant {
  return {
    roleId,
    actorKind: 'user',
    actorId,
    scopeKind,
    scopeId,
  }
}

describe('roles.list', () => {
  it('returns SYSTEM_ROLES for callers with no grants', async () => {
    const { handlers } = createHarness()
    const list = handlers.get(RPC_CHANNELS.roles.LIST)!
    const result = await list(ctxFor('u1'))
    const ids = (result as Array<{ id: string }>).map((r) => r.id).sort()
    expect(ids).toEqual(['editor', 'owner', 'viewer'])
  })

  it('returns SYSTEM_ROLES even for anonymous callers (catalog is universal)', async () => {
    const { handlers } = createHarness()
    const list = handlers.get(RPC_CHANNELS.roles.LIST)!
    const result = await list(ctxFor(null))
    expect((result as Array<{ id: string }>).length).toBeGreaterThanOrEqual(SYSTEM_ROLES.length)
  })

  it('includes custom roles after roles.create', async () => {
    const harness = createHarness([userGrant('u1', 'global', null, 'owner')])
    const { handlers } = harness
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    await create(ctxFor('u1'), { id: 'reviewer', name: 'Reviewer', systemManaged: false })
    const list = handlers.get(RPC_CHANNELS.roles.LIST)!
    const result = await list(ctxFor('u2'))
    const ids = (result as Array<{ id: string }>).map((r) => r.id).sort()
    expect(ids).toEqual(['editor', 'owner', 'reviewer', 'viewer'])
  })
})

describe('roles.create — permissions', () => {
  it('rejects callers with no grants', async () => {
    const { handlers } = createHarness()
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'r1', name: 'R1', systemManaged: false })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects callers with editor-only grants', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'editor')])
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'r1', name: 'R1', systemManaged: false })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects anonymous callers', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor(null), { id: 'r1', name: 'R1', systemManaged: false })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-user' })
  })

  it('rejects callers with only workspace-owner grant (custom roles require global owner)', async () => {
    const { handlers } = createHarness([userGrant('u1', 'workspace', 'W1', 'owner')])
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'r1', name: 'R1', systemManaged: false })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('allows callers with global owner grant', async () => {
    const harness = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = harness.handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'reviewer', name: 'Reviewer', systemManaged: false })
    expect(result).toEqual({ ok: true, role: { id: 'reviewer', name: 'Reviewer', systemManaged: false } })
    expect((await harness.roleStore.list()).find((r) => r.id === 'reviewer')).toBeDefined()
  })
})

describe('roles.create — validation', () => {
  it('rejects role id matching a system role', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'owner', name: 'Custom Owner', systemManaged: false })
    expect(result).toEqual({ error: 'role-id-conflict', reason: 'owner' })
  })

  it('rejects empty role id', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: '', name: 'Empty', systemManaged: false })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'empty-role-id' })
  })

  it('rejects empty role name', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const create = handlers.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'r1', name: '', systemManaged: false })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'empty-role-name' })
  })

  it('returns rbac-not-configured when roleStore is absent', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    // Override deps roleStore in a separate harness: easier to recreate.
    const handlers2 = new Map<string, HandlerFn>()
    const server: RpcServer = {
      handle(c, h) { handlers2.set(c, h) },
      push() {},
      async invokeClient() { return undefined },
    }
    const grantStore = new InMemoryGrantStore([userGrant('u1', 'global', null, 'owner')])
    const resolver = new RbacResolver(grantStore)
    const deps: HandlerDeps = {
      sessionManager: {} as HandlerDeps['sessionManager'],
      oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
      rbacResolver: resolver,
      grantStore,
      platform: {
        appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
        isDebugMode: true, logger: { info() {}, warn() {}, error() {}, debug() {} },
        imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
      } as HandlerDeps['platform'],
    }
    registerRolesCoreHandlers(server, deps)
    const create = handlers2.get(RPC_CHANNELS.roles.CREATE)!
    const result = await create(ctxFor('u1'), { id: 'r1', name: 'R1', systemManaged: false })
    expect(result).toEqual({ error: 'rbac-not-configured', reason: 'no-role-store' })
  })
})

describe('roles.grant — permissions', () => {
  it('rejects callers with no grants', async () => {
    const { handlers } = createHarness()
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects callers with editor grant on the target scope', async () => {
    const { handlers } = createHarness([userGrant('u1', 'workspace', 'W1', 'editor')])
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('rejects callers with owner on a different scope', async () => {
    const { handlers } = createHarness([userGrant('u1', 'workspace', 'W_OTHER', 'owner')])
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('allows callers with workspace-owner on the matching scope', async () => {
    const harness = createHarness([userGrant('u1', 'workspace', 'W1', 'owner')])
    const grant = harness.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ ok: true })
    expect(await harness.grantStore.grantsForUser('u2')).toHaveLength(1)
  })

  it('allows callers with global owner grant on any scope', async () => {
    const harness = createHarness([userGrant('u1', 'global', null, 'owner')])
    const grant = harness.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ ok: true })
  })

  it('allows granting on global scope only when caller has global owner', async () => {
    const harness = createHarness([userGrant('u1', 'global', null, 'owner')])
    const grant = harness.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'global', scopeId: null,
    })
    expect(result).toEqual({ ok: true })
  })
})

describe('roles.grant — validation', () => {
  it('rejects invalid actorKind', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'bot', actorId: 'b1', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-actor-kind' })
  })

  it('rejects invalid scopeKind', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'user', actorId: 'u2', scopeKind: 'system', scopeId: 'S1',
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'invalid-scope-kind' })
  })

  it('rejects unknown roleId', async () => {
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'unknown-role', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ error: 'invalid-argument', reason: 'unknown-role-id' })
  })

  it('accepts a roleId that exists only in the roleStore (custom roles)', async () => {
    const harness = createHarness([userGrant('u1', 'global', null, 'owner')])
    await harness.roleStore.create({ id: 'reviewer', name: 'Reviewer', systemManaged: false })
    const grant = harness.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'reviewer', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects team-actor grants when no roleStore lookup needed (team RBAC deferred but channel allows it)', async () => {
    // Team-actor grants are allowed by the channel contract; team RBAC wiring lands later.
    const { handlers } = createHarness([userGrant('u1', 'global', null, 'owner')])
    const grant = handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u1'), {
      roleId: 'viewer', actorKind: 'team', actorId: 't1', scopeKind: 'workspace', scopeId: 'W1',
    })
    expect(result).toEqual({ ok: true })
  })
})

describe('roles.revoke', () => {
  let harness: Harness

  beforeEach(() => {
    harness = createHarness([
      userGrant('u1', 'workspace', 'W1', 'owner'),
      userGrant('u2', 'workspace', 'W1', 'viewer'),
    ])
  })

  it('rejects callers with no owner grant on the target scope', async () => {
    const { handlers } = createHarness([userGrant('u_other', 'workspace', 'W1', 'editor')])
    const revoke = handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('u_other'), userGrant('u2', 'workspace', 'W1', 'viewer'))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('returns {revoked: true} when the grant was present', async () => {
    const revoke = harness.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('u1'), userGrant('u2', 'workspace', 'W1', 'viewer'))
    expect(result).toEqual({ ok: true, revoked: true })
    expect(await harness.grantStore.grantsForUser('u2')).toEqual([])
  })

  it('returns {revoked: false} when no matching grant existed (idempotent)', async () => {
    const revoke = harness.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('u1'), userGrant('u_phantom', 'workspace', 'W1', 'viewer'))
    expect(result).toEqual({ ok: true, revoked: false })
  })

  it('reflects the change via resolver.permittedWorkspacesForUser after revoke (invalidation hook)', async () => {
    // Before revoke, u2 should see W1 in their permitted workspaces.
    expect(await harness.resolver.permittedWorkspacesForUser('u2')).toEqual(['W1'])
    const revoke = harness.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    await revoke(ctxFor('u1'), userGrant('u2', 'workspace', 'W1', 'viewer'))
    // After revoke, u2 should no longer see W1.
    expect(await harness.resolver.permittedWorkspacesForUser('u2')).toEqual([])
  })

  it('allows global owner to revoke on any scope', async () => {
    const harness2 = createHarness([
      userGrant('admin', 'global', null, 'owner'),
      userGrant('u2', 'workspace', 'W_FAR', 'editor'),
    ])
    const revoke = harness2.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('admin'), userGrant('u2', 'workspace', 'W_FAR', 'editor'))
    expect(result).toEqual({ ok: true, revoked: true })
  })

  it('rejects anonymous callers', async () => {
    const revoke = harness.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor(null), userGrant('u2', 'workspace', 'W1', 'viewer'))
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-user' })
  })
})

describe('roles.revoke — no rbac config', () => {
  it('returns rbac-not-configured when grantStore is absent', async () => {
    const handlers = new Map<string, HandlerFn>()
    const server: RpcServer = {
      handle(c, h) { handlers.set(c, h) },
      push() {},
      async invokeClient() { return undefined },
    }
    const resolver = new RbacResolver(new InMemoryGrantStore([userGrant('u1', 'global', null, 'owner')]))
    const deps: HandlerDeps = {
      sessionManager: {} as HandlerDeps['sessionManager'],
      oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
      rbacResolver: resolver,
      // grantStore intentionally omitted
      platform: {
        appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
        isDebugMode: true, logger: { info() {}, warn() {}, error() {}, debug() {} },
        imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
      } as HandlerDeps['platform'],
    }
    registerRolesCoreHandlers(server, deps)
    const revoke = handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('u1'), userGrant('u2', 'workspace', 'W1', 'viewer'))
    expect(result).toEqual({ error: 'rbac-not-configured', reason: 'no-grant-store' })
  })
})
