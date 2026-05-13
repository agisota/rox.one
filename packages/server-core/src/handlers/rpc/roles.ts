/**
 * RBAC roles admin RPC handlers (M.2 T227 part 2).
 *
 * Exposes the four channels declared in `RPC_CHANNELS.roles`:
 *
 *  - `roles.list`   — universally readable. Returns `SYSTEM_ROLES` plus any
 *                     custom roles in the optional `RoleStore`. Anonymous
 *                     callers are allowed because the catalog is the
 *                     vocabulary that drives the admin UI label list.
 *  - `roles.create` — global-owner-only. Custom roles cannot reuse a
 *                     `SYSTEM_ROLES` id. Empty id/name are rejected.
 *  - `roles.grant`  — owner-on-target-scope (or global owner). Validates
 *                     `actorKind`, `scopeKind`, and that `roleId` matches a
 *                     known system or custom role.
 *  - `roles.revoke` — owner-on-target-scope (or global owner). Idempotent —
 *                     returns `{revoked: false}` when nothing matched.
 *                     Invalidates the resolver cache for the affected user.
 *
 * The handlers return structured `{error, reason}` objects on failure
 * rather than throwing, matching the contract test
 * (`__tests__/roles.test.ts`). Success returns `{ok: true, ...}`.
 *
 * Hosts that have not yet adopted RBAC wiring may leave
 * `HandlerDeps.roleStore` / `grantStore` / `rbacResolver` undefined.
 * `roles.list` then falls back to `SYSTEM_ROLES`; the mutating channels
 * respond with `{error: 'rbac-not-configured'}`.
 */

import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { SYSTEM_ROLES, type Role, type RoleGrant } from '@rox-one/shared/auth'
import type { AuditEventInput, AuditScope } from '@rox-one/shared/observability'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import type { RequestContext } from '../../transport/types'

export const CORE_HANDLED_CHANNELS = [
  RPC_CHANNELS.roles.LIST,
  RPC_CHANNELS.roles.CREATE,
  RPC_CHANNELS.roles.GRANT,
  RPC_CHANNELS.roles.REVOKE,
] as const

const VALID_ACTOR_KINDS = new Set<RoleGrant['actorKind']>(['user', 'team'])
const VALID_SCOPE_KINDS = new Set<RoleGrant['scopeKind']>(['workspace', 'org', 'global'])

type ErrorResult = { error: string; reason: string }

/**
 * Owner-grant scope check used by every mutating handler.
 *
 * The caller may mutate a target scope when they hold:
 *  - a `'global'` owner grant (always allowed), OR
 *  - a `scopeKind`-matching owner grant whose `scopeId` matches.
 *
 * Returns `null` on success, or an `{error, reason}` ErrorResult that the
 * caller should hand back to the RPC client.
 */
/**
 * Map a `RoleGrant` scope (workspace/org/global with nullable scopeId) onto
 * the canonical `AuditScope` envelope. `org` scopes are recorded as
 * `workspace` because the audit taxonomy collapses non-global identifiers
 * into a single `workspaceId` slot (the org id is the relevant identifier
 * for downstream filtering). `global` and any null scopeId fall back to
 * `{kind: 'global'}`.
 */
function grantScopeToAuditScope(grant: RoleGrant): AuditScope {
  if (grant.scopeKind === 'global' || grant.scopeId === null) {
    return { kind: 'global' }
  }
  return { kind: 'workspace', workspaceId: grant.scopeId }
}

/**
 * Resolve a human-readable role name for the audit payload. System roles
 * have stable display names; custom roles fall back to the role id when the
 * role catalog is absent or the role is unknown. The audit producer only
 * requires a non-empty string.
 */
async function resolveRoleName(deps: HandlerDeps, roleId: string): Promise<string> {
  const systemRole = SYSTEM_ROLES.find((r) => r.id === roleId)
  if (systemRole) return systemRole.name
  if (deps.roleStore) {
    const customRoles = await deps.roleStore.list()
    const match = customRoles.find((r) => r.id === roleId)
    if (match) return match.name
  }
  return roleId
}

async function checkOwnerOnScope(
  deps: HandlerDeps,
  ctx: RequestContext,
  scopeKind: RoleGrant['scopeKind'],
  scopeId: string | null,
): Promise<ErrorResult | null> {
  if (!ctx.userId) {
    return { error: 'permission-denied', reason: 'no-user' }
  }
  if (!deps.rbacResolver) {
    return { error: 'rbac-not-configured', reason: 'no-rbac-resolver' }
  }
  const ownerGrants = await deps.rbacResolver.ownerGrantsForUser(ctx.userId)
  const allowed = ownerGrants.some((grant) =>
    grant.scopeKind === 'global'
    || (grant.scopeKind === scopeKind && grant.scopeId === scopeId),
  )
  if (!allowed) {
    return { error: 'permission-denied', reason: 'no-owner-grant' }
  }
  return null
}

