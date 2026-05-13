import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DEFAULT_LOCAL_SCOPE } from '../../../../../shared/src/config/storage-scope.ts'
import {
  SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE,
  SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE_REASON,
} from '../storage-scope'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../../../../../..')
const rpcDir = resolve(testDir, '..')
const settingsModuleUrl = pathToFileURL(resolve(testDir, '../settings.ts')).href
const runtimeModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/config/storage-scope-runtime.ts')).href
const protocolModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/protocol/index.ts')).href

function source(relativePath: string): string {
  return readFileSync(join(rpcDir, relativePath), 'utf8')
}

function writeConfig(scopeRoot: string, workspaceRoot: string, marker: 'flat' | 'tenant'): void {
  mkdirSync(scopeRoot, { recursive: true })
  mkdirSync(workspaceRoot, { recursive: true })
  writeFileSync(
    join(scopeRoot, 'config.json'),
    JSON.stringify({
      workspaces: [
        {
          id: 'W42',
          name: `${marker} workspace`,
          rootPath: workspaceRoot,
          createdAt: 0,
        },
      ],
      activeWorkspaceId: 'W42',
      activeSessionId: null,
      defaultThinkingLevel: 'low',
    }, null, 2),
    'utf8',
  )
  writeFileSync(
    join(workspaceRoot, 'config.json'),
    JSON.stringify({
      id: 'W42',
      name: `${marker} workspace config`,
      defaults: {
        model: `${marker}-model`,
      },
    }, null, 2),
    'utf8',
  )
}

interface SettingsScenario {
  operation: 'workspace.SETTINGS_GET' | 'settings.SET_DEFAULT_THINKING_LEVEL'
  multiTenant: boolean
  contextWorkspaceId: string | null
  requestedWorkspaceId?: string
  level?: string
  userId?: string
  permittedWorkspaceIds?: string[]
}

interface SettingsScenarioResult {
  ok: boolean
  result?: any
  errorName?: string
  message?: string
  flatConfig?: Record<string, unknown>
  tenantConfig?: Record<string, unknown>
}

