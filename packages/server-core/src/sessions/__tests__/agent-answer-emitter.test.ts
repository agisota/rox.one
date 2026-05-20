import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ZodError } from 'zod'
import { AgentAnswerEmitter } from '../agent-answer-emitter'
import type { TurnContext, AgentOutput } from '../agent-answer-emitter'
import { SessionManager, createManagedSession } from '../SessionManager.ts'

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const BASE_TURN: TurnContext = {
  agentId: 'agent-abc',
  sessionId: 'session-123',
  turnId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
}

function makeBus() {
  const calls: Array<{ actorId: string; payload: unknown }> = []
  const bus = {
    emit: (actorId: string, payload: unknown) => {
      calls.push({ actorId, payload })
    },
    calls,
  }
  return bus
}

// ────────────────────────────────────────────────────────────────
// Cycle 1 — emit() with plain text returns AAP kind='text'
// ────────────────────────────────────────────────────────────────

describe('AgentAnswerEmitter', () => {
  describe('Cycle 1 — plain text → kind=text', () => {
    it('returns an AgentAnswerPackage with kind=text for plain text output', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const output: AgentOutput = { text: 'Hello world' }

      const pkg = await emitter.emit(BASE_TURN, output)

      expect(pkg.kind).toBe('text')
      expect(pkg.agentId).toBe('agent-abc')
      expect(pkg.sessionId).toBe('session-123')
      expect(pkg.turnId).toBe(BASE_TURN.turnId)
      expect(pkg.payload).toMatchObject({ kind: 'text', text: 'Hello world' })
      expect(pkg.createdAt).toBeTruthy()
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Cycle 2 — zod validation throws on invalid output
  // ────────────────────────────────────────────────────────────────

  describe('Cycle 2 — zod validation throws on invalid output', () => {
    it('throws when the produced AAP fails validation', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus, _forceInvalidForTest: true })
      const output: AgentOutput = { text: 'hello' }

      await expect(emitter.emit(BASE_TURN, output)).rejects.toBeInstanceOf(Error)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Cycle 3 — code-detected output (``` fences) → kind='code'
  // ────────────────────────────────────────────────────────────────

  describe('Cycle 3 — code fence detection → kind=code', () => {
    it('returns kind=code with language when output contains a markdown code fence', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const codeText = '```typescript\nconst x = 1\n```'
      const output: AgentOutput = { text: codeText }

      const pkg = await emitter.emit(BASE_TURN, output)

      expect(pkg.kind).toBe('code')
      expect(pkg.payload).toMatchObject({ kind: 'code', language: 'typescript', text: codeText })
    })

    it('returns kind=code with language=plaintext for unlabelled fences', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const output: AgentOutput = { text: '```\nsome code\n```' }

      const pkg = await emitter.emit(BASE_TURN, output)

      expect(pkg.kind).toBe('code')
      if (pkg.payload.kind === 'code') {
        expect(pkg.payload.language).toBe('plaintext')
      }
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Cycle 4 — emit() dispatches on the event bus (spy)
  // ────────────────────────────────────────────────────────────────

  describe('Cycle 4 — bus dispatch', () => {
    it('calls bus.emit once with the sessionId and the AAP', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const output: AgentOutput = { text: 'dispatched' }

      const pkg = await emitter.emit(BASE_TURN, output)

      expect(bus.calls).toHaveLength(1)
      expect(bus.calls[0]?.actorId).toBe(BASE_TURN.sessionId)
      expect(bus.calls[0]?.payload).toEqual(pkg)
    })

    it('does not dispatch when emit throws (validation error path)', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus, _forceInvalidForTest: true })
      const output: AgentOutput = { text: 'hello' }

      await expect(emitter.emit(BASE_TURN, output)).rejects.toBeInstanceOf(Error)
      expect(bus.calls).toHaveLength(0)
    })
  })

  // ────────────────────────────────────────────────────────────────
  // Cycle 5 — rate limiting 3 AAPs/sec per session
  // ────────────────────────────────────────────────────────────────

  describe('Cycle 5 — rate limiting 3/sec per session', () => {
    it('allows 3 calls within 1 second for the same session', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const output: AgentOutput = { text: 'ping' }

      const p1 = emitter.emit(BASE_TURN, output)
      const p2 = emitter.emit(BASE_TURN, output)
      const p3 = emitter.emit(BASE_TURN, output)

      await expect(Promise.all([p1, p2, p3])).resolves.toHaveLength(3)
    })

    it('rejects with a backpressure error on the 4th call within 1 second', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const output: AgentOutput = { text: 'ping' }

      await emitter.emit(BASE_TURN, output)
      await emitter.emit(BASE_TURN, output)
      await emitter.emit(BASE_TURN, output)

      await expect(emitter.emit(BASE_TURN, output)).rejects.toMatchObject({
        message: expect.stringContaining('backpressure'),
      })
    })

    it('allows a 4th call for a DIFFERENT session (rate limit is per-session)', async () => {
      const bus = makeBus()
      const emitter = new AgentAnswerEmitter({ bus })
      const output: AgentOutput = { text: 'ping' }
      const other: TurnContext = { ...BASE_TURN, sessionId: 'session-other' }

      await emitter.emit(BASE_TURN, output)
      await emitter.emit(BASE_TURN, output)
      await emitter.emit(BASE_TURN, output)

      await expect(emitter.emit(other, output)).resolves.toBeDefined()
    })
  })
})

// ────────────────────────────────────────────────────────────────
// Cycle 9-10 — SessionManager integration: emitter.emit called once per turn
// ────────────────────────────────────────────────────────────────

describe('SessionManager integration — AgentAnswerEmitter wiring', () => {
  let tmpRoot: string
  let sm: SessionManager

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'sm-aap-'))
    sm = new SessionManager()
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function buildSession(id: string) {
    const workspace = {
      id: 'ws_aap_test',
      name: 'AAP Test Workspace',
      rootPath: tmpRoot,
      createdAt: Date.now(),
    }
    const managed = createManagedSession(
      { id, name: 'aap integration test' },
      workspace as never,
      { messagesLoaded: true },
    )
    ;(sm as unknown as { sessions: Map<string, unknown> }).sessions.set(id, managed)
    return managed
  }

  it('emitter.emit() is called once when processEvent receives text_complete', async () => {
    const sessionId = 'aap-integration-session'
    const turnId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    buildSession(sessionId)

    const emitSpy = spyOn(AgentAnswerEmitter.prototype, 'emit').mockResolvedValue({
      agentId: sessionId,
      sessionId,
      turnId,
      kind: 'text',
      payload: { kind: 'text', text: 'hello' },
      createdAt: new Date().toISOString(),
    } as never)

    const smInternal = sm as unknown as {
      processEvent: (managed: unknown, event: unknown) => Promise<void>
      sessions: Map<string, unknown>
    }

    const managed = smInternal.sessions.get(sessionId)

    await smInternal.processEvent(managed, {
      type: 'text_complete',
      text: 'hello world',
      isIntermediate: false,
      turnId,
      parentToolUseId: undefined,
      sdkTurnAnchor: undefined,
    })

    expect(emitSpy).toHaveBeenCalledTimes(1)
    expect(emitSpy.mock.calls[0]?.[0]).toMatchObject({
      agentId: sessionId,
      sessionId,
      turnId,
    })
    expect(emitSpy.mock.calls[0]?.[1]).toMatchObject({ text: 'hello world' })

    emitSpy.mockRestore()
  })
})
