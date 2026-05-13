/** T071 round-2 abuse-hardening primitives. RPC integration ships as T071b. */

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
