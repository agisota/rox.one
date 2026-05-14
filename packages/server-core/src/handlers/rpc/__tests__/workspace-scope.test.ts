import { describe, expect, it, setDefaultTimeout } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../../../../../..')
const workspaceModuleUrl = pathToFileURL(resolve(testDir, '../workspace.ts')).href
const runtimeModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/config/storage-scope-runtime.ts')).href
const protocolModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/protocol/index.ts')).href

setDefaultTimeout(30_000)

type WorkspaceOperation =
  | 'workspaces.GET'
  | 'workspaces.CREATE'
  | 'workspaces.UPDATE_REMOTE'
  | 'window.GET_WORKSPACE'
  | 'window.SWITCH_WORKSPACE'
  | 'workspace.READ_IMAGE'
  | 'workspace.WRITE_IMAGE'
  | 'theme.GET_APP'
  | 'theme.GET_PRESETS'
  | 'theme.LOAD_PRESET'
  | 'theme.GET_COLOR_THEME'
  | 'theme.SET_COLOR_THEME'
  | 'theme.GET_WORKSPACE_COLOR_THEME'
  | 'theme.SET_WORKSPACE_COLOR_THEME'
  | 'theme.GET_ALL_WORKSPACE_THEMES'
  | 'views.LIST'
  | 'views.SAVE'
  | 'toolIcons.GET_MAPPINGS'

interface WorkspaceScenario {
  operation: WorkspaceOperation
  multiTenant: boolean
  contextWorkspaceId: string | null
  targetWorkspaceId?: string
  windowWorkspaceId?: string
  userId?: string
  permittedWorkspaceIds?: string[]
}

interface WorkspaceScenarioResult {
  ok: boolean
  marker?: string
  ids?: string[]
  errorName?: string
  message?: string
}

const APP_SCOPED_OPERATIONS = new Set<WorkspaceOperation>([
  'workspaces.GET',
  'workspaces.CREATE',
  'theme.GET_APP',
  'theme.GET_PRESETS',
  'theme.LOAD_PRESET',
  'theme.GET_COLOR_THEME',
  'theme.SET_COLOR_THEME',
  'theme.GET_ALL_WORKSPACE_THEMES',
  'toolIcons.GET_MAPPINGS',
])

const HANDLER_OPERATIONS: WorkspaceOperation[] = [
  'workspaces.GET',
  'workspaces.CREATE',
  'workspaces.UPDATE_REMOTE',
  'window.GET_WORKSPACE',
  'window.SWITCH_WORKSPACE',
  'workspace.READ_IMAGE',
  'workspace.WRITE_IMAGE',
  'theme.GET_APP',
  'theme.GET_PRESETS',
  'theme.LOAD_PRESET',
  'theme.GET_COLOR_THEME',
  'theme.SET_COLOR_THEME',
  'theme.GET_WORKSPACE_COLOR_THEME',
  'theme.SET_WORKSPACE_COLOR_THEME',
  'theme.GET_ALL_WORKSPACE_THEMES',
  'views.LIST',
  'views.SAVE',
  'toolIcons.GET_MAPPINGS',
]

