/**
 * BackendStderrBuffer
 *
 * Provider-agnostic helper for de-duplicating consecutive identical error
 * messages from a backend subprocess (or any other byte stream that can
 * pathologically repeat the same line).
 *
 * Concretely: when a Pi subprocess hits an EFAULT loop or a similar
 * deterministic-failure tight loop, naive forwarding floods the user's
 * session with thousands of identical lines. This utility lets callers ask
 * a single question — "should I emit this message?" — and answers based on
 * a configurable repeat threshold:
 *
 *   - First occurrence of a message: emit (record() returns 'emit').
 *   - Repeats up to maxIdenticalRepeats: emit (record() returns 'emit') and
 *     bump the internal counter.
 *   - Repeats beyond maxIdenticalRepeats: suppress (record() returns
 *     'suppress') along with the running count for caller-side debug logging.
 *   - A different message resets the counter; the new message is emitted.
 *
 * The buffer holds no message contents beyond the most recent one — it is
 * pure dedup, not a ring buffer of stderr text. (Pi keeps a separate ring
 * buffer of stderr bytes for surfacing context on connection-test failures;
 * that concern is intentionally out of scope here.)
 *
 * Related but intentionally NOT unified here:
 *   - ClaudeAgent's `parseApiErrorFromDebugLog` scrapes the SDK's debug log
 *     file for the most recent JSON-encoded API error. That is a file-read +
 *     JSON-parse pipeline, not a dedup mechanism, so it stays separate.
 */

export type StderrBufferDecision =
  | { action: 'emit'; repeatCount: number }
  | { action: 'suppress'; repeatCount: number };

export interface BackendStderrBufferOptions {
  /**
   * Maximum number of consecutive identical messages to emit before
   * suppression kicks in. The (N+1)th identical message is the first one
   * suppressed.
   *
   * Must be >= 1. Defaults to 3 (Pi's historical threshold).
   */
  maxIdenticalRepeats?: number;
}

const DEFAULT_MAX_IDENTICAL_REPEATS = 3;

export class BackendStderrBuffer {
  private lastMessage: string | null = null;
  private repeatCount = 0;
  private readonly maxIdenticalRepeats: number;

  constructor(options: BackendStderrBufferOptions = {}) {
    const max = options.maxIdenticalRepeats ?? DEFAULT_MAX_IDENTICAL_REPEATS;
    if (!Number.isFinite(max) || max < 1) {
      throw new RangeError(
        `BackendStderrBuffer: maxIdenticalRepeats must be >= 1, got ${max}`,
      );
    }
    this.maxIdenticalRepeats = Math.floor(max);
  }

  /**
   * Record an incoming message and decide whether the caller should emit it.
   *
   * The returned `repeatCount` is the run-length of the current identical
   * streak after this call (1 for the first occurrence). When the action is
   * `'suppress'`, callers typically want to log the count at debug level so
   * the suppression is observable without flooding the user.
   */
  record(message: string): StderrBufferDecision {
    if (message === this.lastMessage) {
      this.repeatCount += 1;
      if (this.repeatCount > this.maxIdenticalRepeats) {
        return { action: 'suppress', repeatCount: this.repeatCount };
      }
      return { action: 'emit', repeatCount: this.repeatCount };
    }

    this.lastMessage = message;
    this.repeatCount = 1;
    return { action: 'emit', repeatCount: 1 };
  }

  /**
   * Reset the dedup state. Callers should invoke this on subprocess
   * (re)spawn so a stale "last message" from a previous lifetime does not
   * suppress a legitimate first-of-its-kind error in the new subprocess.
   */
  reset(): void {
    this.lastMessage = null;
    this.repeatCount = 0;
  }

  /** Read-only view of the current run-length, for diagnostics. */
  get currentRepeatCount(): number {
    return this.repeatCount;
  }

  /** Read-only view of the most recent message, for diagnostics. */
  get currentMessage(): string | null {
    return this.lastMessage;
  }
}
