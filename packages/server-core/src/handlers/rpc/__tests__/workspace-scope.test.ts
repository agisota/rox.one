import { describe, expect, it } from 'bun:test'
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

interface WorkspaceScenario {
  multiTenant: boolean
  workspaceId: string | null
  userId?: string
  permittedWorkspaceIds?: string[]
}

interface WorkspaceScenarioResult {
  ok: boolean
  ids?: string[]
  errorName?: string
  message?: string
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

async function runWorkspaceScenario(scenario: WorkspaceScenario): Promise<WorkspaceScenarioResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'rox-workspace-scope-'))
  const configRoot = join(tempRoot, 'config')

  try {
    await writeConfig(configRoot, configRoot, 'FLAT', 'Flat Workspace')
    await writeConfig(configRoot, join(configRoot, 'tenants', 'W42'), 'W42', 'Tenant Workspace')

    const runnerPath = join(tempRoot, 'workspace-scope-runner.ts')
    await writeFile(runnerPath, `
import { RPC_CHANNELS } from ${JSON.stringify(protocolModuleUrl)}
import { __resetMultiTenantForTests, __setMultiTenantForTests } from ${JSON.stringify(runtimeModuleUrl)}
import { registerWorkspaceCoreHandlers } from ${JSON.stringify(workspaceModuleUrl)}

const scenario = JSON.parse(process.env.C4_WORKSPACE_SCOPE_SCENARIO ?? '{}')
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
const accountStore = scenario.permittedWorkspaceIds
  ? {
      async listWorkspaceIds() {
        return scenario.permittedWorkspaceIds ?? []
      },
    }
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
}
registerWorkspaceCoreHandlers(server, deps)
const getWorkspaces = handlers.get(RPC_CHANNELS.workspaces.GET)
if (!getWorkspaces) throw new Error('workspaces.GET handler was not registered')

try {
  __resetMultiTenantForTests()
  __setMultiTenantForTests(Boolean(scenario.multiTenant))
  const result = await getWorkspaces({
    clientId: 'client-workspace-scope-test',
    workspaceId: scenario.workspaceId ?? null,
    userId: scenario.userId,
    webContentsId: 1,
  })
  console.log(JSON.stringify({ ok: true, ids: result.map((workspace) => workspace.id) }))
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
        CRAFT_CONFIG_DIR: configRoot,
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

describe('workspace.ts getWorkspaces scope wiring (C4)', () => {
  it('single-user runtime returns existing flat config data', async () => {
    const result = await runWorkspaceScenario({ multiTenant: false, workspaceId: null })

    expect(result).toMatchObject({ ok: true, ids: ['FLAT'] })
  })

  it('single-user runtime downgrades a requested workspace to flat config data', async () => {
    const result = await runWorkspaceScenario({ multiTenant: false, workspaceId: 'W42' })

    expect(result).toMatchObject({ ok: true, ids: ['FLAT'] })
  })

  it('multi-tenant runtime reads tenant config data for a permitted workspace', async () => {
    const result = await runWorkspaceScenario({
      multiTenant: true,
      workspaceId: 'W42',
      userId: 'u1',
      permittedWorkspaceIds: ['W42'],
    })

    expect(result).toMatchObject({ ok: true, ids: ['W42'] })
  })

  it('multi-tenant runtime rejects requested workspace forgery', async () => {
    const result = await runWorkspaceScenario({
      multiTenant: true,
      workspaceId: 'W_OTHER',
      userId: 'u1',
      permittedWorkspaceIds: ['W42'],
    })

    expect(result).toMatchObject({ ok: false, errorName: 'MultiTenantForgeryError' })
  })

  it('multi-tenant runtime with null workspace id keeps flat config data', async () => {
    const result = await runWorkspaceScenario({ multiTenant: true, workspaceId: null })

    expect(result).toMatchObject({ ok: true, ids: ['FLAT'] })
  })
})
