/**
 * @rox-one/shared/security
 *
 * Abuse-hardening primitives shipped for T071 (round 2):
 *
 * - `TokenBucket` / `SlidingWindowCounter`: pure rate-limit data structures.
 * - `BudgetGuard`: per-key budget exhaustion tracker.
 *
 * All exports are pure, framework-free, and clock-injectable. RPC integration
 * (per-IP + per-user wiring) ships as T071b.
 */

export {
  TokenBucket,
  SlidingWindowCounter,
  type Clock,
  type TokenBucketOptions,
  type SlidingWindowOptions,
} from './rate-limiter.ts';

export {
  BudgetGuard,
  BudgetExceededError,
  type BudgetResult,
  type BudgetGuardOptions,
} from './budget-guard.ts';