async function writeScopeFixtures(configRoot: string, scopeRoot: string, workspaceId: string, marker: 'flat' | 'tenant'): Promise<void> {
  const workspaceRoot = join(configRoot, `${workspaceId}-root`)
  await mkdir(workspaceRoot, { recursive: true })
  await writeFile(join(workspaceRoot, 'config.json'), JSON.stringify({
    id: workspaceId,
    name: `${marker} workspace`,
    slug: workspaceId.toLowerCase(),
    defaults: {
      colorTheme: `${marker}-workspace-theme`,
    },
    createdAt: 0,
    updatedAt: 0,
  }, null, 2))
  await writeFile(join(workspaceRoot, 'icon.svg'), `<svg>${marker}-image</svg>`, 'utf8')
  await writeFile(join(workspaceRoot, 'views.json'), JSON.stringify({
    version: 1,
    views: [
      {
        id: `${marker}-view`,
        name: `${marker} view`,
        expression: 'status:any',
      },
    ],
  }, null, 2))

  await mkdir(join(scopeRoot, 'themes'), { recursive: true })
  await mkdir(join(scopeRoot, 'tool-icons'), { recursive: true })
  await writeFile(join(scopeRoot, 'config.json'), JSON.stringify({
    workspaces: [
      {
        id: workspaceId,
        name: `${marker} workspace`,
        rootPath: workspaceRoot,
        remoteServer: {
          url: `${marker}-remote-original`,
          token: `${marker}-token`,
          remoteWorkspaceId: `${marker}-remote-workspace`,
        },
        createdAt: 0,
      },
    ],
    activeWorkspaceId: workspaceId,
    activeSessionId: null,
    colorTheme: `${marker}-color`,
  }, null, 2))
  await writeFile(join(scopeRoot, 'theme.json'), JSON.stringify({
    marker: `${marker}-app-theme`,
  }, null, 2))
  await writeFile(join(scopeRoot, 'themes', 'marker.json'), JSON.stringify({
    name: `${marker} preset`,
    accent: marker,
  }, null, 2))
  await writeFile(join(scopeRoot, 'tool-icons', 'tool-icons.json'), JSON.stringify({
    version: 1,
    tools: [
      {
        id: `${marker}-tool`,
        displayName: `${marker} tool`,
        icon: 'tool.svg',
        commands: [marker],
      },
    ],
  }, null, 2))
  await writeFile(join(scopeRoot, 'tool-icons', 'tool.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8')
}

async function runWorkspaceScenario(scenario: WorkspaceScenario): Promise<WorkspaceScenarioResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'rox-workspace-scope-'))
  const configRoot = join(tempRoot, 'config')

  try {
    await writeScopeFixtures(configRoot, configRoot, 'FLAT', 'flat')
    await writeScopeFixtures(configRoot, join(configRoot, 'tenants', 'W42'), 'W42', 'tenant')

    const runnerPath = join(tempRoot, 'workspace-scope-runner.ts')
    await writeFile(runnerPath, `
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RPC_CHANNELS } from ${JSON.stringify(protocolModuleUrl)}
import { __resetMultiTenantForTests, __setMultiTenantForTests } from ${JSON.stringify(runtimeModuleUrl)}
import { registerWorkspaceCoreHandlers } from ${JSON.stringify(workspaceModuleUrl)}

const scenario = JSON.parse(process.env.C4_WORKSPACE_SCOPE_SCENARIO ?? '{}')
const configRoot = process.env.ROX_CONFIG_DIR
if (!configRoot) throw new Error('ROX_CONFIG_DIR is required')

const flatRoot = join(configRoot, 'FLAT-root')
const tenantRoot = join(configRoot, 'W42-root')
const flatScopeRoot = configRoot
const tenantScopeRoot = join(configRoot, 'tenants', 'W42')
const handlers = new Map()
const watcherRoots = []
const grants = []
const pushes = []

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null
  return readJson(path)
}

function readTextIfExists(path) {
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
}

function configFor(scopeRoot) {
  return readJsonIfExists(join(scopeRoot, 'config.json'))
}

function workspaceConfigFor(rootPath) {
  return readJsonIfExists(join(rootPath, 'config.json'))
}

function containsCreatedWorkspace(scopeRoot, createdRootPath) {
  const config = configFor(scopeRoot)
  return Boolean(config?.workspaces?.some((workspace) => workspace.rootPath === createdRootPath))
}

function classifyWorkspaceRoot(rootPath) {
  if (rootPath === flatRoot) return 'flat'
  if (rootPath === tenantRoot) return 'tenant'
  return 'unknown'
}

function classifyConfigMutation(createdRootPath) {
  const flatHasCreated = containsCreatedWorkspace(flatScopeRoot, createdRootPath)
  const tenantHasCreated = containsCreatedWorkspace(tenantScopeRoot, createdRootPath)
  if (tenantHasCreated && !flatHasCreated) return 'tenant'
  if (flatHasCreated && !tenantHasCreated) return 'flat'
  if (flatHasCreated && tenantHasCreated) return 'mixed'
  return 'missing'
}

function classifyRemoteUpdate() {
  const flatRemote = configFor(flatScopeRoot)?.workspaces?.find((workspace) => workspace.id === 'FLAT')?.remoteServer?.url
  const tenantRemote = configFor(tenantScopeRoot)?.workspaces?.find((workspace) => workspace.id === 'W42')?.remoteServer?.url
  if (tenantRemote === 'updated-remote' && flatRemote !== 'updated-remote') return 'tenant'
  if (flatRemote === 'updated-remote' && tenantRemote !== 'updated-remote') return 'flat'
  return 'missing'
}

function classifyColorThemeUpdate() {
  const flatColor = configFor(flatScopeRoot)?.colorTheme
  const tenantColor = configFor(tenantScopeRoot)?.colorTheme
  if (tenantColor === 'updated-color' && flatColor !== 'updated-color') return 'tenant'
  if (flatColor === 'updated-color' && tenantColor !== 'updated-color') return 'flat'
  return 'missing'
}

function classifyWorkspaceThemeUpdate() {
  const flatTheme = workspaceConfigFor(flatRoot)?.defaults?.colorTheme
  const tenantTheme = workspaceConfigFor(tenantRoot)?.defaults?.colorTheme
  if (tenantTheme === 'updated-workspace-theme' && flatTheme !== 'updated-workspace-theme') return 'tenant'
  if (flatTheme === 'updated-workspace-theme' && tenantTheme !== 'updated-workspace-theme') return 'flat'
  return 'missing'
}

function classifyViewUpdate() {
  const flatView = readJsonIfExists(join(flatRoot, 'views.json'))?.views?.[0]?.id
  const tenantView = readJsonIfExists(join(tenantRoot, 'views.json'))?.views?.[0]?.id
  if (tenantView === 'updated-view' && flatView !== 'updated-view') return 'tenant'
  if (flatView === 'updated-view' && tenantView !== 'updated-view') return 'flat'
  return 'missing'
}

function classifyImageWrite() {
  const flatImage = readTextIfExists(join(flatRoot, 'icon.svg'))
  const tenantImage = readTextIfExists(join(tenantRoot, 'icon.svg'))
  if (tenantImage?.includes('updated-image') && !flatImage?.includes('updated-image')) return 'tenant'
  if (flatImage?.includes('updated-image') && !tenantImage?.includes('updated-image')) return 'flat'
  return 'missing'
}

function markerFromResult(operation, result, extra) {
  switch (operation) {
    case 'workspaces.GET':
      return result?.[0]?.id === 'W42' ? 'tenant' : result?.[0]?.id === 'FLAT' ? 'flat' : 'unknown'
    case 'workspaces.CREATE':
      return classifyConfigMutation(extra.createdRootPath)
    case 'workspaces.UPDATE_REMOTE':
      return classifyRemoteUpdate()
    case 'window.GET_WORKSPACE':
    case 'window.SWITCH_WORKSPACE':
      return classifyWorkspaceRoot(watcherRoots[0]?.rootPath)
    case 'workspace.READ_IMAGE':
      return typeof result === 'string' && result.includes('tenant-image')
        ? 'tenant'
        : typeof result === 'string' && result.includes('flat-image')
          ? 'flat'
          : 'unknown'
    case 'workspace.WRITE_IMAGE':
      return classifyImageWrite()
    case 'theme.GET_APP':
      return result?.marker === 'tenant-app-theme' ? 'tenant' : result?.marker === 'flat-app-theme' ? 'flat' : 'unknown'
    case 'theme.GET_PRESETS':
      return result?.[0]?.theme?.name === 'tenant preset' ? 'tenant' : result?.[0]?.theme?.name === 'flat preset' ? 'flat' : 'unknown'
    case 'theme.LOAD_PRESET':
      return result?.theme?.name === 'tenant preset' ? 'tenant' : result?.theme?.name === 'flat preset' ? 'flat' : 'unknown'
    case 'theme.GET_COLOR_THEME':
      return result === 'tenant-color' ? 'tenant' : result === 'flat-color' ? 'flat' : 'unknown'
    case 'theme.SET_COLOR_THEME':
      return classifyColorThemeUpdate()
    case 'theme.GET_WORKSPACE_COLOR_THEME':
      return result === 'tenant-workspace-theme' ? 'tenant' : result === 'flat-workspace-theme' ? 'flat' : 'unknown'
    case 'theme.SET_WORKSPACE_COLOR_THEME':
      return classifyWorkspaceThemeUpdate()
    case 'theme.GET_ALL_WORKSPACE_THEMES':
      return result?.W42 === 'tenant-workspace-theme' ? 'tenant' : result?.FLAT === 'flat-workspace-theme' ? 'flat' : 'unknown'
    case 'views.LIST':
      return result?.[0]?.id === 'tenant-view' ? 'tenant' : result?.[0]?.id === 'flat-view' ? 'flat' : 'unknown'
    case 'views.SAVE':
      return classifyViewUpdate()
    case 'toolIcons.GET_MAPPINGS':
      return result?.[0]?.displayName === 'tenant tool' ? 'tenant' : result?.[0]?.displayName === 'flat tool' ? 'flat' : 'unknown'
    default:
      return 'unknown'
  }
}

function channelFor(operation) {
  switch (operation) {
    case 'workspaces.GET': return RPC_CHANNELS.workspaces.GET
    case 'workspaces.CREATE': return RPC_CHANNELS.workspaces.CREATE
    case 'workspaces.UPDATE_REMOTE': return RPC_CHANNELS.workspaces.UPDATE_REMOTE
    case 'window.GET_WORKSPACE': return RPC_CHANNELS.window.GET_WORKSPACE
    case 'window.SWITCH_WORKSPACE': return RPC_CHANNELS.window.SWITCH_WORKSPACE
    case 'workspace.READ_IMAGE': return RPC_CHANNELS.workspace.READ_IMAGE
    case 'workspace.WRITE_IMAGE': return RPC_CHANNELS.workspace.WRITE_IMAGE
    case 'theme.GET_APP': return RPC_CHANNELS.theme.GET_APP
    case 'theme.GET_PRESETS': return RPC_CHANNELS.theme.GET_PRESETS
    case 'theme.LOAD_PRESET': return RPC_CHANNELS.theme.LOAD_PRESET
    case 'theme.GET_COLOR_THEME': return RPC_CHANNELS.theme.GET_COLOR_THEME
    case 'theme.SET_COLOR_THEME': return RPC_CHANNELS.theme.SET_COLOR_THEME
    case 'theme.GET_WORKSPACE_COLOR_THEME': return RPC_CHANNELS.theme.GET_WORKSPACE_COLOR_THEME
    case 'theme.SET_WORKSPACE_COLOR_THEME': return RPC_CHANNELS.theme.SET_WORKSPACE_COLOR_THEME
    case 'theme.GET_ALL_WORKSPACE_THEMES': return RPC_CHANNELS.theme.GET_ALL_WORKSPACE_THEMES
    case 'views.LIST': return RPC_CHANNELS.views.LIST
    case 'views.SAVE': return RPC_CHANNELS.views.SAVE
    case 'toolIcons.GET_MAPPINGS': return RPC_CHANNELS.toolIcons.GET_MAPPINGS
    default: throw new Error('Unknown operation ' + operation)
  }
}

async function invokeOperation(operation, handler, ctx) {
  const targetWorkspaceId = scenario.targetWorkspaceId ?? scenario.contextWorkspaceId
  switch (operation) {
    case 'workspaces.GET':
    case 'window.GET_WORKSPACE':
    case 'theme.GET_APP':
    case 'theme.GET_PRESETS':
    case 'theme.GET_COLOR_THEME':
    case 'theme.GET_ALL_WORKSPACE_THEMES':
    case 'toolIcons.GET_MAPPINGS':
      return { result: await handler(ctx), extra: {} }
    case 'workspaces.CREATE': {
      const createdRootPath = join(configRoot, scenario.multiTenant ? 'tenant-created-root' : 'flat-created-root')
      mkdirSync(createdRootPath, { recursive: true })
      return {
        result: await handler(ctx, createdRootPath, 'Created Workspace'),
        extra: { createdRootPath },
      }
    }
    case 'workspaces.UPDATE_REMOTE':
      return {
        result: await handler(ctx, targetWorkspaceId, {
          url: 'updated-remote',
          token: 'updated-token',
          remoteWorkspaceId: 'updated-remote-workspace',
        }),
        extra: {},
      }
    case 'window.SWITCH_WORKSPACE':
      return { result: await handler(ctx, targetWorkspaceId), extra: {} }
    case 'workspace.READ_IMAGE':
      return { result: await handler(ctx, targetWorkspaceId, 'icon.svg'), extra: {} }
    case 'workspace.WRITE_IMAGE':
      return {
        result: await handler(
          ctx,
          targetWorkspaceId,
          'icon.svg',
          Buffer.from('<svg>updated-image</svg>').toString('base64'),
          'image/svg+xml',
        ),
        extra: {},
      }
    case 'theme.LOAD_PRESET':
      return { result: await handler(ctx, 'marker'), extra: {} }
    case 'theme.SET_COLOR_THEME':
      return { result: await handler(ctx, 'updated-color'), extra: {} }
    case 'theme.GET_WORKSPACE_COLOR_THEME':
      return { result: await handler(ctx, targetWorkspaceId), extra: {} }
    case 'theme.SET_WORKSPACE_COLOR_THEME':
      return { result: await handler(ctx, targetWorkspaceId, 'updated-workspace-theme'), extra: {} }
    case 'views.LIST':
      return { result: await handler(ctx, targetWorkspaceId), extra: {} }
    case 'views.SAVE':
      return {
        result: await handler(ctx, targetWorkspaceId, [
          { id: 'updated-view', name: 'Updated view', expression: 'status:any' },
        ]),
        extra: {},
      }
    default:
      throw new Error('Unhandled operation ' + operation)
  }
}

const server = {
  handle(channel, handler) {
    handlers.set(channel, handler)
  },
  push(channel, scope, payload) {
    pushes.push({ channel, scope, payload })
  },
  updateClientWorkspace() {},
  async invokeClient() {
    return undefined
  },
}
const deps = {
  sessionManager: {
    getWorkspaces() {
      throw new Error('workspaces.GET must read through the C4 scoped storage path')
    },
    setupConfigWatcher(rootPath, workspaceId) {
      watcherRoots.push({ rootPath, workspaceId })
    },
    clearActiveViewingSession() {},
  },
  windowManager: {
    getWorkspaceForWindow() {
      return scenario.windowWorkspaceId ?? scenario.targetWorkspaceId ?? scenario.contextWorkspaceId ?? null
    },
    updateWindowWorkspace() {
      return true
    },
    getWindowByWebContentsId() {
      return null
    },
    registerWindow() {},
    getAllWindowsForWorkspace() {
      return []
    },
  },
  oauthFlowStore: {},
  accountStore: {
    async listWorkspaceIds() {
      return scenario.permittedWorkspaceIds ?? []
    },
    async isWorkspaceOwner() {
      return true
    },
    async grantWorkspaceOwner(userId, workspaceId) {
      grants.push({ userId, workspaceId })
    },
  },
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
      process: async (buffer) => buffer,
    },
  },
}
registerWorkspaceCoreHandlers(server, deps)

try {
  __resetMultiTenantForTests()
  __setMultiTenantForTests(Boolean(scenario.multiTenant))
  const handler = handlers.get(channelFor(scenario.operation))
  if (!handler) throw new Error(scenario.operation + ' handler was not registered')
  const ctx = {
    clientId: 'client-workspace-scope-test',
    workspaceId: scenario.contextWorkspaceId ?? null,
    userId: scenario.userId,
    webContentsId: 1,
    sessionId: 'session-workspace-scope-test',
  }
  const { result, extra } = await invokeOperation(scenario.operation, handler, ctx)
  const marker = markerFromResult(scenario.operation, result, extra)
  const ids = Array.isArray(result) ? result.map((item) => item?.id).filter(Boolean) : undefined
  console.log(JSON.stringify({ ok: true, marker, ids }))
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    errorName: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
  }))
} finally {
  __resetMultiTenantForTests()
}
`, 'utf8')

    const result = spawnSync('bun', ['run', runnerPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ROX_CONFIG_DIR: configRoot,
        C4_WORKSPACE_SCOPE_SCENARIO: JSON.stringify(scenario),
      },
    })

    if (result.status !== 0) {
      throw new Error(`workspace scope runner failed with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }

    const lastLine = result.stdout.trim().split('\n').filter(Boolean).at(-1)
    if (!lastLine) {
      throw new Error(`workspace scope runner produced no JSON\nstderr:\n${result.stderr}`)
    }
    return JSON.parse(lastLine) as WorkspaceScenarioResult
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

function flatScenario(operation: WorkspaceOperation): WorkspaceScenario {
  return APP_SCOPED_OPERATIONS.has(operation)
    ? { operation, multiTenant: false, contextWorkspaceId: null }
    : { operation, multiTenant: false, contextWorkspaceId: null, targetWorkspaceId: 'FLAT', windowWorkspaceId: 'FLAT' }
}

function tenantScenario(operation: WorkspaceOperation): WorkspaceScenario {
  return APP_SCOPED_OPERATIONS.has(operation)
    ? {
        operation,
        multiTenant: true,
        contextWorkspaceId: 'W42',
        userId: 'u1',
        permittedWorkspaceIds: ['W42'],
      }
    : {
        operation,
        multiTenant: true,
        contextWorkspaceId: null,
        targetWorkspaceId: 'W42',
        windowWorkspaceId: 'W42',
        userId: 'u1',
        permittedWorkspaceIds: ['W42'],
      }
}

function forgeryScenario(operation: WorkspaceOperation): WorkspaceScenario {
  return APP_SCOPED_OPERATIONS.has(operation)
    ? {
        operation,
        multiTenant: true,
        contextWorkspaceId: 'W_OTHER',
        userId: 'u1',
        permittedWorkspaceIds: ['W42'],
      }
    : {
        operation,
        multiTenant: true,
        contextWorkspaceId: null,
        targetWorkspaceId: 'W_OTHER',
        windowWorkspaceId: 'W_OTHER',
        userId: 'u1',
        permittedWorkspaceIds: ['W42'],
      }
}

describe('workspace.ts scope wiring (C4)', () => {
  for (const operation of HANDLER_OPERATIONS) {
    it(`${operation} preserves single-user flat storage`, async () => {
      const result = await runWorkspaceScenario(flatScenario(operation))

      expect(result).toMatchObject({ ok: true, marker: 'flat' })
    })

    it(`${operation} routes permitted multi-tenant storage to the tenant root`, async () => {
      const result = await runWorkspaceScenario(tenantScenario(operation))

      expect(result).toMatchObject({ ok: true, marker: 'tenant' })
    })

    it(`${operation} rejects multi-tenant workspace forgery`, async () => {
      const result = await runWorkspaceScenario(forgeryScenario(operation))

      expect(result).toMatchObject({ ok: false, errorName: 'MultiTenantForgeryError' })
    })
  }
})
