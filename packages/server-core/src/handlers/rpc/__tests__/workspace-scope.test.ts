import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RPC_CHANNELS } from '@rox-agent/shared/protocol'
import { MultiTenantForgeryError } from '@rox-agent/shared/config'
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../../../../../shared/src/config/storage-scope-runtime'
import { registerWorkspaceCoreHandlers } from '../workspace'
import type { AccountStore } from '../../../accounts'
import type { HandlerDeps } from '../../handler-deps'
import type { HandlerFn, RequestContext, RpcServer } from '../../../transport/types'

function createRpcHarness(options: { permittedWorkspaceIds?: string[] } = {}) {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    push() {},
    async invokeClient() {
      return undefined
    },
  }

  const accountStore = options.permittedWorkspaceIds
    ? ({
        async listWorkspaceIds() {
          return options.permittedWorkspaceIds ?? []
        },
      } as Partial<AccountStore> as AccountStore)
    : undefined

  const deps = {
    sessionManager: {
      getWorkspaces() {
        throw new Error('workspaces.GET must read through the C4 scoped storage path')
      },
    },
    oauthFlowStore: {},
    accountStore,
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.alloc(0),
      },
    },
  } as unknown as HandlerDeps

  registerWorkspaceCoreHandlers(server, deps)
  const getWorkspaces = handlers.get(RPC_CHANNELS.workspaces.GET)
  if (!getWorkspaces) throw new Error('workspaces.GET handler was not registered')

  return { getWorkspaces }
}

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    clientId: 'client-workspace-scope-test',
    workspaceId: null,
    webContentsId: 1,
    ...overrides,
  }
}

async function writeConfig(configRoot: string, scopeRoot: string, workspaceId: string, name: string): Promise<void> {
  const workspaceRoot = join(configRoot, `${workspaceId}-root`)
  await mkdir(workspaceRoot, { recursive: true })
  await writeFile(join(workspaceRoot, 'config.json'), JSON.stringify({
    id: workspaceId,
    name,
    slug: workspaceId.toLowerCase(),
    defaults: {},
    createdAt: 0,
    updatedAt: 0,
  }, null, 2))
  await mkdir(scopeRoot, { recursive: true })
  await writeFile(join(scopeRoot, 'config.json'), JSON.stringify({
    workspaces: [
      {
        id: workspaceId,
        name,
        rootPath: workspaceRoot,
        createdAt: 0,
      },
    ],
    activeWorkspaceId: workspaceId,
    activeSessionId: null,
  }, null, 2))
}

describe('workspace.ts getWorkspaces scope wiring (C4)', () => {
  let tempRoot = ''
  let configRoot = ''

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'rox-workspace-scope-'))
    configRoot = join(tempRoot, 'config')
    process.env.ROX_CONFIG_DIR = configRoot
    __resetMultiTenantForTests()
    await writeConfig(configRoot, configRoot, 'FLAT', 'Flat Workspace')
    await writeConfig(configRoot, join(configRoot, 'tenants', 'W42'), 'W42', 'Tenant Workspace')
  })

  afterEach(async () => {
    __resetMultiTenantForTests()
    delete process.env.ROX_CONFIG_DIR
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = ''
      configRoot = ''
    }
  })

  it('single-user runtime returns existing flat config data', async () => {
    __setMultiTenantForTests(false)
    const { getWorkspaces } = createRpcHarness()

    const result = await getWorkspaces(ctx())

    expect(result.map((workspace: { id: string }) => workspace.id)).toEqual(['FLAT'])
  })

  it('single-user runtime downgrades a requested workspace to flat config data', async () => {
    __setMultiTenantForTests(false)
    const { getWorkspaces } = createRpcHarness()

    const result = await getWorkspaces(ctx({ workspaceId: 'W42' }))

    expect(result.map((workspace: { id: string }) => workspace.id)).toEqual(['FLAT'])
  })

  it('multi-tenant runtime reads tenant config data for a permitted workspace', async () => {
    __setMultiTenantForTests(true)
    const { getWorkspaces } = createRpcHarness({ permittedWorkspaceIds: ['W42'] })

    const result = await getWorkspaces(ctx({ userId: 'u1', workspaceId: 'W42' }))

    expect(result.map((workspace: { id: string }) => workspace.id)).toEqual(['W42'])
  })

  it('multi-tenant runtime rejects requested workspace forgery', async () => {
    __setMultiTenantForTests(true)
    const { getWorkspaces } = createRpcHarness({ permittedWorkspaceIds: ['W42'] })

    await expect(
      getWorkspaces(ctx({ userId: 'u1', workspaceId: 'W_OTHER' })),
    ).rejects.toThrow(MultiTenantForgeryError)
  })

  it('multi-tenant runtime with null workspace id keeps flat config data', async () => {
    __setMultiTenantForTests(true)
    const { getWorkspaces } = createRpcHarness()

    const result = await getWorkspaces(ctx({ workspaceId: null }))

    expect(result.map((workspace: { id: string }) => workspace.id)).toEqual(['FLAT'])
  })
})
