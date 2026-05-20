/**
 * AAP loop smoke test — PZD-18 step 5
 *
 * Harness approach (not full Playwright-electron e2e):
 *   - Boots AgentAnswerEmitter + AgentAnswerRouter in-process
 *   - Synthesizes a kind='design' AAP payload
 *   - Asserts router resolves to { status: 'opened-design' }
 *   - Asserts a mocked renderer IPC listener receives the design:openWithContext event
 *
 * Full Playwright-electron e2e (UI + xvfb) is deferred to PZD-59 runner once
 * the step-4 renderer wire (DesignArtifactCard ← AAP attachment) lands on main.
 * See: apps/electron/visual-tests/ for the Playwright fixture to extend.
 *
 * GAP DOCUMENTED: step 4 (renderer DesignArtifactCard ← AAP) is not yet merged
 * to this branch. The harness validates the emitter→router→IPC leg; the
 * renderer assertion (card appears in chat) is a follow-up gated on step-4 merge.
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { randomUUID } from 'crypto'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// ── Electron mock ─────────────────────────────────────────────────────────────
// Must be established before any module under test is imported.
const ipcHandlers = new Map<string, (_event: unknown, ...args: unknown[]) => unknown>()
const rendererListeners = new Map<string, Array<(...args: unknown[]) => void>>()

const ipcMainMock = {
  handle: mock((channel: string, handler: (_event: unknown, ...args: unknown[]) => unknown) => {
    ipcHandlers.set(channel, handler)
  }),
}

mock.module('electron', () => ({
  ipcMain: ipcMainMock,
  BrowserWindow: {
    getAllWindows: mock(() => []),
    fromWebContents: mock(() => null),
  },
}))

// ── Storage + design-contract mocks ──────────────────────────────────────────
// handleOpenWithContext writes to disk + SQLite; we stub it to keep the test
// hermetic. The real function is exercised by rox-design-ipc.test.ts.
const openWithContextSpy = mock(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))

mock.module('../rox-design-ipc.ts', () => ({
  handleOpenWithContext: openWithContextSpy,
  registerDesignIpcHandlers: mock(() => undefined),
}))

// ── Modules under test (dynamic imports AFTER mocks are registered) ───────────
const { AgentAnswerRouter, registerAgentAnswerRouter } =
  await import('../agent-answer-router.ts') as typeof import('../agent-answer-router.ts')

const { AgentAnswerEmitter } =
  await import('../../../../../packages/server-core/src/sessions/agent-answer-emitter.ts') as
    typeof import('../../../../../packages/server-core/src/sessions/agent-answer-emitter.ts')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDesignRequest() {
  return {
    task: {
      id: randomUUID(),
      description: 'Build a landing page',
      kind: 'landing' as const,
      locale: 'en',
      createdAt: new Date().toISOString(),
    },
    context: {
      sessionId: 'sess-smoke-1',
      workspaceId: null,
      attachedFileIds: [],
      theme: 'light' as const,
      locale: 'en',
    },
    autoLaunched: false,
  }
}

/**
 * Synthesise a fully-valid design AAP directly (bypassing the emitter's
 * text-detection heuristic, which only produces text|code).
 *
 * In production Step 2 would be extended to accept a pre-classified kind;
 * for now the harness injects the shape directly into the router.
 */
function makeDesignAap(turnId: string = randomUUID()) {
  return {
    agentId: 'agent-smoke',
    sessionId: 'sess-smoke-1',
    turnId,
    kind: 'design' as const,
    payload: { kind: 'design' as const, request: makeDesignRequest() },
    createdAt: new Date().toISOString(),
  }
}

// ── Helper: simulate IPC invoke (renderer → main) ─────────────────────────────
async function invokeIpc(channel: string, payload: unknown): Promise<unknown> {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`No IPC handler registered for channel: ${channel}`)
  return handler({}, payload)
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Emitter emits a valid text AAP (existing contract, regression guard)
// ─────────────────────────────────────────────────────────────────────────────

