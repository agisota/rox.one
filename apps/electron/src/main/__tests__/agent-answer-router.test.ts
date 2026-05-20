/**
 * TDD: AgentAnswerRouter (PZD-18 step 3)
 *
 * Routes AgentAnswerPackage by kind:
 *   text/code  → passthrough
 *   design     → design:openWithContext IPC
 *   mixed      → recurse parts serially
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { randomUUID } from 'crypto'
import type { AgentAnswerPackage } from '@rox-one/agent-contract'

// ── Electron mock ──────────────────────────────────────────────────────────────
type IpcHandler = (_event: unknown, aap: unknown) => Promise<unknown>
const handleMock = mock((_channel: string, _handler: IpcHandler) => undefined)
const ipcMainMock = { handle: handleMock }

mock.module('electron', () => ({
  ipcMain: ipcMainMock,
}))

// ── IPC invoke spy — simulates calling design:openWithContext ─────────────────
// Injected into AgentAnswerRouter so this test does not globally mock
// rox-design-ipc.ts and leak into the real rox-design-ipc test file.
type OpenWithContextResult =
  | { status: 'opened'; windowId: number }
  | { status: 'failed'; reason: string }
const openWithContextSpy = mock(async (_raw: unknown): Promise<OpenWithContextResult> => ({ status: 'opened', windowId: 0 }))

// ── Module under test ─────────────────────────────────────────────────────────
const { AgentAnswerRouter, registerAgentAnswerRouter } =
  await import('../agent-answer-router.ts') as typeof import('../agent-answer-router.ts')

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeTextAap() {
  return {
    agentId: 'agent-1',
    sessionId: 'sess-1',
    turnId: randomUUID(),
    kind: 'text' as const,
    payload: { kind: 'text' as const, text: 'Hello world' },
    createdAt: new Date().toISOString(),
  }
}

function makeCodeAap() {
  return {
    agentId: 'agent-1',
    sessionId: 'sess-1',
    turnId: randomUUID(),
    kind: 'code' as const,
    payload: { kind: 'code' as const, language: 'typescript', text: 'const x = 1' },
    createdAt: new Date().toISOString(),
  }
}

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
      sessionId: 'sess-1',
      workspaceId: null,
      attachedFileIds: [],
      theme: 'light' as const,
      locale: 'en',
    },
    autoLaunched: false,
  }
}

function makeDesignAap() {
  return {
    agentId: 'agent-1',
    sessionId: 'sess-1',
    turnId: randomUUID(),
    kind: 'design' as const,
    payload: { kind: 'design' as const, request: makeDesignRequest() },
    createdAt: new Date().toISOString(),
  }
}

type MixedPayload = Extract<AgentAnswerPackage['payload'], { kind: 'mixed' }>
type MixedPart = MixedPayload['parts'][number]

function makeMixedAap(...payloadParts: MixedPart[]): AgentAnswerPackage {
  return {
    agentId: 'agent-1',
    sessionId: 'sess-1',
    turnId: randomUUID(),
    kind: 'mixed' as const,
    payload: { kind: 'mixed' as const, parts: payloadParts },
    createdAt: new Date().toISOString(),
  }
}

// ── Cycle 1 & 2: text → passthrough ──────────────────────────────────────────
describe('AgentAnswerRouter · text passthrough', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter(openWithContextSpy)
    openWithContextSpy.mockClear()
  })

  it('returns { status: "passthrough" } for kind=text', async () => {
    const result = await router.route(makeTextAap())
    expect(result.status).toBe('passthrough')
    expect(openWithContextSpy).not.toHaveBeenCalled()
  })

  it('returns { status: "passthrough" } for kind=code', async () => {
    const result = await router.route(makeCodeAap())
    expect(result.status).toBe('passthrough')
    expect(openWithContextSpy).not.toHaveBeenCalled()
  })
})

// ── Cycle 3 & 4: design → openWithContext ────────────────────────────────────
describe('AgentAnswerRouter · design routing', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter(openWithContextSpy)
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))
  })

  it('calls openWithContext with the embedded request and returns opened-design', async () => {
    const aap = makeDesignAap()
    const result = await router.route(aap)
    expect(result.status).toBe('opened-design')
    expect(openWithContextSpy).toHaveBeenCalledTimes(1)
    expect(openWithContextSpy).toHaveBeenCalledWith(aap.payload.request)
  })
})

// ── Cycle 5 & 6: design with invalid request → failed ────────────────────────
describe('AgentAnswerRouter · design validation failure', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter(openWithContextSpy)
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown): Promise<OpenWithContextResult> => ({ status: 'failed', reason: 'invalid request' }))
  })

  it('returns { status: "failed" } when openWithContext returns failed', async () => {
    const aap = makeDesignAap()
    const result = await router.route(aap)
    expect(result.status).toBe('failed')
  })
})

// ── Cycle 7 & 8: mixed with text + design parts ───────────────────────────────
describe('AgentAnswerRouter · mixed routing (2 text + 1 design)', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter(openWithContextSpy)
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))
  })

  it('routes each part in order; returns mixed-completed', async () => {
    const order: string[] = []
    openWithContextSpy.mockImplementation(async (_raw: unknown) => {
      order.push('design')
      return { status: 'opened', windowId: 0 }
    })

    const aap = makeMixedAap(
      { kind: 'text', text: 'Part 1' },
      { kind: 'text', text: 'Part 2' },
      { kind: 'design', request: makeDesignRequest() },
    )
    const result = await router.route(aap)

    expect(result.status).toBe('mixed-completed')
    expect(openWithContextSpy).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['design'])
  })
})

// ── Cycle 9 & 10: nested mixed recurses correctly ────────────────────────────
describe('AgentAnswerRouter · nested mixed recursion', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter(openWithContextSpy)
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))
  })

  it('recurses into nested mixed parts', async () => {
    const innerMixed = {
      kind: 'mixed' as const,
      parts: [
        { kind: 'design' as const, request: makeDesignRequest() },
      ],
    }
    const aap = makeMixedAap(
      { kind: 'text', text: 'Outer text' },
      innerMixed,
    )
    const result = await router.route(aap)

    expect(result.status).toBe('mixed-completed')
    expect(openWithContextSpy).toHaveBeenCalledTimes(1)
  })
})

// ── Cycle 11 & 12: failure in one part doesn't block others ──────────────────
describe('AgentAnswerRouter · partial failure in mixed', () => {
  let router: InstanceType<typeof AgentAnswerRouter>

  beforeEach(() => {
    router = new AgentAnswerRouter(openWithContextSpy)
    openWithContextSpy.mockClear()
  })

  it('continues routing other parts and lists failed parts', async () => {
    let callCount = 0
    openWithContextSpy.mockImplementation(async (_raw: unknown): Promise<OpenWithContextResult> => {
      callCount++
      if (callCount === 1) return { status: 'failed', reason: 'design storage error' }
      return { status: 'opened', windowId: 0 }
    })

    const aap = makeMixedAap(
      { kind: 'design', request: makeDesignRequest() },
      { kind: 'design', request: makeDesignRequest() },
    )
    const result = await router.route(aap)

    expect(result.status).toBe('mixed-completed')
    expect(openWithContextSpy).toHaveBeenCalledTimes(2)
    expect(result.details).toBeDefined()
    expect((result.details as { failedParts: number }).failedParts).toBe(1)
  })
})

// ── Cycle 13 & 14: registerAgentAnswerRouter wires ipcMain handler ────────────
describe('registerAgentAnswerRouter · ipcMain integration', () => {
  it('registers the agent-answer:dispatch handler on ipcMain', () => {
    handleMock.mockClear()
    const router = new AgentAnswerRouter(openWithContextSpy)
    registerAgentAnswerRouter(ipcMainMock as Parameters<typeof registerAgentAnswerRouter>[0], router)
    expect(handleMock).toHaveBeenCalledTimes(1)
    expect(handleMock.mock.calls[0][0]).toBe('agent-answer:dispatch')
  })

  it('dispatches via route() when handler is invoked', async () => {
    handleMock.mockClear()
    openWithContextSpy.mockClear()
    openWithContextSpy.mockImplementation(async (_raw: unknown) => ({ status: 'opened', windowId: 0 }))

    const router = new AgentAnswerRouter(openWithContextSpy)
    registerAgentAnswerRouter(ipcMainMock as Parameters<typeof registerAgentAnswerRouter>[0], router)

    // Simulate ipcMain invoke: grab the registered callback and call it
    const registeredCallback = handleMock.mock.calls[0][1] as unknown as (_event: unknown, aap: unknown) => Promise<unknown>
    const aap = makeDesignAap()
    const result = await registeredCallback({}, aap)

    expect((result as { status: string }).status).toBe('opened-design')
  })
})
