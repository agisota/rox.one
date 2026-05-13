/**
 * M.13 T086 — abuse-hardening RPC integration tests.
 *
 * Proves the T071 security primitives (`TokenBucket`, `SlidingWindowCounter`,
 * `BudgetGuard`) behave correctly end-to-end against a mock handler. No real
 * RPC handler source is modified here; T086b lands the actual handler wiring.
 *
 * Clock is injected so the suite runs in milliseconds, not seconds.
 */
import { describe, expect, it } from 'bun:test'
import {
  BudgetGuard,
  SlidingWindowCounter,
  TokenBucket,
  type Clock,
} from '@rox-one/shared/security'

/** Deterministic clock factory: returns a getter + advance/setter pair. */
function fakeClock(initialMs = 0): { now: Clock; advance: (ms: number) => void; set: (ms: number) => void } {
  let t = initialMs
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
    set: (ms: number) => {
      t = ms
    },
  }
}

/** Minimal handler stub mirroring shape used by real RPC roles handler. */
interface RolesGrantInput {
  userId: string
  role: 'admin' | 'editor' | 'viewer'
}

interface RolesHandlerLike {
  grant: (input: RolesGrantInput) => Promise<{ granted: true }>
  /** Storage spy: each grant call increments. */
  callCount: () => number
}

function makeMockRolesHandler(): RolesHandlerLike {
  let calls = 0
  return {
    async grant(_input: RolesGrantInput): Promise<{ granted: true }> {
      calls += 1
      return { granted: true }
    },
    callCount: () => calls,
  }
}