describe('AAP loop smoke · emitter emits valid text AAP', () => {
  it('emits a well-formed kind=text AAP for a plain-text turn', async () => {
    const emittedPackages: unknown[] = []
    const bus = {
      emit: (_actorId: string, pkg: unknown) => { emittedPackages.push(pkg) },
    }

    const emitter = new AgentAnswerEmitter({ bus })
    const pkg = await emitter.emit(
      { agentId: 'agent-smoke', sessionId: 'sess-smoke-1', turnId: randomUUID() },
      { text: 'Hello world' },
    )

    expect(pkg.kind).toBe('text')
    expect(pkg.agentId).toBe('agent-smoke')
    expect(pkg.sessionId).toBe('sess-smoke-1')
    expect(emittedPackages).toHaveLength(1)
    expect(emittedPackages[0]).toMatchObject({ kind: 'text' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Router routes design AAP → openWithContext → opened-design
// ─────────────────────────────────────────────────────────────────────────────

describe('AAP loop smoke · router routes design → opened-design', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter()
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))
  })

  it('resolves to { status: "opened-design" } for a kind=design AAP', async () => {
    const aap = makeDesignAap()
    const result = await router.route(aap)

    expect(result.status).toBe('opened-design')
    expect(openWithContextSpy).toHaveBeenCalledTimes(1)
    expect(openWithContextSpy).toHaveBeenCalledWith(aap.payload.request)
  })

  it('passes the embedded OpenDesignRequest to handleOpenWithContext verbatim', async () => {
    const aap = makeDesignAap()
    await router.route(aap)

    const calledWith = openWithContextSpy.mock.calls[0]?.[0] as ReturnType<typeof makeDesignRequest>
    expect(calledWith?.task?.kind).toBe('landing')
    expect(calledWith?.context?.sessionId).toBe('sess-smoke-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — IPC bridge: agent-answer:dispatch reaches router via registered handler
// ─────────────────────────────────────────────────────────────────────────────

describe('AAP loop smoke · IPC bridge agent-answer:dispatch → router', () => {
  beforeEach(() => {
    ipcHandlers.clear()
    ipcMainMock.handle.mockClear()
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))
  })

  it('registers agent-answer:dispatch on ipcMain and routes design AAP', async () => {
    const router = new AgentAnswerRouter()
    registerAgentAnswerRouter(ipcMainMock as Parameters<typeof registerAgentAnswerRouter>[0], router)

    expect(ipcHandlers.has('agent-answer:dispatch')).toBe(true)

    const aap = makeDesignAap()
    const result = await invokeIpc('agent-answer:dispatch', aap) as { status: string }

    expect(result.status).toBe('opened-design')
    expect(openWithContextSpy).toHaveBeenCalledTimes(1)
  })

  it('routes a text AAP as passthrough (no openWithContext call)', async () => {
    const router = new AgentAnswerRouter()
    registerAgentAnswerRouter(ipcMainMock as Parameters<typeof registerAgentAnswerRouter>[0], router)

    const textAap = {
      agentId: 'agent-smoke',
      sessionId: 'sess-smoke-1',
      turnId: randomUUID(),
      kind: 'text' as const,
      payload: { kind: 'text' as const, text: 'Just text, no design' },
      createdAt: new Date().toISOString(),
    }

    const result = await invokeIpc('agent-answer:dispatch', textAap) as { status: string }

    expect(result.status).toBe('passthrough')
    expect(openWithContextSpy).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — Renderer-side mocked IPC listener receives design:openWithContext
//
// This simulates what the renderer preload bridge would receive after the router
// calls handleOpenWithContext. The actual UI assertion (DesignArtifactCard appears
// in chat under matching turnId) is gated on step-4 renderer wiring landing on main.
//
// GAP: step-4 (renderer ← AAP attachment) not yet merged. When it lands:
//   1. Wire `ipcRenderer.on('agent-answer:design-dispatched', handler)` in renderer
//   2. Assert `DesignArtifactCard[data-turnid=<turnId>]` appears in chat
//   3. Extend apps/electron/visual-tests/aap-loop.spec.ts (Playwright, PZD-59 runner)
// ─────────────────────────────────────────────────────────────────────────────

describe('AAP loop smoke · renderer-mocked IPC listener (step-4 stub)', () => {
  it('documents the gap: renderer listener not yet wired for AAP design events', () => {
    // When step 4 lands, the router (or a wrapping compositor) should call:
    //   webContents.send('agent-answer:design-dispatched', { turnId, artifactId })
    // The renderer would render DesignArtifactCard with data-testid="design-artifact-card".
    //
    // For now we assert the contract shape that step 4 must satisfy:
    const expectedRendererEvent = {
      channel: 'agent-answer:design-dispatched',
      payload: {
        turnId: expect.any(String) as string,
        status: 'opened-design',
      },
    }

    // Stub listener registration (future renderer bridge hook point)
    const rendererDispatchListener = mock((_payload: unknown) => undefined)
    rendererListeners.set('agent-answer:design-dispatched', [rendererDispatchListener])

    // Simulate what the router WILL emit after step-4 wires webContents.send
    const stubPayload = { turnId: randomUUID(), status: 'opened-design' }
    const listeners = rendererListeners.get('agent-answer:design-dispatched') ?? []
    for (const fn of listeners) fn(stubPayload)

    expect(rendererDispatchListener).toHaveBeenCalledTimes(1)
    expect(rendererDispatchListener.mock.calls[0]?.[0]).toMatchObject(
      expectedRendererEvent.payload,
    )
  })
})
