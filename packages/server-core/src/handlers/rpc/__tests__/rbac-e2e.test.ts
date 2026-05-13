/**
 * RBAC end-to-end integration test (M.2 T229) — the Phase 2 stopping condition.
 *
 * Exercises the full lifecycle that T224-T227 wired up:
 *
 *   invite user u1 → grant 'editor' role on workspace W1 → u1 can read W1 →
 *   revoke grant → u1 can no longer read W1
 *
 * Each scenario runs in an isolated `ROX_CONFIG_DIR` and multi-tenant flag
 * state by spawning a child `bun` runner — the same pattern
 * `workspace-rbac-wire.test.ts` and `workspace-scope.test.ts` use, so two
 * scenarios cannot leak runtime singletons (`isMultiTenantActivated`)
 * into one another.
 *
 * The runner imports the production `registerRolesCoreHandlers` and
 * `registerWorkspaceCoreHandlers` registrars, wires them against a fake
 * `RpcServer` that captures handlers into a `Map`, and shares a single
 * `InMemoryGrantStore` between the `RbacResolver` and the admin RPCs so
 * grants flow through the exact chain the resolver consumes at runtime.
 *
 * This test does not change production code. If a scenario surfaces a
 * real backend bug, the bug belongs to T226 / T227 and is logged as a
 * separate ticket per the no-silent-fix rule.
 */

import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../../../../../..')
const rolesModuleUrl = pathToFileURL(resolve(testDir, '../roles.ts')).href
const workspaceModuleUrl = pathToFileURL(resolve(testDir, '../workspace.ts')).href
const runtimeModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/config/storage-scope-runtime.ts')).href
const protocolModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/protocol/index.ts')).href
const rbacModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/auth/rbac-resolver.ts')).href
const rolesSchemaModuleUrl = pathToFileURL(resolve(repoRoot, 'packages/shared/src/auth/roles-schema.ts')).href

type ScenarioName = 'A-lifecycle' | 'B-non-owner' | 'C-global-owner' | 'D-idempotent' | 'E-invalidation'

interface ScenarioResult {
  ok: boolean
  steps: Array<{ name: string; ok: boolean; detail?: unknown }>
  errorName?: string
  message?: string
  stack?: string
}

async function writeWorkspaceFixture(configRoot: string, workspaceId: string): Promise<void> {
  // For multi-tenant scope, fixtures live under `tenants/<workspaceId>/`.
  // For each tenant we need a `config.json` referencing the workspace's
  // own root path. The workspace folder also gets a `config.json` (its
  // own metadata file) plus an `icon.svg` placeholder so the read path
  // does not stat-fail.
  const scopeRoot = join(configRoot, 'tenants', workspaceId)
  const workspaceRoot = join(configRoot, `${workspaceId}-root`)

  await mkdir(workspaceRoot, { recursive: true })
  await writeFile(join(workspaceRoot, 'config.json'), JSON.stringify({
    id: workspaceId,
    name: `${workspaceId} workspace`,
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
        name: `${workspaceId} workspace`,
        rootPath: workspaceRoot,
        createdAt: 0,
      },
    ],
    activeWorkspaceId: workspaceId,
    activeSessionId: null,
  }, null, 2))
}

