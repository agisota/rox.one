import type { WorkspaceInfo } from '@rox-one/core/types'
import type { RequestContext } from '../../transport/types'
import type { HandlerDeps } from '../handler-deps'

export function isAccountScoped(ctx: RequestContext, deps: HandlerDeps): boolean {
  return Boolean(ctx.userId && deps.accountStore)
}

export async function requireWorkspaceAccess(deps: HandlerDeps, ctx: RequestContext, workspaceId: string): Promise<void> {
  if (!ctx.userId || !deps.accountStore) return
  const ok = await deps.accountStore.isWorkspaceOwner(ctx.userId, workspaceId)
  if (!ok) {
    const err = new Error('Workspace not found')
    ;(err as any).code = 'FORBIDDEN'
    throw err
  }
}

export function requireAdmin(deps: HandlerDeps, ctx: RequestContext): void {
  if (!ctx.userId || !deps.accountStore) return
  if (ctx.userRole !== 'admin') {
    const err = new Error('Admin access required')
    ;(err as any).code = 'FORBIDDEN'
    throw err
  }
}

export async function grantWorkspaceAccess(deps: HandlerDeps, ctx: RequestContext, workspaceId: string): Promise<void> {
  if (!ctx.userId || !deps.accountStore) return
  await deps.accountStore.grantWorkspaceOwner(ctx.userId, workspaceId)
}

export async function filterOwnedWorkspaces<T extends { id: string }>(deps: HandlerDeps, ctx: RequestContext, workspaces: T[]): Promise<T[]> {
  if (!ctx.userId || !deps.accountStore) return workspaces
  const ownedIds = new Set(await deps.accountStore.listWorkspaceIds(ctx.userId))
  return workspaces.filter(workspace => ownedIds.has(workspace.id))
}

export async function requireSessionAccess(deps: HandlerDeps, ctx: RequestContext, sessionId: string): Promise<void> {
  if (!ctx.userId || !deps.accountStore) return
  const session = await deps.sessionManager.getSession(sessionId)
  const workspaceId = (session as { workspaceId?: string } | null)?.workspaceId
  if (!workspaceId) {
    const err = new Error('Session not found')
    ;(err as any).code = 'FORBIDDEN'
    throw err
  }
  await requireWorkspaceAccess(deps, ctx, workspaceId)
}

export async function filterOwnedWorkspaceInfo(deps: HandlerDeps, ctx: RequestContext, workspaces: WorkspaceInfo[]): Promise<WorkspaceInfo[]> {
  return filterOwnedWorkspaces(deps, ctx, workspaces)
}
