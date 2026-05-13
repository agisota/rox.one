/**
 * @rox-one/shared/security/budget-guard
 *
 * Per-key budget exhaustion guard. Tracks accumulated usage against a fixed
 * budget and rejects consumption that would exceed it. Pure data structure,
 * zero I/O. Pairs with `TokenBucket` from `./rate-limiter.ts` for combined
 * per-user rate-limit + lifetime budget enforcement.
 *
 * Result type uses a discriminated union so callers handle exhaustion as data
 * rather than exceptions on the hot path.
 */

export type BudgetResult =
  | { ok: true; remaining: number }
  | { ok: false; error: BudgetExceededError };

export class BudgetExceededError extends Error {
  readonly reason: 'exceeded' | 'invalid-amount';
  readonly key: string;
  readonly budget: number;
  readonly used: number;
  readonly requested: number;

  constructor(args: {
    reason: 'exceeded' | 'invalid-amount';
    key: string;
    budget: number;
    used: number;
    requested: number;
  }) {
    const msg =
      args.reason === 'invalid-amount'
        ? `BudgetGuard[${args.key}]: invalid amount ${args.requested}`
        : `BudgetGuard[${args.key}]: budget ${args.budget} exhausted (used=${args.used}, requested=${args.requested})`;
    super(msg);
    this.name = 'BudgetExceededError';
    this.reason = args.reason;
    this.key = args.key;
    this.budget = args.budget;
    this.used = args.used;
    this.requested = args.requested;
  }
}

export interface BudgetGuardOptions {
  /** Per-key budget cap. Must be a non-negative finite number. */
  budgetPerKey: number;
}

/**
 * Per-key budget tracker. Keys are arbitrary strings (e.g. user id, IP, API
 * key id). Usage is held in-memory; persistence is out of scope.
 */
export class BudgetGuard<TKey extends string = string> {
  private readonly budget: number;
  private readonly used: Map<TKey, number> = new Map();

  constructor(options: BudgetGuardOptions) {
    if (!Number.isFinite(options.budgetPerKey) || options.budgetPerKey < 0) {
      throw new RangeError('BudgetGuard: budgetPerKey must be a non-negative finite number');
    }
    this.budget = options.budgetPerKey;
  }

  /**
   * Attempt to consume `amount` from the budget for `key`. Returns a result
   * carrying either the new remaining balance, or a structured error when the
   * spend would exceed budget. Never mutates state on rejection.
   */
  consume(key: TKey, amount: number): BudgetResult {
    if (!Number.isFinite(amount) || amount < 0) {
      return {
        ok: false,
        error: new BudgetExceededError({
          reason: 'invalid-amount',
          key,
          budget: this.budget,
          used: this.used.get(key) ?? 0,
          requested: amount,
        }),
      };
    }
    const currentUsed = this.used.get(key) ?? 0;
    const nextUsed = currentUsed + amount;
    if (nextUsed > this.budget) {
      return {
        ok: false,
        error: new BudgetExceededError({
          reason: 'exceeded',
          key,
          budget: this.budget,
          used: currentUsed,
          requested: amount,
        }),
      };
    }
    this.used.set(key, nextUsed);
    return { ok: true, remaining: this.budget - nextUsed };
  }

  /** Current usage for `key`. Defaults to 0 for unseen keys. */
  usage(key: TKey): number {
    return this.used.get(key) ?? 0;
  }

  /** Remaining budget for `key`. */
  remaining(key: TKey): number {
    return this.budget - this.usage(key);
  }

  /** Reset usage for `key` (or all keys if omitted). */
  reset(key?: TKey): void {
    if (key === undefined) {
      this.used.clear();
    } else {
      this.used.delete(key);
    }
  }

  /** Total tracked keys. Useful for cardinality alerts. */
  keyCount(): number {
    return this.used.size;
  }

  /** The configured per-key budget. */
  getBudget(): number {
    return this.budget;
  }
}