function runSettingsScenario(scenario: SettingsScenario): SettingsScenarioResult {
  const tempRoot = mkdtempSync(join(tmpdir(), 'rox-server-core-rpc-scope-'))
  const configRoot = join(tempRoot, 'config')

  try {
    writeConfig(configRoot, join(configRoot, 'flat-workspace'), 'flat')
    writeConfig(join(configRoot, 'tenants', 'W42'), join(configRoot, 'tenant-workspace'), 'tenant')

    const runnerPath = join(tempRoot, 'server-core-rpc-scope-runner.ts')
    writeFileSync(runnerPath, `
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RPC_CHANNELS } from ${JSON.stringify(protocolModuleUrl)}
import { __resetMultiTenantForTests, __setMultiTenantForTests } from ${JSON.stringify(runtimeModuleUrl)}
import { registerSettingsHandlers } from ${JSON.stringify(settingsModuleUrl)}

const scenario = JSON.parse(process.env.C4_SERVER_CORE_RPC_SCOPE_SCENARIO ?? '{}')
const configRoot = process.env.CRAFT_CONFIG_DIR
if (!configRoot) throw new Error('CRAFT_CONFIG_DIR is required')

const handlers = new Map()
const server = {
  handle(channel, handler) {
    handlers.set(channel, handler)
  },
  push() {},
  async invokeClient() {
    return undefined
  },
}

const deps = {
  sessionManager: {
    async getSession() {
      return null
    },
    async updateSessionModel() {},
  },
  platform: {
    appRootPath: '',
    resourcesPath: '',
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
      async getMetadata() {
        return null
      },
      async process() {
        return Buffer.from('')
      },
    },
  },
  oauthFlowStore: {
    store: () => {},
    getByState: () => null,
    remove: () => {},
    cleanup: () => {},
    dispose: () => {},
    get size() { return 0 },
  },
  accountStore: {
    async listWorkspaceIds() {
      return scenario.permittedWorkspaceIds ?? []
    },
    async isWorkspaceOwner() {
      return true
    },
    async grantWorkspaceOwner() {},
  },
}

function readConfig(scopeRoot) {
  return JSON.parse(readFileSync(join(scopeRoot, 'config.json'), 'utf8'))
}

function snapshot(payload) {
  return {
    ...payload,
    flatConfig: readConfig(configRoot),
    tenantConfig: readConfig(join(configRoot, 'tenants', 'W42')),
  }
}

registerSettingsHandlers(server, deps)

try {
  __resetMultiTenantForTests()
  __setMultiTenantForTests(Boolean(scenario.multiTenant))
  const ctx = {
    clientId: 'client-server-core-rpc-scope',
    workspaceId: scenario.contextWorkspaceId ?? null,
    webContentsId: null,
    userId: scenario.userId,
    sessionId: 'session-server-core-rpc-scope',
    userRole: 'admin',
  }

  let result
  if (scenario.operation === 'workspace.SETTINGS_GET') {
    const handler = handlers.get(RPC_CHANNELS.workspace.SETTINGS_GET)
    if (!handler) throw new Error('workspace.SETTINGS_GET handler was not registered')
    result = await handler(ctx, scenario.requestedWorkspaceId)
  } else if (scenario.operation === 'settings.SET_DEFAULT_THINKING_LEVEL') {
    const handler = handlers.get(RPC_CHANNELS.settings.SET_DEFAULT_THINKING_LEVEL)
    if (!handler) throw new Error('settings.SET_DEFAULT_THINKING_LEVEL handler was not registered')
    result = await handler(ctx, scenario.level)
  } else {
    throw new Error('Unknown operation: ' + scenario.operation)
  }

  console.log(JSON.stringify(snapshot({ ok: true, result })))
} catch (error) {
  console.log(JSON.stringify(snapshot({
    ok: false,
    errorName: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
  })))
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
        C4_SERVER_CORE_RPC_SCOPE_SCENARIO: JSON.stringify(scenario),
      },
    })

    if (result.status !== 0) {
      throw new Error(`server-core RPC scope runner failed with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }

    const lastLine = result.stdout.trim().split('\n').filter(Boolean).at(-1)
    if (!lastLine) {
      throw new Error(`server-core RPC scope runner produced no JSON\nstderr:\n${result.stderr}`)
    }
    return JSON.parse(lastLine) as SettingsScenarioResult
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

describe('server-core RPC storage scope contract (C4)', () => {
  it('documents server-core RPC global settings with a named storage scope', () => {
    expect(SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE).toBe(DEFAULT_LOCAL_SCOPE)
    expect(SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE.kind).toBe('local-single-user')
    expect(SERVER_CORE_RPC_GLOBAL_STORAGE_SCOPE_REASON).toContain('admin/global')
  })

  it('centralizes direct DEFAULT_LOCAL_SCOPE usage away from target RPC handler files', () => {
    for (const relativePath of ['system.ts', 'settings.ts', 'llm-connections.ts']) {
      expect(source(relativePath)).not.toContain('DEFAULT_LOCAL_SCOPE')
    }
  })

  it('routes workspace settings reads through tenant storage under multi-tenant runtime', () => {
    const result = runSettingsScenario({
      operation: 'workspace.SETTINGS_GET',
      multiTenant: true,
      contextWorkspaceId: 'W42',
      requestedWorkspaceId: 'W42',
      userId: 'u1',
      permittedWorkspaceIds: ['W42'],
    })

    expect(result.ok).toBe(true)
    expect(result.result.model).toBe('tenant-model')
  })

  it('rejects forged workspace settings reads before flat storage fallback', () => {
    const result = runSettingsScenario({
      operation: 'workspace.SETTINGS_GET',
      multiTenant: true,
      contextWorkspaceId: 'W_OTHER',
      requestedWorkspaceId: 'W_OTHER',
      userId: 'u1',
      permittedWorkspaceIds: ['W42'],
    })

    expect(result.ok).toBe(false)
    expect(result.errorName).toBe('MultiTenantForgeryError')
  })

  it('keeps documented global settings in flat storage under multi-tenant runtime', () => {
    const result = runSettingsScenario({
      operation: 'settings.SET_DEFAULT_THINKING_LEVEL',
      multiTenant: true,
      contextWorkspaceId: 'W42',
      userId: 'u1',
      permittedWorkspaceIds: ['W42'],
      level: 'high',
    })

    expect(result.ok).toBe(true)
    expect(result.flatConfig?.defaultThinkingLevel).toBe('high')
    expect(result.tenantConfig?.defaultThinkingLevel).toBe('low')
  })
})
