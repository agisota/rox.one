import {
  DEFAULT_LOCAL_SCOPE,
  deriveScopeFromAuth,
  type BrandedWorkspaceScope,
} from '@rox-one/shared/config'
import type { RequestContext } from '../../transport/types'
import type { HandlerDeps } from '../handler-deps'

export const SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE_REASON =
  'Server-core RPC storage here is admin/global local UI/runtime preference or connection registry state, not tenant workspace content.'

export const SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE

/**
 * Resolve `session.permittedWorkspaces` for the calling user (T226).
 *
 * Resolution order:
 *
 * 1. If `deps.rbacResolver` is provided, source the permitted-workspace ids
 *    from the RBAC policy engine via the resolver. This is the production
 *    path for multi-tenant hosts.
 * 2. Otherwise fall back to `deps.accountStore.listWorkspaceIds(userId)`, the
 *    C.4 baseline path. Single-user runtimes that have not yet adopted RBAC
 *    keep their existing semantics with zero changes.
 * 3. If the caller is anonymous (no `userId`) or has no resolver and no
 *    account store, return `[]` and let `deriveScopeFromAuth` handle the
 *    downstream `MultiTenantForgeryError` semantics.
 */
export async function resolvePermittedWorkspaces(
  deps: HandlerDeps,
  userId: string | undefined,
): Promise<ReadonlyArray<string>> {
  if (!userId) return []
  if (deps.rbacResolver) {
    return deps.rbacResolver.permittedWorkspacesForUser(userId)
  }
  if (deps.accountStore) {
    return deps.accountStore.listWorkspaceIds(userId)
  }
  return []
}

export async function deriveRpcWorkspaceScope(
  deps: HandlerDeps,
  ctx: RequestContext,
  requestedWorkspaceId: string | null | undefined = ctx.workspaceId,
): Promise<BrandedWorkspaceScope> {
  const permittedWorkspaces = await resolvePermittedWorkspaces(deps, ctx.userId ?? undefined)

  return deriveScopeFromAuth(
    {
      userId: ctx.userId ?? undefined,
      permittedWorkspaces,
      reqId: ctx.sessionId ?? ctx.clientId,
    },
    requestedWorkspaceId,
  )
}