export function registerRolesCoreHandlers(server: RpcServer, deps: HandlerDeps): void {
  // ----------------------------------------------------------------------
  // roles.list — universally readable catalog
  // ----------------------------------------------------------------------
  server.handle(RPC_CHANNELS.roles.LIST, async (_ctx: RequestContext) => {
    if (!deps.roleStore) return [...SYSTEM_ROLES]
    return deps.roleStore.list()
  })

  // ----------------------------------------------------------------------
  // roles.create — global-owner-only, system-role id collision rejected
  // ----------------------------------------------------------------------
  server.handle(RPC_CHANNELS.roles.CREATE, async (ctx: RequestContext, role: Role) => {
    // Permission: must be global owner. Workspace owner is NOT sufficient
    // for catalog mutations.
    const denied = await checkOwnerOnScope(deps, ctx, 'global', null)
    if (denied) return denied

    if (!deps.roleStore) {
      return { error: 'rbac-not-configured', reason: 'no-role-store' }
    }

    // Validation.
    if (!role || typeof role.id !== 'string' || role.id.length === 0) {
      return { error: 'invalid-argument', reason: 'empty-role-id' }
    }
    if (typeof role.name !== 'string' || role.name.length === 0) {
      return { error: 'invalid-argument', reason: 'empty-role-name' }
    }
    if (SYSTEM_ROLES.some((systemRole) => systemRole.id === role.id)) {
      return { error: 'role-id-conflict', reason: role.id }
    }

    await deps.roleStore.create(role)
    return { ok: true, role }
  })

  // ----------------------------------------------------------------------
  // roles.grant — owner-on-target-scope (or global owner)
  // ----------------------------------------------------------------------
  server.handle(RPC_CHANNELS.roles.GRANT, async (ctx: RequestContext, grant: RoleGrant) => {
    // Argument validation runs first so we can reject malformed grants
    // before they hit the permission check. (This matches the test
    // expectation — invalid-argument cases use a valid caller.)
    if (!grant || typeof grant !== 'object') {
      return { error: 'invalid-argument', reason: 'invalid-grant' }
    }
    if (!VALID_ACTOR_KINDS.has(grant.actorKind)) {
      return { error: 'invalid-argument', reason: 'invalid-actor-kind' }
    }
    if (!VALID_SCOPE_KINDS.has(grant.scopeKind)) {
      return { error: 'invalid-argument', reason: 'invalid-scope-kind' }
    }
    if (typeof grant.roleId !== 'string' || grant.roleId.length === 0) {
      return { error: 'invalid-argument', reason: 'unknown-role-id' }
    }

    // Role id must exist in either SYSTEM_ROLES or the custom RoleStore.
    let roleIdKnown = SYSTEM_ROLES.some((r) => r.id === grant.roleId)
    if (!roleIdKnown && deps.roleStore) {
      const allRoles = await deps.roleStore.list()
      roleIdKnown = allRoles.some((r) => r.id === grant.roleId)
    }
    if (!roleIdKnown) {
      return { error: 'invalid-argument', reason: 'unknown-role-id' }
    }

    // Permission: caller must own the target scope (or global).
    const denied = await checkOwnerOnScope(deps, ctx, grant.scopeKind, grant.scopeId)
    if (denied) return denied

    if (!deps.grantStore) {
      return { error: 'rbac-not-configured', reason: 'no-grant-store' }
    }
    await deps.grantStore.grant(grant)

    // Audit emission. The producer is optional — callers that have not
    // wired observability remain unaffected. We only emit on the success
    // path (after the store write returns) so an upstream failure leaves
    // no spurious RoleGranted record. `ctx.userId` is guaranteed by the
    // permission check above (which would have rejected `null`).
    if (deps.auditProducer && ctx.userId) {
      const event: AuditEventInput = {
        kind: 'RoleGranted',
        actor: { type: 'user', id: ctx.userId },
        subject: { type: 'user', id: grant.actorId },
        scope: grantScopeToAuditScope(grant),
        roleName: await resolveRoleName(deps, grant.roleId),
      }
      deps.auditProducer.emit(event)
    }

    return { ok: true }
  })

  // ----------------------------------------------------------------------
  // roles.revoke — owner-on-target-scope, idempotent, invalidates cache
  // ----------------------------------------------------------------------
  server.handle(RPC_CHANNELS.roles.REVOKE, async (ctx: RequestContext, grant: RoleGrant) => {
    if (!grant || typeof grant !== 'object') {
      return { error: 'invalid-argument', reason: 'invalid-grant' }
    }

    // Permission: owner on the grant's target scope.
    const denied = await checkOwnerOnScope(deps, ctx, grant.scopeKind, grant.scopeId)
    if (denied) return denied

    if (!deps.grantStore) {
      return { error: 'rbac-not-configured', reason: 'no-grant-store' }
    }

    const revoked = await deps.grantStore.revoke(grant)
    if (revoked && grant.actorKind === 'user' && deps.rbacResolver) {
      deps.rbacResolver.invalidateUser(grant.actorId)
    }

    // Audit emission only when the revoke actually changed state (idempotent
    // no-op returns `revoked === false` and produces no audit record). This
    // keeps the audit log meaningful — every RoleRevoked corresponds to a
    // real permission change.
    if (revoked && deps.auditProducer && ctx.userId) {
      const event: AuditEventInput = {
        kind: 'RoleRevoked',
        actor: { type: 'user', id: ctx.userId },
        subject: { type: 'user', id: grant.actorId },
        scope: grantScopeToAuditScope(grant),
        roleName: await resolveRoleName(deps, grant.roleId),
      }
      deps.auditProducer.emit(event)
    }

    return { ok: true, revoked }
  })
}
