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

export function registerLabelsHandlers(server: RpcServer, _deps: HandlerDeps): void {
  // List all labels for a workspace
  server.handle(RPC_CHANNELS.labels.LIST, async (_ctx, workspaceId: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { listLabels } = await import('@rox-one/shared/labels/storage')
    return listLabels(workspace.rootPath)
  })

  // Create a new label in a workspace
  server.handle(RPC_CHANNELS.labels.CREATE, async (_ctx, workspaceId: unknown, input: unknown) => {
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
  server.handle(RPC_CHANNELS.labels.DELETE, async (_ctx, workspaceId: unknown, labelId: unknown) => {
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
