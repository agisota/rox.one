import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../../../../../..')
const workspaceModuleUrl = pathToFileURL(resolve(testDir, '../workspace.ts')).href
const storageScopeModuleUrl = pathToFileURL(resolve(testDir, '../storage-scope.ts')).href
const runtimeModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/config/storage-scope-runtime.ts')).href
const protocolModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/protocol/index.ts')).href
const rbacResolverModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/auth/rbac-resolver.ts')).href

interface WireScenario {
  multiTenant: boolean
  userId: string
  requestedWorkspaceId: string
  resolverGrants: Array<{
    actorId: string
    scopeKind: 'workspace' | 'org' | 'global'
    scopeId: string | null
    roleId: 'owner' | 'editor' | 'viewer'
  }> | null
  accountStorePermitted: string[]
  expect: 'allow' | 'forgery'
}

interface WireScenarioResult {
  ok: boolean
  marker?: string
  scopeKind?: string
  scopeWorkspaceId?: string
  resolverCalls?: string[]
  accountStoreCalls?: string[]
  errorName?: string
  message?: string
}

async function writeFixtures(configRoot: string, scopeRoot: string, workspaceId: string, marker: string): Promise<void> {
  const workspaceRoot = join(configRoot, `${workspaceId}-root`)
  await mkdir(workspaceRoot, { recursive: true })
  await writeFile(join(workspaceRoot, 'config.json'), JSON.stringify({
    id: workspaceId,
    name: `${marker} workspace`,
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
        name: `${marker} workspace`,
        rootPath: workspaceRoot,
        createdAt: 0,
      },
    ],
    activeWorkspaceId: workspaceId,
    activeSessionId: null,
  }, null, 2))
}

