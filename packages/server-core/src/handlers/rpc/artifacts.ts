import { RPC_CHANNELS, type UpsertSessionArtifactInput } from '@rox-one/shared/protocol'
import {
  AGENT_ARTIFACT_TYPES,
  deleteSessionArtifactFromPath,
  getSessionArtifactFromPath,
  listSessionArtifactsFromPath,
  upsertSessionArtifactInPath,
} from '@rox-one/shared/sessions'
import { pushTyped, type RequestContext, type RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { requireSessionAccess } from './account-ownership'
import { invalidInput, parseEnum, parseId, parseOptionalSafeString } from './_validators'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.artifacts.LIST,
  RPC_CHANNELS.artifacts.GET,
  RPC_CHANNELS.artifacts.UPSERT,
  RPC_CHANNELS.artifacts.DELETE,
] as const

function parseArtifactText(name: string, value: unknown, maxLen: number): string {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  if (value.length > maxLen) invalidInput(`${name} must be <= ${maxLen} chars`)
  if (value.includes('\u0000')) invalidInput(`${name} must not contain NUL characters`)
  return value
}

function parseArtifactInput(value: unknown, sessionId: string): UpsertSessionArtifactInput {
  if (!value || typeof value !== 'object') invalidInput('artifact input must be an object')
  const input = value as Record<string, unknown>

  const id = input.id === undefined || input.id === null
    ? undefined
    : parseId('artifact.id', input.id)
  const versionId = input.versionId === undefined || input.versionId === null
    ? undefined
    : parseId('artifact.versionId', input.versionId)
  const sourceMessageId = parseOptionalSafeString('artifact.sourceMessageId', input.sourceMessageId, 256)
  const now = input.now === undefined || input.now === null
    ? undefined
    : Number(input.now)

  if (now !== undefined && !Number.isFinite(now)) {
    invalidInput('artifact.now must be a finite number')
  }

  return {
    id,
    conversationId: sessionId,
    type: parseEnum('artifact.type', input.type, AGENT_ARTIFACT_TYPES),
    title: parseArtifactText('artifact.title', input.title, 512),
    content: parseArtifactText('artifact.content', input.content, 10_000_000),
    sourceMessageId,
    versionId,
    now,
    metadata: input.metadata && typeof input.metadata === 'object'
      ? input.metadata as Record<string, unknown>
      : undefined,
  }
}

async function getSessionPath(deps: HandlerDeps, ctx: RequestContext, sessionId: string): Promise<string> {
  parseId('sessionId', sessionId)
  await requireSessionAccess(deps, ctx, sessionId)
  const sessionPath = deps.sessionManager.getSessionPath(sessionId)
  if (!sessionPath) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  return sessionPath
}

export function registerArtifactsHandlers(server: RpcServer, deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.artifacts.LIST, async (ctx, sessionId: string) => {
    const sessionPath = await getSessionPath(deps, ctx, sessionId)
    return listSessionArtifactsFromPath(sessionPath)
  })

  server.handle(RPC_CHANNELS.artifacts.GET, async (ctx, sessionId: string, artifactId: string) => {
    const sessionPath = await getSessionPath(deps, ctx, sessionId)
    return getSessionArtifactFromPath(sessionPath, parseId('artifactId', artifactId))
  })

  server.handle(RPC_CHANNELS.artifacts.UPSERT, async (ctx, sessionId: string, input: unknown) => {
    const sessionPath = await getSessionPath(deps, ctx, sessionId)
    const artifact = await upsertSessionArtifactInPath(sessionPath, parseArtifactInput(input, sessionId))
    pushTyped(
      server,
      RPC_CHANNELS.artifacts.CHANGED,
      ctx.workspaceId ? { to: 'workspace', workspaceId: ctx.workspaceId } : { to: 'all' },
      sessionId,
      artifact.id,
    )
    return artifact
  })

  server.handle(RPC_CHANNELS.artifacts.DELETE, async (ctx, sessionId: string, artifactId: string) => {
    const sessionPath = await getSessionPath(deps, ctx, sessionId)
    const deleted = deleteSessionArtifactFromPath(sessionPath, parseId('artifactId', artifactId))
    if (deleted) {
      pushTyped(
        server,
        RPC_CHANNELS.artifacts.CHANGED,
        ctx.workspaceId ? { to: 'workspace', workspaceId: ctx.workspaceId } : { to: 'all' },
        sessionId,
        artifactId,
      )
    }
    return deleted
  })
}
