/**
 * @rox-one/shared/security/rate-limiter
 *
 * Abuse-hardening primitives for T071 (round 2): pure rate-limit data
 * structures with injected clock for deterministic testing and zero I/O.
 *
 * - `TokenBucket`: classic token bucket with continuous refill. `tryAcquire(n)`
 *   returns `true` when capacity allows the spend, `false` otherwise. Buckets
 *   never exceed their capacity, never go negative, and clamp pathological
 *   clock regressions to "no time elapsed".
 *
 * - `SlidingWindowCounter`: rolling-window event counter. `record()` registers
 *   a single event and returns the count of events inside the current window.
 *   `count()` is a read-only peek that prunes expired events.
 *
 * Both classes are framework-free, accept an injected `clock: () => number`
 * (milliseconds), and are pure with respect to the world outside the instance.
 * No `Date.now()` is called directly so tests can fully control time.
 *
 * Integration into RPC handlers ships as T071b — this module only ships
 * primitives + tests.
 */

export type Clock = () => number;

export interface TokenBucketOptions {
  /** Maximum tokens the bucket can hold. Must be a positive finite number. */
  capacity: number;
  /** Refill rate in tokens per second. Must be a non-negative finite number. */
  refillRatePerSec: number;
  /** Optional starting token count. Defaults to `capacity`. Clamped to [0, capacity]. */
  initialTokens?: number;
  /** Monotonic millisecond clock. */
  clock: Clock;
}

/**
 * Pure token-bucket rate limiter.
 *
 * Tokens accrue continuously at `refillRatePerSec` and are capped at
 * `capacity`. A successful `tryAcquire(n)` decrements the available tokens by
 * `n`; failure leaves the bucket unchanged.
 */
export class TokenBucket {
  private readonly capacity: number;
  private readonly refillRatePerSec: number;
  private readonly clock: Clock;
  private tokens: number;
  private lastRefillMs: number;

  constructor(options: TokenBucketOptions) {
    if (!Number.isFinite(options.capacity) || options.capacity <= 0) {
      throw new RangeError('TokenBucket: capacity must be a positive finite number');
    }
    if (!Number.isFinite(options.refillRatePerSec) || options.refillRatePerSec < 0) {
      throw new RangeError('TokenBucket: refillRatePerSec must be a non-negative finite number');
    }
    if (typeof options.clock !== 'function') {
      throw new TypeError('TokenBucket: clock must be a function');
    }
    this.capacity = options.capacity;
    this.refillRatePerSec = options.refillRatePerSec;
    this.clock = options.clock;

    const initial =
      options.initialTokens === undefined ? options.capacity : options.initialTokens;
    if (!Number.isFinite(initial)) {
      throw new RangeError('TokenBucket: initialTokens must be a finite number');
    }
    this.tokens = clamp(initial, 0, this.capacity);
    this.lastRefillMs = this.clock();
  }

  /**
   * Attempt to consume `n` tokens. Returns `true` and decrements the bucket on
   * success; returns `false` and leaves the bucket unchanged on failure.
   */
  tryAcquire(n: number = 1): boolean {
    if (!Number.isFinite(n) || n <= 0) {
      throw new RangeError('TokenBucket.tryAcquire: n must be a positive finite number');
    }
    this.refill();
    if (this.tokens + 1e-9 < n) {
      return false;
    }
    this.tokens -= n;
    if (this.tokens < 0) this.tokens = 0;
    return true;
  }

  /** Current available tokens after refill. Useful for tests and metrics. */
  available(): number {
    this.refill();
    return this.tokens;
  }

  /** Bucket capacity. */
  getCapacity(): number {
    return this.capacity;
  }

  /** Reset the bucket to full capacity at the current clock time. */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefillMs = this.clock();
  }

  private refill(): void {
    const now = this.clock();
    // Guard against non-monotonic clocks: treat regressions as zero elapsed.
    const elapsedMs = Math.max(0, now - this.lastRefillMs);
    if (elapsedMs === 0) {
      return;
    }
    const added = (elapsedMs / 1000) * this.refillRatePerSec;
    this.tokens = Math.min(this.capacity, this.tokens + added);
    this.lastRefillMs = now;
  }
}

export interface SlidingWindowOptions {
  /** Window size in milliseconds. Must be a positive finite number. */
  windowMs: number;
  /** Monotonic millisecond clock. */
  clock: Clock;
  /** Optional cap on stored event count to prevent unbounded growth. */
  maxEvents?: number;
}

/**
 * Sliding-window counter. Stores timestamps of recent events and exposes the
 * count inside the rolling window. Events older than `windowMs` are pruned
 * lazily on each call.
 */
export class SlidingWindowCounter {
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly maxEvents: number;
  private events: number[];

  constructor(options: SlidingWindowOptions) {
    if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
      throw new RangeError('SlidingWindowCounter: windowMs must be a positive finite number');
    }
    if (typeof options.clock !== 'function') {
      throw new TypeError('SlidingWindowCounter: clock must be a function');
    }
    if (options.maxEvents !== undefined && (!Number.isInteger(options.maxEvents) || options.maxEvents <= 0)) {
      throw new RangeError('SlidingWindowCounter: maxEvents must be a positive integer');
    }
    this.windowMs = options.windowMs;
    this.clock = options.clock;
    this.maxEvents = options.maxEvents ?? Number.POSITIVE_INFINITY;
    this.events = [];
  }

  /**
   * Record a single event and return the count of events inside the current
   * window (inclusive of the new event).
   */
  record(): number {
    const now = this.clock();
    this.prune(now);
    if (this.events.length >= this.maxEvents) {
      // Drop the oldest event to make room. Keeps memory bounded under abuse.
      this.events.shift();
    }
    this.events.push(now);
    return this.events.length;
  }

  /** Peek at the current count without recording. */
  count(): number {
    const now = this.clock();
    this.prune(now);
    return this.events.length;
  }

  /** Clear all events. */
  reset(): void {
    this.events = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    // Events are stored monotonically (modulo clock regression). Shift from the
    // front while expired.
    let i = 0;
    while (i < this.events.length && this.events[i]! <= cutoff) {
      i++;
    }
    if (i > 0) {
      this.events = this.events.slice(i);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