async function runWireScenario(scenario: WireScenario): Promise<WireScenarioResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'rox-rbac-wire-'))
  const configRoot = join(tempRoot, 'config')

  try {
    await writeFixtures(configRoot, configRoot, 'FLAT', 'flat')
    await writeFixtures(configRoot, join(configRoot, 'tenants', 'W42'), 'W42', 'tenant')

    const runnerPath = join(tempRoot, 'rbac-wire-runner.ts')
    await writeFile(runnerPath, `
import { RPC_CHANNELS } from ${JSON.stringify(protocolModuleUrl)}
import { __resetMultiTenantForTests, __setMultiTenantForTests } from ${JSON.stringify(runtimeModuleUrl)}
import { registerWorkspaceCoreHandlers } from ${JSON.stringify(workspaceModuleUrl)}
import { deriveRpcWorkspaceScope } from ${JSON.stringify(storageScopeModuleUrl)}
import { InMemoryGrantStore, RbacResolver } from ${JSON.stringify(rbacResolverModuleUrl)}

const scenario = JSON.parse(process.env.T226_WIRE_SCENARIO ?? '{}')
const configRoot = process.env.CRAFT_CONFIG_DIR
if (!configRoot) throw new Error('CRAFT_CONFIG_DIR is required')

const handlers = new Map()
const watcherRoots = []
const grants = []
const resolverCalls = []
const accountStoreCalls = []

const server = {
  handle(channel, handler) {
    handlers.set(channel, handler)
  },
  push() {},
  updateClientWorkspace() {},
  async invokeClient() {
    return undefined
  },
}

const accountStore = {
  async listWorkspaceIds(userId) {
    accountStoreCalls.push(userId)
    return scenario.accountStorePermitted ?? []
  },
  async isWorkspaceOwner() {
    return true
  },
  async grantWorkspaceOwner(userId, workspaceId) {
    grants.push({ userId, workspaceId })
  },
}

let rbacResolver
if (Array.isArray(scenario.resolverGrants)) {
  const store = new InMemoryGrantStore(
    scenario.resolverGrants.map((g) => ({
      roleId: g.roleId,
      actorKind: 'user',
      actorId: g.actorId,
      scopeKind: g.scopeKind,
      scopeId: g.scopeId,
    }))
  )
  // Wrap the resolver to capture the userId argument for observability.
  const inner = new RbacResolver(store)
  rbacResolver = {
    async permittedWorkspacesForUser(userId) {
      resolverCalls.push(userId)
      return inner.permittedWorkspacesForUser(userId)
    },
  }
}

const deps = {
  sessionManager: {
    setupConfigWatcher(rootPath, workspaceId) {
      watcherRoots.push({ rootPath, workspaceId })
    },
    clearActiveViewingSession() {},
  },
  windowManager: {
    getWorkspaceForWindow() {
      return scenario.requestedWorkspaceId ?? null
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
  accountStore,
  rbacResolver,
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
  const ctx = {
    clientId: 'client-t226-wire',
    workspaceId: scenario.requestedWorkspaceId ?? null,
    userId: scenario.userId,
    webContentsId: 1,
    sessionId: 'session-t226-wire',
  }
  const scope = await deriveRpcWorkspaceScope(deps, ctx, scenario.requestedWorkspaceId)
  const marker = scope.kind === 'workspace' ? scope.workspaceId : 'flat'
  console.log(JSON.stringify({
    ok: true,
    marker,
    scopeKind: scope.kind,
    scopeWorkspaceId: scope.kind === 'workspace' ? scope.workspaceId : undefined,
    resolverCalls,
    accountStoreCalls,
  }))
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    errorName: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    resolverCalls,
    accountStoreCalls,
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
        CRAFT_CONFIG_DIR: configRoot,
        T226_WIRE_SCENARIO: JSON.stringify(scenario),
      },
    })

    if (result.status !== 0) {
      throw new Error(`rbac wire runner failed with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }

    const lastLine = result.stdout.trim().split('\n').filter(Boolean).at(-1)
    if (!lastLine) {
      throw new Error(`rbac wire runner produced no JSON\nstderr:\n${result.stderr}`)
    }
    return JSON.parse(lastLine) as WireScenarioResult
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

describe('T226 — RBAC resolver wire-in for session.permittedWorkspaces', () => {
  it('uses the resolver and bypasses AccountStore when resolver is provided (multi-tenant allow)', async () => {
    const result = await runWireScenario({
      multiTenant: true,
      userId: 'u1',
      requestedWorkspaceId: 'W42',
      resolverGrants: [
        { actorId: 'u1', scopeKind: 'workspace', scopeId: 'W42', roleId: 'viewer' },
      ],
      accountStorePermitted: [],
      expect: 'allow',
    })

    expect(result.ok).toBe(true)
    expect(result.scopeKind).toBe('workspace')
    expect(result.scopeWorkspaceId).toBe('W42')
    expect(result.resolverCalls).toEqual(['u1'])
    expect(result.accountStoreCalls).toEqual([])
  })

  it('falls back to AccountStore.listWorkspaceIds when no resolver is provided (C.4 backward compat)', async () => {
    const result = await runWireScenario({
      multiTenant: true,
      userId: 'u1',
      requestedWorkspaceId: 'W42',
      resolverGrants: null,
      accountStorePermitted: ['W42'],
      expect: 'allow',
    })

    expect(result.ok).toBe(true)
    expect(result.scopeKind).toBe('workspace')
    expect(result.scopeWorkspaceId).toBe('W42')
    expect(result.accountStoreCalls).toEqual(['u1'])
    expect(result.resolverCalls).toEqual([])
  })

  it('preserves MultiTenantForgeryError semantics when resolver denies access', async () => {
    const result = await runWireScenario({
      multiTenant: true,
      userId: 'u1',
      requestedWorkspaceId: 'W_OTHER',
      resolverGrants: [
        { actorId: 'u1', scopeKind: 'workspace', scopeId: 'W42', roleId: 'viewer' },
      ],
      accountStorePermitted: ['W_OTHER'],
      expect: 'forgery',
    })

    expect(result.ok).toBe(false)
    expect(result.errorName).toBe('MultiTenantForgeryError')
    expect(result.resolverCalls).toEqual(['u1'])
  })

  it('honors the resolver global sentinel (owner of every workspace)', async () => {
    const result = await runWireScenario({
      multiTenant: true,
      userId: 'u1',
      requestedWorkspaceId: 'W42',
      resolverGrants: [
        { actorId: 'u1', scopeKind: 'global', scopeId: null, roleId: 'owner' },
      ],
      accountStorePermitted: [],
      expect: 'allow',
    })

    expect(result.ok).toBe(true)
    expect(result.scopeKind).toBe('workspace')
    expect(result.scopeWorkspaceId).toBe('W42')
    expect(result.resolverCalls).toEqual(['u1'])
  })

  it('preserves single-user flat scope when multi-tenant runtime is off (resolver wired but not consulted)', async () => {
    const result = await runWireScenario({
      multiTenant: false,
      userId: 'u1',
      requestedWorkspaceId: 'FLAT',
      resolverGrants: [],
      accountStorePermitted: [],
      expect: 'allow',
    })

    expect(result.ok).toBe(true)
    expect(result.scopeKind).toBe('local-single-user')
  })
})