async function runScenario(scenario: ScenarioName): Promise<ScenarioResult> {
  const tempRoot = await mkdtemp(join(tmpdir(), `rox-rbac-e2e-${scenario}-`))
  const configRoot = join(tempRoot, 'config')

  try {
    await mkdir(configRoot, { recursive: true })
    // Every scenario uses W1; scenarios A & C also touch W2.
    await writeWorkspaceFixture(configRoot, 'W1')
    await writeWorkspaceFixture(configRoot, 'W2')

    const runnerPath = join(tempRoot, 'rbac-e2e-runner.ts')
    await writeFile(runnerPath, `
import { RPC_CHANNELS } from ${JSON.stringify(protocolModuleUrl)}
import { __resetMultiTenantForTests, __setMultiTenantForTests } from ${JSON.stringify(runtimeModuleUrl)}
import { registerRolesCoreHandlers } from ${JSON.stringify(rolesModuleUrl)}
import { registerWorkspaceCoreHandlers } from ${JSON.stringify(workspaceModuleUrl)}
import { InMemoryGrantStore, RbacResolver } from ${JSON.stringify(rbacModuleUrl)}

const scenario = process.env.T229_RBAC_E2E_SCENARIO
if (!scenario) throw new Error('T229_RBAC_E2E_SCENARIO is required')
const configRoot = process.env.ROX_CONFIG_DIR
if (!configRoot) throw new Error('ROX_CONFIG_DIR is required')

const handlers = new Map()
const steps = []

function step(name, fn) {
  return Promise.resolve().then(fn).then(
    (detail) => { steps.push({ name, ok: true, detail }); return detail },
    (error) => {
      steps.push({
        name,
        ok: false,
        detail: {
          errorName: error?.name,
          message: error?.message,
          code: error?.code,
        },
      })
      throw error
    },
  )
}

const server = {
  handle(channel, handler) {
    handlers.set(channel, handler)
  },
  push() {},
  updateClientWorkspace() {},
  async invokeClient() { return undefined },
}

// Single grant store shared across the admin RPC handlers and the resolver.
// Seeded with global-owner for u-admin; tests grant/revoke additional
// roles through the RPC layer to exercise the real wire.
const grantStore = new InMemoryGrantStore([
  { roleId: 'owner', actorKind: 'user', actorId: 'u-admin', scopeKind: 'global', scopeId: null },
])
const rbacResolver = new RbacResolver(grantStore)

const deps = {
  sessionManager: {
    setupConfigWatcher() {},
    clearActiveViewingSession() {},
  },
  windowManager: {
    getWorkspaceForWindow() { return null },
    updateWindowWorkspace() { return true },
    getWindowByWebContentsId() { return null },
    registerWindow() {},
    getAllWindowsForWorkspace() { return [] },
  },
  oauthFlowStore: {},
  // No accountStore: filterOwnedWorkspaces becomes a passthrough, so the
  // forgery semantics under test are entirely the resolver + scope chain.
  rbacResolver,
  grantStore,
  platform: {
    appRootPath: '/',
    resourcesPath: '/',
    isPackaged: false,
    appVersion: '0.0.0-test',
    isDebugMode: true,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    imageProcessor: {
      getMetadata: async () => null,
      process: async (buf) => buf,
    },
  },
}

registerRolesCoreHandlers(server, deps)
registerWorkspaceCoreHandlers(server, deps)

function ctxFor(userId, workspaceId) {
  return {
    clientId: 'client-t229',
    workspaceId: workspaceId ?? null,
    userId,
    webContentsId: 1,
    sessionId: 'session-t229',
  }
}

async function runLifecycle() {
  const grant = handlers.get(RPC_CHANNELS.roles.GRANT)
  const revoke = handlers.get(RPC_CHANNELS.roles.REVOKE)
  const wsGet = handlers.get(RPC_CHANNELS.workspaces.GET)

  // 1. u-admin grants editor on W1 to u1.
  const grantResult = await step('admin-grants-editor', async () => grant(ctxFor('u-admin', null), {
    roleId: 'editor', actorKind: 'user', actorId: 'u1', scopeKind: 'workspace', scopeId: 'W1',
  }))
  if (!grantResult?.ok) throw new Error('grant did not succeed: ' + JSON.stringify(grantResult))

  // 2. u1 reads W1 — should return W1 workspace data.
  const beforeRevoke = await step('u1-reads-W1-allowed', async () => wsGet(ctxFor('u1', 'W1')))
  if (!Array.isArray(beforeRevoke) || beforeRevoke.length === 0 || beforeRevoke[0].id !== 'W1') {
    throw new Error('expected u1 to see W1, got: ' + JSON.stringify(beforeRevoke))
  }

  // 3. u-admin revokes the grant.
  const revokeResult = await step('admin-revokes', async () => revoke(ctxFor('u-admin', null), {
    roleId: 'editor', actorKind: 'user', actorId: 'u1', scopeKind: 'workspace', scopeId: 'W1',
  }))
  if (!(revokeResult?.ok && revokeResult.revoked === true)) {
    throw new Error('revoke did not report revoked=true: ' + JSON.stringify(revokeResult))
  }

  // 4. u1 attempts to read W1 — must throw MultiTenantForgeryError.
  let forgeryThrown = null
  try {
    await wsGet(ctxFor('u1', 'W1'))
  } catch (error) {
    forgeryThrown = error
  }
  steps.push({
    name: 'u1-reads-W1-after-revoke-denied',
    ok: forgeryThrown?.name === 'MultiTenantForgeryError',
    detail: {
      errorName: forgeryThrown?.name ?? null,
      message: forgeryThrown?.message ?? null,
    },
  })
  if (!forgeryThrown || forgeryThrown.name !== 'MultiTenantForgeryError') {
    throw new Error(
      'expected MultiTenantForgeryError after revoke, got: '
      + (forgeryThrown ? forgeryThrown.name + ' / ' + forgeryThrown.message : 'no error'),
    )
  }
}

async function runNonOwner() {
  const grant = handlers.get(RPC_CHANNELS.roles.GRANT)

  // u-admin first seeds u-editor with an editor grant on W1.
  await step('seed-u-editor-grant', async () => grant(ctxFor('u-admin', null), {
    roleId: 'editor', actorKind: 'user', actorId: 'u-editor', scopeKind: 'workspace', scopeId: 'W1',
  }))

  // u-editor tries to grant viewer on W1 to u-other -> permission-denied.
  const denied = await step('u-editor-cannot-grant', async () => grant(ctxFor('u-editor', null), {
    roleId: 'viewer', actorKind: 'user', actorId: 'u-other', scopeKind: 'workspace', scopeId: 'W1',
  }))
  if (denied?.error !== 'permission-denied' || denied.reason !== 'no-owner-grant') {
    throw new Error('expected permission-denied/no-owner-grant, got: ' + JSON.stringify(denied))
  }
}

async function runGlobalOwner() {
  const grant = handlers.get(RPC_CHANNELS.roles.GRANT)
  // u-admin grants on W2 even though it has no W2-scoped grant.
  const result = await step('admin-grants-on-W2', async () => grant(ctxFor('u-admin', null), {
    roleId: 'editor', actorKind: 'user', actorId: 'u1', scopeKind: 'workspace', scopeId: 'W2',
  }))
  if (!result?.ok) {
    throw new Error('expected global owner to grant on W2, got: ' + JSON.stringify(result))
  }
}

async function runIdempotent() {
  const revoke = handlers.get(RPC_CHANNELS.roles.REVOKE)
  const result = await step('revoke-nonexistent', async () => revoke(ctxFor('u-admin', null), {
    roleId: 'viewer', actorKind: 'user', actorId: 'u-phantom', scopeKind: 'workspace', scopeId: 'W1',
  }))
  if (!(result?.ok && result.revoked === false)) {
    throw new Error('expected {ok:true,revoked:false}, got: ' + JSON.stringify(result))
  }
}

async function runInvalidation() {
  const grant = handlers.get(RPC_CHANNELS.roles.GRANT)
  const revoke = handlers.get(RPC_CHANNELS.roles.REVOKE)

  await step('grant-u1-editor-W1', async () => grant(ctxFor('u-admin', null), {
    roleId: 'editor', actorKind: 'user', actorId: 'u1', scopeKind: 'workspace', scopeId: 'W1',
  }))

  const beforeIds = await step('resolver-before-revoke', async () =>
    rbacResolver.permittedWorkspacesForUser('u1')
  )
  if (!Array.isArray(beforeIds) || !beforeIds.includes('W1')) {
    throw new Error('expected resolver to expose W1 before revoke, got: ' + JSON.stringify(beforeIds))
  }

  await step('revoke-u1', async () => revoke(ctxFor('u-admin', null), {
    roleId: 'editor', actorKind: 'user', actorId: 'u1', scopeKind: 'workspace', scopeId: 'W1',
  }))

  const afterIds = await step('resolver-after-revoke', async () =>
    rbacResolver.permittedWorkspacesForUser('u1')
  )
  // After revoke the resolver should immediately return [] — no caching staleness.
  if (!Array.isArray(afterIds) || afterIds.length !== 0) {
    throw new Error('expected [] after revoke, got: ' + JSON.stringify(afterIds))
  }
}

try {
  __resetMultiTenantForTests()
  __setMultiTenantForTests(true)

  switch (scenario) {
    case 'A-lifecycle': await runLifecycle(); break
    case 'B-non-owner': await runNonOwner(); break
    case 'C-global-owner': await runGlobalOwner(); break
    case 'D-idempotent': await runIdempotent(); break
    case 'E-invalidation': await runInvalidation(); break
    default: throw new Error('unknown scenario: ' + scenario)
  }

  console.log(JSON.stringify({ ok: true, steps }))
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    steps,
    errorName: error?.name,
    message: error?.message,
    stack: error?.stack,
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
        T229_RBAC_E2E_SCENARIO: scenario,
      },
    })

    if (result.status !== 0) {
      throw new Error(`rbac e2e runner failed (scenario ${scenario}) with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
    }

    const lastLine = result.stdout.trim().split('\n').filter(Boolean).at(-1)
    if (!lastLine) {
      throw new Error(`rbac e2e runner produced no JSON (scenario ${scenario})\nstderr:\n${result.stderr}`)
    }
    return JSON.parse(lastLine) as ScenarioResult
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

describe('T229 — RBAC end-to-end lifecycle integration', () => {
  it('Scenario A — happy path: grant editor → read allowed → revoke → read denied', async () => {
    const result = await runScenario('A-lifecycle')
    expect(result.ok).toBe(true)
    const stepNames = result.steps.map((s) => s.name)
    expect(stepNames).toEqual([
      'admin-grants-editor',
      'u1-reads-W1-allowed',
      'admin-revokes',
      'u1-reads-W1-after-revoke-denied',
    ])
    for (const step of result.steps) {
      expect(step.ok).toBe(true)
    }
  })

  it('Scenario B — non-owner cannot grant (editor on W1 calling roles.grant is denied)', async () => {
    const result = await runScenario('B-non-owner')
    expect(result.ok).toBe(true)
    const denyStep = result.steps.find((s) => s.name === 'u-editor-cannot-grant')
    expect(denyStep).toBeDefined()
    expect(denyStep!.ok).toBe(true)
    expect(denyStep!.detail).toMatchObject({ error: 'permission-denied', reason: 'no-owner-grant' })
  })

  it('Scenario C — global owner can grant on any workspace (no scope-specific grant required)', async () => {
    const result = await runScenario('C-global-owner')
    expect(result.ok).toBe(true)
    const grantStep = result.steps.find((s) => s.name === 'admin-grants-on-W2')
    expect(grantStep).toBeDefined()
    expect(grantStep!.ok).toBe(true)
    expect(grantStep!.detail).toMatchObject({ ok: true })
  })

  it('Scenario D — revoke is idempotent: revoking a non-existent grant returns {revoked:false}', async () => {
    const result = await runScenario('D-idempotent')
    expect(result.ok).toBe(true)
    const revokeStep = result.steps.find((s) => s.name === 'revoke-nonexistent')
    expect(revokeStep).toBeDefined()
    expect(revokeStep!.ok).toBe(true)
    expect(revokeStep!.detail).toMatchObject({ ok: true, revoked: false })
  })

  it('Scenario E — resolver reflects revoke immediately (no caching staleness)', async () => {
    const result = await runScenario('E-invalidation')
    expect(result.ok).toBe(true)
    const beforeStep = result.steps.find((s) => s.name === 'resolver-before-revoke')
    const afterStep = result.steps.find((s) => s.name === 'resolver-after-revoke')
    expect(beforeStep).toBeDefined()
    expect(afterStep).toBeDefined()
    expect(beforeStep!.detail).toEqual(['W1'])
    expect(afterStep!.detail).toEqual([])
  })
})
