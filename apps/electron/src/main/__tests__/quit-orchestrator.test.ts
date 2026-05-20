/**
 * Tests for QuitOrchestrator.
 *
 * TDD cycles (T542 / PZD-67):
 *  C1  register + shutdown runs all handlers in parallel
 *  C2  handler that throws does not block other handlers (isolation)
 *  C3  per-handler timeout fires after N ms, marked timedOut, shutdown still returns
 *  C4  critical: true handler that fails causes shutdown result to reflect criticality
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { QuitOrchestrator } from '../quit-orchestrator'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeHandler(resolveAfterMs = 0): () => Promise<void> {
  return () =>
    resolveAfterMs === 0
      ? Promise.resolve()
      : new Promise((resolve) => setTimeout(resolve, resolveAfterMs))
}

// ─── C1: register + shutdown runs all handlers in parallel ───────────────────

describe('QuitOrchestrator', () => {
  let orchestrator: QuitOrchestrator

  beforeEach(() => {
    orchestrator = new QuitOrchestrator()
  })

  describe('C1: runs all handlers', () => {
    it('returns empty result when no handlers registered', async () => {
      const result = await orchestrator.shutdown()
      expect(result.completed).toEqual([])
      expect(result.failed).toEqual([])
      expect(result.timedOut).toEqual([])
    })

    it('calls all registered handlers', async () => {
      const calls: string[] = []
      orchestrator.register('alpha', async () => { calls.push('alpha') })
      orchestrator.register('beta', async () => { calls.push('beta') })
      orchestrator.register('gamma', async () => { calls.push('gamma') })

      await orchestrator.shutdown()

      expect(calls.sort()).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('lists all handlers in completed when all succeed', async () => {
      orchestrator.register('a', makeHandler())
      orchestrator.register('b', makeHandler())

      const result = await orchestrator.shutdown()

      expect(result.completed.sort()).toEqual(['a', 'b'])
      expect(result.failed).toEqual([])
      expect(result.timedOut).toEqual([])
    })

    it('runs handlers in parallel (total time ≈ max single handler, not sum)', async () => {
      const DELAY = 50
      orchestrator.register('slow1', makeHandler(DELAY))
      orchestrator.register('slow2', makeHandler(DELAY))
      orchestrator.register('slow3', makeHandler(DELAY))

      const start = Date.now()
      const result = await orchestrator.shutdown(1_000)
      const elapsed = Date.now() - start

      expect(result.completed.sort()).toEqual(['slow1', 'slow2', 'slow3'])
      // parallel: should finish in ~DELAY, not 3*DELAY
      expect(elapsed).toBeLessThan(DELAY * 2.5)
    })
  })

  // ─── C2: isolation — one throw does not block others ─────────────────────

  describe('C2: handler isolation', () => {
    it('other handlers still complete when one throws', async () => {
      const calls: string[] = []
      orchestrator.register('ok1', async () => { calls.push('ok1') })
      orchestrator.register('bad', async () => { throw new Error('boom') })
      orchestrator.register('ok2', async () => { calls.push('ok2') })

      const result = await orchestrator.shutdown()

      expect(calls.sort()).toEqual(['ok1', 'ok2'])
      expect(result.completed.sort()).toEqual(['ok1', 'ok2'])
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].name).toBe('bad')
      expect(result.failed[0].error.message).toBe('boom')
    })

    it('multiple failures are all collected', async () => {
      orchestrator.register('f1', async () => { throw new Error('err1') })
      orchestrator.register('f2', async () => { throw new Error('err2') })
      orchestrator.register('ok', async () => {})

      const result = await orchestrator.shutdown()

      expect(result.failed).toHaveLength(2)
      const names = result.failed.map((f) => f.name).sort()
      expect(names).toEqual(['f1', 'f2'])
      expect(result.completed).toEqual(['ok'])
    })
  })

  // ─── C3: per-handler timeout ──────────────────────────────────────────────

  describe('C3: per-handler timeout', () => {
    it('handler that hangs longer than timeoutMs is marked timedOut', async () => {
      const TIMEOUT = 30
      const HANG = 500
      orchestrator.register('hanger', makeHandler(HANG), { timeoutMs: TIMEOUT })
      orchestrator.register('fast', makeHandler(0))

      const result = await orchestrator.shutdown(2_000)

      expect(result.timedOut).toContain('hanger')
      expect(result.completed).toContain('fast')
      expect(result.failed).toEqual([])
    })

    it('global shutdown still returns even when a handler times out', async () => {
      orchestrator.register('hanger', makeHandler(500), { timeoutMs: 30 })

      const start = Date.now()
      const result = await orchestrator.shutdown(2_000)
      const elapsed = Date.now() - start

      expect(result.timedOut).toContain('hanger')
      // Should not wait 500 ms — the 30 ms per-handler timeout should fire first
      expect(elapsed).toBeLessThan(200)
    })

    it('default per-handler timeout is 5000 ms (handler within 5s completes)', async () => {
      // Handler that resolves in 20ms — well within the 5s default
      orchestrator.register('quick', makeHandler(20))

      const result = await orchestrator.shutdown(10_000)

      expect(result.completed).toContain('quick')
      expect(result.timedOut).toEqual([])
    })
  })

  // ─── C4: critical flag ────────────────────────────────────────────────────

  describe('C4: critical flag', () => {
    it('critical handler failure is surfaced in failed list with error', async () => {
      orchestrator.register('crit', async () => { throw new Error('critical fail') }, { critical: true })

      const result = await orchestrator.shutdown()

      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].name).toBe('crit')
      expect(result.failed[0].critical).toBe(true)
    })

    it('non-critical handler failure does not set critical flag', async () => {
      orchestrator.register('normal', async () => { throw new Error('normal fail') })

      const result = await orchestrator.shutdown()

      expect(result.failed[0].critical).toBeFalsy()
    })

    it('critical handler timeout is surfaced in timedOut list with critical flag', async () => {
      orchestrator.register('crit-hang', makeHandler(500), { timeoutMs: 30, critical: true })

      const result = await orchestrator.shutdown(2_000)

      expect(result.timedOut).toContain('crit-hang')
      // The timedOut entry should also carry critical metadata
      expect(result.criticalTimedOut).toContain('crit-hang')
    })
  })
})
