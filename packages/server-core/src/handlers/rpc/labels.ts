import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { getWorkspaceByNameOrId } from '@rox-one/shared/config'
import { pushTyped, type RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { parseId, parseCreateLabelInput } from './_validators'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.labels.LIST,
  RPC_CHANNELS.labels.CREATE,
  RPC_CHANNELS.labels.DELETE,
] as const

export function registerLabelsHandlers(server: RpcServer, deps: HandlerDeps): void {
  // List all labels for a workspace
  server.handle(RPC_CHANNELS.labels.LIST, async (_ctx, workspaceId: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { listLabels } = await import('@rox-one/shared/labels/storage')
    return listLabels(workspace.rootPath)
  })

  // Create a new label in a workspace
  server.handle(RPC_CHANNELS.labels.CREATE, async (ctx, workspaceId: unknown, input: unknown) => {
    // T086c: optional rate-limit. Mirrors the T071b/T071c pattern.
    // Sits BEFORE validation and BEFORE the storage write so a hot burst
    // of label creates from a single actor cannot bypass the cap even
    // with malformed payloads. Absent => no-op.
    if (deps.rateLimiter && !deps.rateLimiter.tryAcquire(1)) {
      return { error: 'rate-limited', reason: 'token-bucket-exhausted' }
    }

    // T086c: optional per-actor budget guard. Runs AFTER the bucket gate
    // and BEFORE validation/storage-write. Keyed by `ctx.userId` (or the
    // anonymous sentinel) so each actor has an isolated lifetime cap.
    // Absent => no-op.
    if (deps.budgetGuard) {
      const key = ctx.userId ?? '__anonymous__'
      const result = deps.budgetGuard.consume(key, 1)
      if (!result.ok) {
        return { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }
      }
    }

    const wsId = parseId('workspaceId', workspaceId)
    const parsed = parseCreateLabelInput(input)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { createLabel } = await import('@rox-one/shared/labels/crud')
    // `parsed` is the boundary-narrowed shape (string | {light, dark?}); cast
    // up to the domain's `CreateLabelInput` whose `color` is the structurally
    // compatible `EntityColor` union. Downstream colors module enforces the
    // enum/hex grammar.
    type DomainInput = Parameters<typeof createLabel>[1]
    const label = createLabel(workspace.rootPath, parsed as DomainInput)
    pushTyped(server, RPC_CHANNELS.labels.CHANGED, { to: 'workspace', workspaceId: wsId }, wsId)
    return label
  })

  // Delete a label (and descendants) from a workspace
  server.handle(RPC_CHANNELS.labels.DELETE, async (ctx, workspaceId: unknown, labelId: unknown) => {
    // T086c: optional rate-limit + per-actor budget guard. Same pattern as
    // `labels.create` above — both mutating label channels share the
    // injected bucket and guard so a single actor cannot bypass either
    // cap by alternating create / delete bursts.
    if (deps.rateLimiter && !deps.rateLimiter.tryAcquire(1)) {
      return { error: 'rate-limited', reason: 'token-bucket-exhausted' }
    }
    if (deps.budgetGuard) {
      const key = ctx.userId ?? '__anonymous__'
      const result = deps.budgetGuard.consume(key, 1)
      if (!result.ok) {
        return { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }
      }
    }

    const wsId = parseId('workspaceId', workspaceId)
    const lblId = parseId('labelId', labelId)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { deleteLabel } = await import('@rox-one/shared/labels/crud')
    const result = deleteLabel(workspace.rootPath, lblId)
    pushTyped(server, RPC_CHANNELS.labels.CHANGED, { to: 'workspace', workspaceId: wsId }, wsId)
    return result
  })
}
