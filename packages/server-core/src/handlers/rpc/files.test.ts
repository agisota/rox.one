import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { HandlerDeps } from '../handler-deps'
import type { HandlerFn, RequestContext, RpcServer } from '@craft-agent/server-core/transport'
import type { OfficeDocumentConverter } from '@craft-agent/server-core/services'

let workspaceRootPath = ''

function createRpcHarness(overrides: Partial<HandlerDeps> = {}) {
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

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
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
        process: async () => {
          throw new Error('fake image processor only supports image paths')
        },
      },
    },
    ...overrides,
  }

  return { server, deps, handlers }
}

function createRequestContext(): RequestContext {
  return {
    clientId: 'client-files-test',
    workspaceId: 'ws-files-test',
    webContentsId: 42,
  }
}

describe('registerFilesHandlers runtime integrations', () => {
  let tempRoot = ''

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'rox-files-rpc-'))
    const configRootPath = join(tempRoot, 'config')
    workspaceRootPath = join(tempRoot, 'workspace')
    process.env.CRAFT_CONFIG_DIR = configRootPath
    await mkdir(configRootPath, { recursive: true })
    await mkdir(workspaceRootPath, { recursive: true })
    await writeFile(join(workspaceRootPath, 'config.json'), JSON.stringify({
      id: 'ws-files-test',
      name: 'Files Test',
      slug: 'files-test',
      defaults: {},
      createdAt: 0,
      updatedAt: 0,
    }, null, 2))
    await writeFile(join(configRootPath, 'config.json'), JSON.stringify({
      workspaces: [
        {
          id: 'ws-files-test',
          name: 'Files Test',
          rootPath: workspaceRootPath,
          createdAt: 0,
        },
      ],
      activeWorkspaceId: 'ws-files-test',
      activeSessionId: null,
    }, null, 2))
  })

  afterEach(async () => {
    workspaceRootPath = ''
    delete process.env.CRAFT_CONFIG_DIR
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  it('surfaces workspace scope denial from fs search instead of returning an empty result set', async () => {
    const externalRoot = join(tempRoot, 'outside')
    await mkdir(externalRoot, { recursive: true })
    await writeFile(join(externalRoot, 'secret-plan.txt'), 'outside workspace', 'utf-8')

    const { registerFilesHandlers } = await import('./files')
    const { server, deps, handlers } = createRpcHarness()
    registerFilesHandlers(server, deps)

    const search = handlers.get(RPC_CHANNELS.fs.SEARCH)
    expect(search).toBeDefined()

    await expect(search!(createRequestContext(), externalRoot, 'secret')).rejects.toThrow(
      'Access denied: file path is outside file manager scopes'
    )
  })

  it('returns deterministic search results from inside the workspace scope', async () => {
    const launchPlanPath = join(workspaceRootPath, 'launch-plan.md')
    await writeFile(launchPlanPath, 'inside workspace', 'utf-8')
    const canonicalLaunchPlanPath = await realpath(launchPlanPath)

    const { registerFilesHandlers } = await import('./files')
    const { server, deps, handlers } = createRpcHarness()
    registerFilesHandlers(server, deps)

    const search = handlers.get(RPC_CHANNELS.fs.SEARCH)
    expect(search).toBeDefined()

    const results = await search!(createRequestContext(), workspaceRootPath, 'launch')

    expect(results).toEqual([
      {
        name: 'launch-plan.md',
        path: canonicalLaunchPlanPath,
        type: 'file',
        relativePath: 'launch-plan.md',
      },
    ])
  })

  it('stores office attachments through an injected converter and returns the read-only markdown fallback', async () => {
    const fakeOfficeContent = Buffer.from('fake deterministic office bytes')
    const convertedMarkdown = '# Converted office\n\nRead-only fallback from fake provider.'
    const convertedSources: string[] = []
    const fakeConverter: OfficeDocumentConverter = {
      async convert(sourcePath) {
        convertedSources.push(sourcePath)
        return { textContent: convertedMarkdown }
      },
    }

    const { registerFilesHandlers } = await import('./files')
    const { server, deps, handlers } = createRpcHarness({
      officeDocumentConverter: fakeConverter,
    } as Partial<HandlerDeps> & { officeDocumentConverter: OfficeDocumentConverter })
    registerFilesHandlers(server, deps)

    const storeAttachment = handlers.get(RPC_CHANNELS.file.STORE_ATTACHMENT)
    expect(storeAttachment).toBeDefined()

    const stored = await storeAttachment!(createRequestContext(), 'session-office', {
      type: 'office',
      path: '',
      name: 'deck.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      base64: fakeOfficeContent.toString('base64'),
      size: fakeOfficeContent.length,
    })

    expect(convertedSources).toHaveLength(1)
    expect(convertedSources[0]).toContain('/session-office/attachments/')
    expect(stored.markdownPath).toBeDefined()
    expect(await readFile(stored.markdownPath, 'utf-8')).toBe(convertedMarkdown)
  })
})
