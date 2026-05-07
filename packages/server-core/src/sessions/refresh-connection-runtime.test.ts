import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { resolveBackendContext } from '@craft-agent/shared/agent/backend'
import { loadWorkspaceConfig } from '@craft-agent/shared/workspaces'
import { SessionManager, createManagedSession } from './SessionManager.ts'
import { buildRestartRequiredSignature } from './runtime-config.ts'

const SHARED_CONFIG_MODULE_PATH = pathToFileURL(join(import.meta.dir, '../../../shared/src/config/index.ts')).href
const SHARED_BACKEND_MODULE_PATH = pathToFileURL(join(import.meta.dir, '../../../shared/src/agent/backend/index.ts')).href
const SHARED_WORKSPACES_MODULE_PATH = pathToFileURL(join(import.meta.dir, '../../../shared/src/workspaces/index.ts')).href
const SESSION_MANAGER_MODULE_PATH = pathToFileURL(join(import.meta.dir, 'SessionManager.ts')).href
const RUNTIME_CONFIG_MODULE_PATH = pathToFileURL(join(import.meta.dir, 'runtime-config.ts')).href

function runHermeticShapeCheck(configRoot: string, workspaceRoot: string): { exitCode: number; stdout: string; stderr: string } {
  const run = Bun.spawnSync([
    process.execPath,
    '--eval',
    `
      process.env.CRAFT_CONFIG_DIR = ${JSON.stringify(configRoot)};
      const { resolveBackendContext } = await import(${JSON.stringify(SHARED_BACKEND_MODULE_PATH)});
      const { saveConfig, ensureConfigDir } = await import(${JSON.stringify(SHARED_CONFIG_MODULE_PATH)});
      const { loadWorkspaceConfig } = await import(${JSON.stringify(SHARED_WORKSPACES_MODULE_PATH)});
      const { SessionManager, createManagedSession } = await import(${JSON.stringify(SESSION_MANAGER_MODULE_PATH)});
      const { buildRestartRequiredSignature } = await import(${JSON.stringify(RUNTIME_CONFIG_MODULE_PATH)});

      const connection = {
        slug: 'slug-A',
        name: 'Shape Check Connection',
        providerType: 'pi',
        authType: 'api_key',
        baseUrl: 'http://127.0.0.1:11111/v1',
        customEndpoint: { api: 'anthropic-messages', supportsImages: true },
        models: [
          { id: 'vision-model', name: 'Vision Model', shortName: 'Vision', description: 'Vision-capable model', provider: 'pi', contextWindow: 262144, supportsImages: true },
          { id: 'text-only-model', name: 'Text Only Model', shortName: 'Text', description: 'Text-only model', provider: 'pi', contextWindow: 131072, supportsImages: false },
          { id: 'plain-model', name: 'Plain Model', shortName: 'Plain', description: 'Plain model', provider: 'pi', contextWindow: 65536 },
        ],
        defaultModel: 'vision-model',
        createdAt: Date.now(),
      };

      ensureConfigDir();
      saveConfig({
        workspaces: [],
        activeWorkspaceId: null,
        activeSessionId: null,
        llmConnections: [connection],
        defaultLlmConnection: connection.slug,
      });

      const agent = {
        isProcessing: () => false,
        updateRuntimeConfig: { mock: { calls: [] }, async implementation(payload) { this.mock.calls.push([payload]); return true; } },
        dispose: () => {},
      };
      agent.updateRuntimeConfig = async (payload) => { agent.updateRuntimeConfig.mock.calls.push([payload]); return true; };
      agent.updateRuntimeConfig.mock = { calls: [] };

      const workspace = { id: 'ws_test', name: 'Test Workspace', rootPath: ${JSON.stringify(workspaceRoot)}, createdAt: Date.now() };
      const managed = createManagedSession({ id: 'shape-check', name: 'shape-check', llmConnection: connection.slug }, workspace, { messagesLoaded: true });
      managed.agent = agent;
      managed.backendRuntimeSignature = '__stale_runtime_signature_for_test__';
      const workspaceConfig = loadWorkspaceConfig(${JSON.stringify(workspaceRoot)});
      const ctx = resolveBackendContext({ sessionConnectionSlug: connection.slug, workspaceDefaultConnectionSlug: workspaceConfig?.defaults?.defaultLlmConnection });
      managed.backendRestartSignature = buildRestartRequiredSignature({ connection: ctx.connection, provider: ctx.provider, authType: ctx.authType, resolvedModel: ctx.resolvedModel });
      managed.llmConnection = connection.slug;

      const sm = new SessionManager();
      sm.sessions.set('shape-check', managed);
      await sm.refreshConnectionRuntime(connection.slug);
      const payload = agent.updateRuntimeConfig.mock.calls[0]?.[0];
      console.log(JSON.stringify({ callCount: agent.updateRuntimeConfig.mock.calls.length, payload, expected: { model: connection.defaultModel, providerType: connection.providerType, authType: connection.authType } }));
    `,
  ], {
    env: { ...process.env, CRAFT_CONFIG_DIR: configRoot },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: run.exitCode,
    stdout: run.stdout.toString().trim(),
    stderr: run.stderr.toString(),
  }
}

interface AgentStub {
  isProcessing: () => boolean
  updateRuntimeConfig: jest.Mock
  dispose: () => void
  disposeForRestart?: () => Promise<void>
}

function createAgentStub(opts: {
  isProcessing?: boolean
  refreshSucceeds?: boolean
  refreshDelayMs?: number
} = {}): AgentStub {
  const delay = opts.refreshDelayMs ?? 0
  const result = opts.refreshSucceeds ?? true
  return {
    isProcessing: () => opts.isProcessing ?? false,
    updateRuntimeConfig: jest.fn().mockImplementation(async () => {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
      return result
    }),
    dispose: () => { /* no-op for tests */ },
  }
}

function injectSession(
  sm: SessionManager,
  id: string,
  workspaceRoot: string,
  llmConnection: string,
  agent: AgentStub | null,
  opts: { backendRuntimeSignature?: string; backendRestartSignature?: string; isProcessing?: boolean } = {},
) {
  const workspace = {
    id: 'ws_test',
    name: 'Test Workspace',
    rootPath: workspaceRoot,
    createdAt: Date.now(),
  }
  const managed = createManagedSession(
    { id, name: id, llmConnection },
    workspace as never,
    { messagesLoaded: true },
  ) as unknown as { agent: AgentStub | null; backendRuntimeSignature?: string; backendRestartSignature?: string; isProcessing: boolean; llmConnection?: string }
  managed.agent = agent
  managed.backendRuntimeSignature = opts.backendRuntimeSignature ?? '__stale_runtime_signature_for_test__'
  if (opts.backendRestartSignature !== undefined) {
    managed.backendRestartSignature = opts.backendRestartSignature
  } else {
    const workspaceConfig = loadWorkspaceConfig(workspaceRoot)
    const ctx = resolveBackendContext({
      sessionConnectionSlug: llmConnection,
      workspaceDefaultConnectionSlug: workspaceConfig?.defaults?.defaultLlmConnection,
    })
    managed.backendRestartSignature = buildRestartRequiredSignature({
      connection: ctx.connection,
      provider: ctx.provider,
      authType: ctx.authType,
      resolvedModel: ctx.resolvedModel,
    })
  }
  managed.isProcessing = opts.isProcessing ?? false
  managed.llmConnection = llmConnection
  ;(sm as unknown as { sessions: Map<string, unknown> }).sessions.set(id, managed)
  return managed
}

describe('refreshConnectionRuntime', () => {
  let tmpRoot: string
  let sm: SessionManager

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'sm-refresh-'))
    sm = new SessionManager()
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('pushes updateRuntimeConfig to sessions on the matching connection slug', async () => {
    const matchingAgent = createAgentStub()
    const otherAgent = createAgentStub()
    injectSession(sm, 'matching', tmpRoot, 'slug-A', matchingAgent)
    injectSession(sm, 'other', tmpRoot, 'slug-B', otherAgent)

    await sm.refreshConnectionRuntime('slug-A')

    expect(matchingAgent.updateRuntimeConfig).toHaveBeenCalledTimes(1)
    expect(otherAgent.updateRuntimeConfig).not.toHaveBeenCalled()
  })

  it('skips sessions whose agent is mid-stream (defers, does not yank)', async () => {
    const busyAgent = createAgentStub({ isProcessing: true })
    injectSession(sm, 'busy', tmpRoot, 'slug-A', busyAgent)

    await sm.refreshConnectionRuntime('slug-A')

    expect(busyAgent.updateRuntimeConfig).not.toHaveBeenCalled()
  })

  it('does not defer just because managed.isProcessing is true (Fix 1 regression)', async () => {
    const idleAgent = createAgentStub({ isProcessing: false })
    injectSession(sm, 'sending', tmpRoot, 'slug-A', idleAgent, { isProcessing: true })

    await sm.refreshConnectionRuntime('slug-A')

    expect(idleAgent.updateRuntimeConfig).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when there is no agent yet (cold session)', async () => {
    injectSession(sm, 'cold', tmpRoot, 'slug-A', null)

    await expect(sm.refreshConnectionRuntime('slug-A')).resolves.toBeUndefined()
  })

  it('disposes the runtime when in-place refresh fails so the next send rebuilds it', async () => {
    const failingAgent = createAgentStub({ refreshSucceeds: false })
    const managed = injectSession(sm, 'failing', tmpRoot, 'slug-A', failingAgent)

    await sm.refreshConnectionRuntime('slug-A')

    expect(failingAgent.updateRuntimeConfig).toHaveBeenCalledTimes(1)
    expect(managed.agent).toBeNull()
  })

  it('skips in-place refresh and forces recreation when a restart-required field changed', async () => {
    const agent = createAgentStub()
    const managed = injectSession(sm, 'auth-changed', tmpRoot, 'slug-A', agent, {
      backendRestartSignature: '__stale_restart_signature__',
    })

    await sm.refreshConnectionRuntime('slug-A')

    expect(agent.updateRuntimeConfig).not.toHaveBeenCalled()
    expect(managed.agent).toBeNull()
  })

  it('serializes concurrent refresh requests via the per-session mutex', async () => {
    const agent = createAgentStub({ refreshDelayMs: 50 })
    injectSession(sm, 'concurrent', tmpRoot, 'slug-A', agent)

    const [first, second] = await Promise.all([
      sm.refreshConnectionRuntime('slug-A'),
      sm.refreshConnectionRuntime('slug-A'),
    ])

    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
    expect(agent.updateRuntimeConfig).toHaveBeenCalledTimes(1)
  })

  it('records customModels with the per-model supportsImages flag in the IPC payload', async () => {
    const configRoot = mkdtempSync(join(tmpdir(), 'sm-refresh-config-'))
    try {
      const run = runHermeticShapeCheck(configRoot, tmpRoot)
      expect(run.exitCode).toBe(0)
      const jsonLine = run.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)
      expect(jsonLine).toBeString()
      const result = JSON.parse(jsonLine as string)
      expect(result.callCount).toBe(1)
      expect(result.payload).toMatchObject({
        model: result.expected.model,
        providerType: result.expected.providerType,
        authType: result.expected.authType,
        runtime: expect.any(Object),
      })
      if (result.payload.runtime?.customModels) {
        for (const m of result.payload.runtime.customModels) {
          if (typeof m === 'object') {
            expect(typeof m.id).toBe('string')
            if ('supportsImages' in m) {
              expect(typeof m.supportsImages).toBe('boolean')
            }
          }
        }
      }
    } finally {
      rmSync(configRoot, { recursive: true, force: true })
    }
  })
})
