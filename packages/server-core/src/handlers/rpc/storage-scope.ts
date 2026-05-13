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

export async function deriveRpcWorkspaceScope(
  deps: HandlerDeps,
  ctx: RequestContext,
  requestedWorkspaceId: string | null | undefined = ctx.workspaceId,
): Promise<BrandedWorkspaceScope> {
  const permittedWorkspaces = ctx.userId && deps.accountStore
    ? await deps.accountStore.listWorkspaceIds(ctx.userId)
    : []

  return deriveScopeFromAuth(
    {
      userId: ctx.userId ?? undefined,
      permittedWorkspaces,
      reqId: ctx.sessionId ?? ctx.clientId,
    },
    requestedWorkspaceId,
  )
}
