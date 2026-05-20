import { describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import type { HandlerDeps } from '../../handler-deps'
import type { HandlerFn, RequestContext, RpcServer } from '@rox-one/server-core/transport'
import { registerArtifactsHandlers } from '../artifacts'

function createHarness(sessionPath: string) {
  const handlers = new Map<string, HandlerFn>()
  const pushes: Array<{ channel: string; args: unknown[] }> = []
  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    push(channel, _target, ...args) {
      pushes.push({ channel, args })
    },
    async invokeClient() {
      return undefined
    },
  }

  const deps: HandlerDeps = {
    sessionManager: {
      getSessionPath: () => sessionPath,
    } as unknown as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    },
  }

  registerArtifactsHandlers(server, deps)
  return { handlers, pushes }
}

function ctx(): RequestContext {
  return {
    clientId: 'client-artifacts-test',
    workspaceId: 'workspace-1',
    webContentsId: 1,
  }
}

describe('artifact RPC handlers', () => {
  it('upserts and reads a session artifact', async () => {
    const root = join(tmpdir(), `artifact-rpc-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const sessionPath = join(root, 'sessions', 'session-1')
    mkdirSync(sessionPath, { recursive: true })

    try {
      const { handlers, pushes } = createHarness(sessionPath)

      const upsert = handlers.get(RPC_CHANNELS.artifacts.UPSERT)!
      const list = handlers.get(RPC_CHANNELS.artifacts.LIST)!
      const get = handlers.get(RPC_CHANNELS.artifacts.GET)!

      const created = await upsert(ctx(), 'session-1', {
        type: 'html',
        title: 'Demo',
        content: '<h1>Demo</h1>',
        versionId: 'version-1',
        now: 1000,
      })

      expect(created.conversationId).toBe('session-1')
      expect(await list(ctx(), 'session-1')).toEqual([created])
      expect(await get(ctx(), 'session-1', created.id)).toEqual(created)
      expect(pushes.at(-1)).toEqual({
        channel: RPC_CHANNELS.artifacts.CHANGED,
        args: ['session-1', created.id],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
