/**
 * T246: AuditProducer wiring in the RBAC admin RPC handlers.
 *
 * Scoped to audit side-effects — broad permission/validation matrix
 * lives in `roles.test.ts`. Verifies grant/revoke emit-once on
 * success, no-emit on permission-denied, validation, idempotent
 * no-op revoke, and the optional-producer (backward-compat) contract.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import {
  InMemoryGrantStore,
  InMemoryRoleStore,
  RbacResolver,
  type RoleGrant,
} from '@rox-one/shared/auth'
import {
  type AuditEvent,
  type AuditSink,
  createAuditProducer,
  createStructuredLogger,
} from '@rox-one/shared/observability'
import type { RpcServer, HandlerFn, RequestContext } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../../handler-deps'
import { registerRolesCoreHandlers } from '../roles'

const FIXED_NOW = new Date('2026-05-13T12:00:00.000Z')
const fixedClock = (): Date => FIXED_NOW

interface AuditHarness {
  handlers: Map<string, HandlerFn>
  grantStore: InMemoryGrantStore
  roleStore: InMemoryRoleStore
  audit: AuditEvent[]
}

function createAuditHarness(
  initialGrants: ReadonlyArray<RoleGrant> = [],
  options: { withProducer?: boolean } = {},
): AuditHarness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (c, h) => { handlers.set(c, h) },
    push: () => {},
    invokeClient: async () => undefined,
  }

  const audit: AuditEvent[] = []
  const sink: AuditSink = (e) => { audit.push(e) }
  const logger = createStructuredLogger({ sink: () => {}, threshold: 'trace', clock: fixedClock })
  const auditProducer = options.withProducer !== false
    ? createAuditProducer({ sink, logger, clock: fixedClock })
    : undefined

  const grantStore = new InMemoryGrantStore(initialGrants)
  const roleStore = new InMemoryRoleStore()
  const resolver = new RbacResolver(grantStore)

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rbacResolver: resolver,
    grantStore,
    roleStore,
    auditProducer,
    platform: {
      appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerRolesCoreHandlers(server, deps)
  return { handlers, grantStore, roleStore, audit }
}

const ctxFor = (userId: string | null): RequestContext => ({
  clientId: 'c1', workspaceId: null, webContentsId: null, userId, sessionId: 's1',
})

const userGrant = (
  actorId: string,
  scopeKind: RoleGrant['scopeKind'],
  scopeId: string | null,
  roleId: string,
): RoleGrant => ({ roleId, actorKind: 'user', actorId, scopeKind, scopeId })

describe('roles.grant — audit emission', () => {
  it('emits exactly one RoleGranted event on successful grant', async () => {
    const h = createAuditHarness([userGrant('admin', 'global', null, 'owner')])
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ ok: true })
    expect(h.audit).toHaveLength(1)
    const event = h.audit[0]!
    expect(event.kind).toBe('RoleGranted')
    expect(event.actor).toEqual({ type: 'user', id: 'admin' })
    expect(event.subject).toEqual({ type: 'user', id: 'u2' })
    expect(event.scope).toEqual({ kind: 'workspace', workspaceId: 'W1' })
    if (event.kind === 'RoleGranted') expect(event.roleName).toBe('Viewer')
    expect(typeof event.ts).toBe('string')
    expect(typeof event.correlationId).toBe('string')
  })

  it('maps global-scope grants onto AuditScope.global', async () => {
    const h = createAuditHarness([userGrant('admin', 'global', null, 'owner')])
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    await grant(ctxFor('admin'), userGrant('u2', 'global', null, 'viewer'))

    expect(h.audit).toHaveLength(1)
    expect(h.audit[0]!.scope).toEqual({ kind: 'global' })
  })

  it('resolves a custom role name from the role store for the audit payload', async () => {
    const h = createAuditHarness([userGrant('admin', 'global', null, 'owner')])
    await h.roleStore.create({ id: 'reviewer', name: 'Code Reviewer', systemManaged: false })
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'reviewer'))

    expect(h.audit).toHaveLength(1)
    const event = h.audit[0]!
    if (event.kind === 'RoleGranted') expect(event.roleName).toBe('Code Reviewer')
  })

  it('does not emit when the grant is rejected on permissions', async () => {
    const h = createAuditHarness([userGrant('u_other', 'workspace', 'W1', 'editor')])
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('u_other'), userGrant('u2', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    expect(h.audit).toEqual([])
  })

  it('does not emit when the grant is rejected on validation', async () => {
    const h = createAuditHarness([userGrant('admin', 'global', null, 'owner')])
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('admin'), {
      roleId: 'unknown', actorKind: 'user', actorId: 'u2', scopeKind: 'workspace', scopeId: 'W1',
    })

    expect(result).toEqual({ error: 'invalid-argument', reason: 'unknown-role-id' })
    expect(h.audit).toEqual([])
  })

  it('is a no-op when auditProducer is omitted (backward compat)', async () => {
    const h = createAuditHarness(
      [userGrant('admin', 'global', null, 'owner')],
      { withProducer: false },
    )
    const grant = h.handlers.get(RPC_CHANNELS.roles.GRANT)!
    const result = await grant(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ ok: true })
    expect(h.audit).toEqual([])
    expect(await h.grantStore.grantsForUser('u2')).toHaveLength(1)
  })
})

describe('roles.revoke — audit emission', () => {
  it('emits exactly one RoleRevoked event when a grant is removed', async () => {
    const h = createAuditHarness([
      userGrant('admin', 'global', null, 'owner'),
      userGrant('u2', 'workspace', 'W1', 'viewer'),
    ])
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ ok: true, revoked: true })
    expect(h.audit).toHaveLength(1)
    const event = h.audit[0]!
    expect(event.kind).toBe('RoleRevoked')
    expect(event.actor).toEqual({ type: 'user', id: 'admin' })
    expect(event.subject).toEqual({ type: 'user', id: 'u2' })
    expect(event.scope).toEqual({ kind: 'workspace', workspaceId: 'W1' })
    if (event.kind === 'RoleRevoked') expect(event.roleName).toBe('Viewer')
  })

  it('does not emit when the revoke is an idempotent no-op', async () => {
    const h = createAuditHarness([userGrant('admin', 'global', null, 'owner')])
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('admin'), userGrant('u_phantom', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ ok: true, revoked: false })
    expect(h.audit).toEqual([])
  })

  it('does not emit when the revoke is rejected on permissions', async () => {
    const h = createAuditHarness([userGrant('u_other', 'workspace', 'W1', 'editor')])
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('u_other'), userGrant('u2', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    expect(h.audit).toEqual([])
  })

  it('is a no-op when auditProducer is omitted (backward compat)', async () => {
    const h = createAuditHarness(
      [
        userGrant('admin', 'global', null, 'owner'),
        userGrant('u2', 'workspace', 'W1', 'viewer'),
      ],
      { withProducer: false },
    )
    const revoke = h.handlers.get(RPC_CHANNELS.roles.REVOKE)!
    const result = await revoke(ctxFor('admin'), userGrant('u2', 'workspace', 'W1', 'viewer'))

    expect(result).toEqual({ ok: true, revoked: true })
    expect(h.audit).toEqual([])
  })
})