describe('M.13 T086 — abuse-hardening RPC integration', () => {
  describe('TokenBucket: rapid acquisition throttling', () => {
    it('admits ~capacity tokens then throttles remainder under no refill window', () => {
      const clock = fakeClock(1_000)
      const bucket = new TokenBucket({
        capacity: 100,
        refillRatePerSec: 100,
        clock: clock.now,
      })

      let admitted = 0
      let rejected = 0
      // 1000 rapid acquisitions at the same instant — no clock advance between them.
      for (let i = 0; i < 1000; i++) {
        if (bucket.tryAcquire(1)) admitted++
        else rejected++
      }

      // At t0 with no elapsed time, exactly `capacity` tokens are available.
      expect(admitted).toBe(100)
      expect(rejected).toBe(900)
      expect(admitted + rejected).toBe(1000)
      expect(bucket.available()).toBe(0)
    })

    it('refills predictably across simulated time', () => {
      const clock = fakeClock(0)
      const bucket = new TokenBucket({
        capacity: 100,
        refillRatePerSec: 100,
        clock: clock.now,
      })

      // Drain.
      for (let i = 0; i < 100; i++) bucket.tryAcquire(1)
      expect(bucket.available()).toBe(0)

      // Advance 500ms — 100/s * 0.5s = 50 tokens.
      clock.advance(500)
      expect(bucket.available()).toBe(50)

      // Advance to past full refill — clamped at capacity.
      clock.advance(10_000)
      expect(bucket.available()).toBe(100)
    })

    it('does not over-acquire when n exceeds available tokens', () => {
      const clock = fakeClock(0)
      const bucket = new TokenBucket({
        capacity: 10,
        refillRatePerSec: 0,
        clock: clock.now,
      })
      expect(bucket.tryAcquire(7)).toBe(true)
      expect(bucket.available()).toBe(3)
      // Asking for 5 when only 3 remain must fail and not mutate.
      expect(bucket.tryAcquire(5)).toBe(false)
      expect(bucket.available()).toBe(3)
      expect(bucket.tryAcquire(3)).toBe(true)
      expect(bucket.available()).toBe(0)
    })
  })

  describe('SlidingWindowCounter: 1-second window semantics', () => {
    it('counts 50 records inside a 1-second window then drops to 1 after the window passes', () => {
      const clock = fakeClock(10_000)
      const counter = new SlidingWindowCounter({
        windowMs: 1_000,
        clock: clock.now,
      })

      // 50 records within the window — clock does not advance.
      let last = 0
      for (let i = 0; i < 50; i++) last = counter.record()
      expect(last).toBe(50)
      expect(counter.count()).toBe(50)

      // Jump past the window — all 50 prior events fall out.
      clock.advance(2_000)
      expect(counter.count()).toBe(0)
      // Next record sees count == 1 because the prior 50 are pruned.
      expect(counter.record()).toBe(1)
    })

    it('keeps events that are still inside the window after partial advance', () => {
      const clock = fakeClock(0)
      const counter = new SlidingWindowCounter({
        windowMs: 1_000,
        clock: clock.now,
      })
      counter.record() // t=0
      clock.advance(400)
      counter.record() // t=400
      clock.advance(400)
      counter.record() // t=800
      expect(counter.count()).toBe(3)

      // Advance so the first event (t=0) falls outside the 1s window.
      clock.advance(300) // t=1100
      // First event at t=0 was just at cutoff (now - 1000 = 100); kept if > cutoff. t=0 <= 100 → pruned.
      expect(counter.count()).toBe(2)
    })
  })

  describe('BudgetGuard: per-user lifetime budget', () => {
    it('admits ok/ok/exceeded for 5+5+1 against a budget of 10, then resets cleanly', () => {
      const guard = new BudgetGuard<string>({ budgetPerKey: 10 })
      const userId = 'user-42'

      const r1 = guard.consume(userId, 5)
      expect(r1.ok).toBe(true)
      if (r1.ok) expect(r1.remaining).toBe(5)

      const r2 = guard.consume(userId, 5)
      expect(r2.ok).toBe(true)
      if (r2.ok) expect(r2.remaining).toBe(0)

      const r3 = guard.consume(userId, 1)
      expect(r3.ok).toBe(false)
      if (!r3.ok) {
        expect(r3.error.name).toBe('BudgetExceededError')
        expect(r3.error.reason).toBe('exceeded')
        expect(r3.error.key).toBe(userId)
        expect(r3.error.budget).toBe(10)
        expect(r3.error.used).toBe(10)
        expect(r3.error.requested).toBe(1)
      }

      // Usage is unchanged after rejection.
      expect(guard.usage(userId)).toBe(10)

      // Reset just this key — admits again.
      guard.reset(userId)
      expect(guard.usage(userId)).toBe(0)
      const r4 = guard.consume(userId, 7)
      expect(r4.ok).toBe(true)
      if (r4.ok) expect(r4.remaining).toBe(3)
    })

    it('isolates budgets across keys', () => {
      const guard = new BudgetGuard<string>({ budgetPerKey: 5 })
      expect(guard.consume('alice', 5).ok).toBe(true)
      expect(guard.consume('alice', 1).ok).toBe(false)
      // bob is unaffected.
      const bob = guard.consume('bob', 5)
      expect(bob.ok).toBe(true)
      if (bob.ok) expect(bob.remaining).toBe(0)
      expect(guard.keyCount()).toBe(2)
    })

    it('rejects negative or non-finite amounts without mutating usage', () => {
      const guard = new BudgetGuard<string>({ budgetPerKey: 100 })
      const bad = guard.consume('u', -1)
      expect(bad.ok).toBe(false)
      if (!bad.ok) expect(bad.error.reason).toBe('invalid-amount')
      expect(guard.usage('u')).toBe(0)

      const nan = guard.consume('u', Number.NaN)
      expect(nan.ok).toBe(false)
      if (!nan.ok) expect(nan.error.reason).toBe('invalid-amount')
      expect(guard.usage('u')).toBe(0)
    })
  })

  describe('Composed: TokenBucket guard in front of a mock RolesHandler', () => {
    it('throttles before the call reaches the handler', async () => {
      const clock = fakeClock(0)
      const bucket = new TokenBucket({
        capacity: 5,
        refillRatePerSec: 0,
        clock: clock.now,
      })
      const handler = makeMockRolesHandler()

      // Wrap the handler with the rate-limit guard.
      const guardedGrant = async (
        input: RolesGrantInput,
      ): Promise<{ granted: true } | { throttled: true }> => {
        if (!bucket.tryAcquire(1)) return { throttled: true }
        return handler.grant(input)
      }

      const results: Array<{ granted: true } | { throttled: true }> = []
      for (let i = 0; i < 12; i++) {
        results.push(
          await guardedGrant({ userId: `u-${i}`, role: 'viewer' }),
        )
      }

      const granted = results.filter((r) => 'granted' in r).length
      const throttled = results.filter((r) => 'throttled' in r).length

      // First 5 reach the storage; remaining 7 are short-circuited.
      expect(granted).toBe(5)
      expect(throttled).toBe(7)
      // Critical: throttled calls MUST NOT reach the handler.
      expect(handler.callCount()).toBe(5)
    })

    it('combines TokenBucket + BudgetGuard so both rate and lifetime caps hold', async () => {
      const clock = fakeClock(0)
      const bucket = new TokenBucket({
        capacity: 10,
        refillRatePerSec: 0,
        clock: clock.now,
      })
      const budget = new BudgetGuard<string>({ budgetPerKey: 3 })
      const handler = makeMockRolesHandler()

      const guardedGrant = async (
        input: RolesGrantInput,
      ): Promise<{ status: 'ok' } | { status: 'throttled' } | { status: 'over-budget' }> => {
        if (!bucket.tryAcquire(1)) return { status: 'throttled' }
        const b = budget.consume(input.userId, 1)
        if (!b.ok) return { status: 'over-budget' }
        await handler.grant(input)
        return { status: 'ok' }
      }

      // User "abuser" tries 6 times. Bucket admits all 6 (capacity 10), but
      // BudgetGuard caps at 3 per key.
      const results: Array<{ status: string }> = []
      for (let i = 0; i < 6; i++) {
        results.push(await guardedGrant({ userId: 'abuser', role: 'viewer' }))
      }
      expect(results.filter((r) => r.status === 'ok').length).toBe(3)
      expect(results.filter((r) => r.status === 'over-budget').length).toBe(3)
      expect(handler.callCount()).toBe(3)

      // Different user is unaffected by abuser's exhaustion.
      const fresh = await guardedGrant({ userId: 'fresh', role: 'editor' })
      expect(fresh.status).toBe('ok')
      expect(handler.callCount()).toBe(4)
    })
  })
})
