import { describe, it, expect } from 'bun:test';
import { TokenBucket, SlidingWindowCounter } from '../rate-limiter.ts';

function makeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => { t += ms; },
    set: (ms: number) => { t = ms; },
  };
}

describe('TokenBucket', () => {
  it('starts full when initialTokens is not provided', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, clock: clock.now });
    expect(bucket.available()).toBe(10);
    expect(bucket.getCapacity()).toBe(10);
  });

  it('honors explicit initialTokens', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: 3, clock: clock.now });
    expect(bucket.available()).toBe(3);
  });

  it('clamps initialTokens above capacity to capacity', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: 99, clock: clock.now });
    expect(bucket.available()).toBe(10);
  });

  it('clamps negative initialTokens to zero', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: -5, clock: clock.now });
    expect(bucket.available()).toBe(0);
  });

  it('drains tokens on successful tryAcquire', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 1, clock: clock.now });
    expect(bucket.tryAcquire(1)).toBe(true);
    expect(bucket.available()).toBe(4);
    expect(bucket.tryAcquire(3)).toBe(true);
    expect(bucket.available()).toBe(1);
  });

  it('rejects when not enough tokens and leaves state unchanged', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 1, clock: clock.now });
    bucket.tryAcquire(4);
    expect(bucket.available()).toBe(1);
    expect(bucket.tryAcquire(2)).toBe(false);
    expect(bucket.available()).toBe(1); // unchanged
  });

  it('refills tokens at the configured rate', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 2, initialTokens: 0, clock: clock.now });
    expect(bucket.available()).toBe(0);
    clock.advance(1000); // 1 second → 2 tokens
    expect(bucket.available()).toBeCloseTo(2, 5);
    clock.advance(500); // +0.5 s → +1 token
    expect(bucket.available()).toBeCloseTo(3, 5);
  });

  it('caps refill at capacity', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 4, refillRatePerSec: 100, initialTokens: 0, clock: clock.now });
    clock.advance(10_000); // would refill 1000 tokens; capped at 4
    expect(bucket.available()).toBe(4);
  });

  it('treats clock regressions as zero elapsed (no negative refill)', () => {
    const clock = makeClock(5000);
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: 5, clock: clock.now });
    clock.set(1000); // clock went backwards
    expect(bucket.available()).toBe(5); // unchanged
  });

  it('supports fractional refills correctly across small ticks', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: 0, clock: clock.now });
    clock.advance(100);
    expect(bucket.available()).toBeCloseTo(0.1, 5);
    clock.advance(100);
    expect(bucket.available()).toBeCloseTo(0.2, 5);
  });

  it('reset() restores full capacity and resets refill anchor', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: 0, clock: clock.now });
    bucket.reset();
    expect(bucket.available()).toBe(10);
    bucket.tryAcquire(10);
    expect(bucket.available()).toBe(0);
  });

  it('throws on invalid construction args', () => {
    const clock = makeClock();
    expect(() => new TokenBucket({ capacity: 0, refillRatePerSec: 1, clock: clock.now })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: -1, refillRatePerSec: 1, clock: clock.now })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: Number.POSITIVE_INFINITY, refillRatePerSec: 1, clock: clock.now })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: 10, refillRatePerSec: -1, clock: clock.now })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: 10, refillRatePerSec: Number.NaN, clock: clock.now })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: 10, refillRatePerSec: 1, initialTokens: Number.NaN, clock: clock.now })).toThrow(RangeError);
    // @ts-expect-error testing runtime guard
    expect(() => new TokenBucket({ capacity: 10, refillRatePerSec: 1, clock: 'not-a-fn' })).toThrow(TypeError);
  });

  it('throws on invalid tryAcquire args', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 1, clock: clock.now });
    expect(() => bucket.tryAcquire(0)).toThrow(RangeError);
    expect(() => bucket.tryAcquire(-1)).toThrow(RangeError);
    expect(() => bucket.tryAcquire(Number.NaN)).toThrow(RangeError);
  });

  it('default tryAcquire uses n=1', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 3, refillRatePerSec: 1, clock: clock.now });
    expect(bucket.tryAcquire()).toBe(true);
    expect(bucket.tryAcquire()).toBe(true);
    expect(bucket.tryAcquire()).toBe(true);
    expect(bucket.tryAcquire()).toBe(false);
  });

  it('models burst then refill behavior', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 5, clock: clock.now });
    // burst — drain everything
    for (let i = 0; i < 5; i++) expect(bucket.tryAcquire(1)).toBe(true);
    expect(bucket.tryAcquire(1)).toBe(false);
    // wait 1 second → full refill
    clock.advance(1000);
    expect(bucket.tryAcquire(5)).toBe(true);
  });

  it('zero refill rate models a fixed quota bucket', () => {
    const clock = makeClock();
    const bucket = new TokenBucket({ capacity: 3, refillRatePerSec: 0, clock: clock.now });
    expect(bucket.tryAcquire(3)).toBe(true);
    clock.advance(10_000_000);
    expect(bucket.tryAcquire(1)).toBe(false);
    expect(bucket.available()).toBe(0);
  });
});

