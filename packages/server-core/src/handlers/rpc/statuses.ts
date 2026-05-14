import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { getWorkspaceByNameOrId } from '@rox-one/shared/config'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { parseId, parseStringArray } from './_validators'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.statuses.LIST,
  RPC_CHANNELS.statuses.REORDER,
] as const

export function registerStatusesHandlers(server: RpcServer, deps: HandlerDeps): void {
  // List all statuses for a workspace
  server.handle(RPC_CHANNELS.statuses.LIST, async (_ctx, workspaceId: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { listStatuses } = await import('@rox-one/shared/statuses')
    return listStatuses(workspace.rootPath)
  })

  // Reorder statuses (drag-and-drop). Receives new ordered array of status IDs.
  // Config watcher will detect the file change and broadcast STATUSES_CHANGED.
  server.handle(RPC_CHANNELS.statuses.REORDER, async (ctx, workspaceId: unknown, orderedIds: unknown) => {
    // T086c: optional rate-limit. Sits BEFORE validation and BEFORE the
    // filesystem rewrite so a hot burst of reorder calls from a single
    // actor cannot bypass the cap. Absent => no-op.
    if (deps.rateLimiter && !deps.rateLimiter.tryAcquire(1)) {
      return { error: 'rate-limited', reason: 'token-bucket-exhausted' }
    }

    // T086c: optional per-actor budget guard. Runs AFTER the bucket gate
    // and BEFORE validation/filesystem-rewrite. Keyed by `ctx.userId` so
    // each actor has an isolated lifetime cap. Absent => no-op.
    if (deps.budgetGuard) {
      const key = ctx.userId ?? '__anonymous__'
      const result = deps.budgetGuard.consume(key, 1)
      if (!result.ok) {
        return { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }
      }
    }

    const wsId = parseId('workspaceId', workspaceId)
    const ids = parseStringArray('orderedIds', orderedIds, { maxLen: 256 })
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { reorderStatuses } = await import('@rox-one/shared/statuses')
    reorderStatuses(workspace.rootPath, ids)
  })
}