describe('SlidingWindowCounter', () => {
  it('records events and returns count', () => {
    const clock = makeClock();
    const w = new SlidingWindowCounter({ windowMs: 1000, clock: clock.now });
    expect(w.count()).toBe(0);
    expect(w.record()).toBe(1);
    expect(w.record()).toBe(2);
    expect(w.record()).toBe(3);
    expect(w.count()).toBe(3);
  });

  it('expires events older than the window', () => {
    const clock = makeClock();
    const w = new SlidingWindowCounter({ windowMs: 1000, clock: clock.now });
    w.record(); // t=0
    w.record(); // t=0
    clock.advance(500);
    expect(w.record()).toBe(3); // t=500 in window
    clock.advance(600); // now=1100, t=0 entries are expired (1100-1000=100 cutoff)
    expect(w.count()).toBe(1); // only t=500 survives
  });

  it('handles window boundary correctly (events at exact cutoff are expired)', () => {
    const clock = makeClock();
    const w = new SlidingWindowCounter({ windowMs: 1000, clock: clock.now });
    w.record(); // t=0
    clock.advance(1000); // now=1000, cutoff=0 → t=0 is at cutoff, expired (<=)
    expect(w.count()).toBe(0);
  });

  it('keeps events strictly newer than the cutoff', () => {
    const clock = makeClock();
    const w = new SlidingWindowCounter({ windowMs: 1000, clock: clock.now });
    clock.advance(1); // t=1
    w.record();
    clock.advance(1000); // now=1001, cutoff=1 → t=1 is at cutoff, expired
    expect(w.count()).toBe(0);
    w.record(); // now=1001
    clock.advance(999); // now=2000, cutoff=1000 → t=1001 still in window
    expect(w.count()).toBe(1);
  });

  it('reset() clears all events', () => {
    const clock = makeClock();
    const w = new SlidingWindowCounter({ windowMs: 1000, clock: clock.now });
    w.record();
    w.record();
    w.record();
    expect(w.count()).toBe(3);
    w.reset();
    expect(w.count()).toBe(0);
  });

  it('respects maxEvents by dropping the oldest', () => {
    const clock = makeClock();
    const w = new SlidingWindowCounter({ windowMs: 10_000, clock: clock.now, maxEvents: 3 });
    clock.set(100);
    w.record();
    clock.set(200);
    w.record();
    clock.set(300);
    w.record();
    clock.set(400);
    expect(w.record()).toBe(3); // oldest (100) dropped; counts t=200,300,400
    expect(w.count()).toBe(3);
  });

  it('throws on invalid construction args', () => {
    const clock = makeClock();
    expect(() => new SlidingWindowCounter({ windowMs: 0, clock: clock.now })).toThrow(RangeError);
    expect(() => new SlidingWindowCounter({ windowMs: -1, clock: clock.now })).toThrow(RangeError);
    expect(() => new SlidingWindowCounter({ windowMs: Number.NaN, clock: clock.now })).toThrow(RangeError);
    expect(() => new SlidingWindowCounter({ windowMs: 1000, clock: clock.now, maxEvents: 0 })).toThrow(RangeError);
    expect(() => new SlidingWindowCounter({ windowMs: 1000, clock: clock.now, maxEvents: 1.5 })).toThrow(RangeError);
    // @ts-expect-error testing runtime guard
    expect(() => new SlidingWindowCounter({ windowMs: 1000, clock: null })).toThrow(TypeError);
  });

  it('is deterministic with injected clock — same trace twice gives same counts', () => {
    const run = () => {
      const clock = makeClock();
      const w = new SlidingWindowCounter({ windowMs: 500, clock: clock.now });
      const trace: number[] = [];
      trace.push(w.record());
      clock.advance(200);
      trace.push(w.record());
      clock.advance(400); // now=600, t=0 expired
      trace.push(w.record());
      return trace;
    };
    expect(run()).toEqual(run());
  });
});
