/**
 * Orchestrator — M.7 T240 provider orchestration backbone.
 *
 * Pure-function entry point: consumes a {@link ProviderRegistry} plus a
 * {@link RoutingPolicy}, picks a provider, and forwards an
 * {@link OrchestrationRequest} to the handler's `send` or `stream` method.
 *
 * Failure surface is a discriminated union — `ProviderUnavailableError`,
 * `BudgetExceededError`, `RateLimitedError`, `RouteUnresolvedError`.
 *
 * No fs, no fetch, no `process.env`. Retries are bounded by the candidate
 * set and an optional `budget.maxAttempts`.
 */

import type { ProviderId, Result } from './provider-id.ts';
import type {
  ProviderHandler,
  ProviderNonStreamingResponse,
  ProviderRegistry,
  ProviderRequest,
  ProviderStreamEvent,
} from './provider-registry.ts';
import type { RoutingFailure, RoutingPolicy } from './routing-policy.ts';

// ============================================================
// Request / response
// ============================================================

export interface OrchestrationBudget {
  readonly maxTokens?: number;
  readonly maxAttempts?: number;
}

export interface OrchestrationRequest {
  readonly request: ProviderRequest;
  readonly routingKey?: string;
  readonly candidates?: readonly ProviderId[];
  readonly budget?: OrchestrationBudget;
}

export interface OrchestrationAttempt {
  readonly providerId: ProviderId;
  readonly at: number;
  readonly outcome: 'success' | 'unavailable' | 'rate-limited' | 'error';
  readonly message?: string;
}

export interface OrchestrationSuccess {
  readonly kind: 'success';
  readonly providerId: ProviderId;
  readonly response: ProviderNonStreamingResponse;
  readonly attempts: readonly OrchestrationAttempt[];
}

export interface OrchestrationStreamSuccess {
  readonly kind: 'stream';
  readonly providerId: ProviderId;
  readonly events: AsyncIterable<ProviderStreamEvent>;
  readonly attempts: readonly OrchestrationAttempt[];
}

// ============================================================
// Error union
// ============================================================

export interface ProviderUnavailableError {
  readonly kind: 'ProviderUnavailableError';
  readonly providerId: ProviderId;
  readonly reason: string;
  readonly attempts: readonly OrchestrationAttempt[];
}

export interface BudgetExceededError {
  readonly kind: 'BudgetExceededError';
  readonly limit: number;
  readonly used: number;
  readonly metric: 'tokens' | 'attempts';
  readonly attempts: readonly OrchestrationAttempt[];
}

export interface RateLimitedError {
  readonly kind: 'RateLimitedError';
  readonly providerId: ProviderId;
  readonly retryAfterMs?: number;
  readonly attempts: readonly OrchestrationAttempt[];
}

export interface RouteUnresolvedError {
  readonly kind: 'RouteUnresolvedError';
  readonly reason: string;
  readonly candidates: readonly ProviderId[];
  readonly attempts: readonly OrchestrationAttempt[];
}

export type OrchestrationError =
  | ProviderUnavailableError
  | BudgetExceededError
  | RateLimitedError
  | RouteUnresolvedError;

export type OrchestrationResponse =
  | (Result<OrchestrationSuccess, OrchestrationError> & { readonly mode: 'send' })
  | (Result<OrchestrationStreamSuccess, OrchestrationError> & { readonly mode: 'stream' });

// ============================================================
// Clock + options
// ============================================================

export interface OrchestratorClock {
  now(): number;
}

const realClock: OrchestratorClock = { now: () => Date.now() };

export interface OrchestratorOptions {
  readonly registry: ProviderRegistry;
  readonly policy: RoutingPolicy;
  readonly clock?: OrchestratorClock;
}

// ============================================================
// Internal helpers
// ============================================================

interface InternalFailure {
  readonly outcome: 'unavailable' | 'rate-limited' | 'error';
  readonly message: string;
  readonly retryAfterMs?: number;
}

function classifyError(error: unknown): InternalFailure {
  if (!(error instanceof Error)) {
    return { outcome: 'error', message: 'unknown provider error' };
  }
  const tagged = error as Error & { code?: string; retryAfterMs?: number };
  if (tagged.code === 'RATE_LIMITED' || /rate.?limit/i.test(error.message)) {
    return { outcome: 'rate-limited', message: error.message, retryAfterMs: tagged.retryAfterMs };
  }
  if (tagged.code === 'PROVIDER_UNAVAILABLE' || /unavailable|unreachable/i.test(error.message)) {
    return { outcome: 'unavailable', message: error.message };
  }
  return { outcome: 'error', message: error.message };
}

/**
 * Pump the first event out of the provider stream so synchronous errors in
 * the generator body surface here. The returned iterable replays the buffered
 * first event, then forwards the rest unchanged.
 */
async function primeStream(
  source: AsyncIterable<ProviderStreamEvent>,
): Promise<AsyncIterable<ProviderStreamEvent>> {
  const iterator = source[Symbol.asyncIterator]();
  const firstStep = await iterator.next();
  return {
    [Symbol.asyncIterator](): AsyncIterator<ProviderStreamEvent> {
      let primed = false;
      return {
        async next(): Promise<IteratorResult<ProviderStreamEvent>> {
          if (!primed) {
            primed = true;
            return firstStep;
          }
          return iterator.next();
        },
        async return(value?: ProviderStreamEvent): Promise<IteratorResult<ProviderStreamEvent>> {
          if (typeof iterator.return === 'function') return iterator.return(value);
          return { done: true, value: undefined as unknown as ProviderStreamEvent };
        },
      };
    },
  };
}

// ============================================================
// Orchestrator
// ============================================================

export class Orchestrator {
  private readonly registry: ProviderRegistry;
  private readonly policy: RoutingPolicy;
  private readonly clock: OrchestratorClock;

  constructor(options: OrchestratorOptions) {
    this.registry = options.registry;
    this.policy = options.policy;
    this.clock = options.clock ?? realClock;
  }

  private resolveCandidates(candidates: readonly ProviderId[] | undefined): readonly ProviderId[] {
    if (candidates && candidates.length > 0) {
      return candidates.filter((id) => this.registry.has(id));
    }
    return this.registry.listIds();
  }

  /** Walk the policy until it returns a healthy handler or yields an error. */
  private async selectProvider(
    candidates: readonly ProviderId[],
    routingKey: string | undefined,
    budget: OrchestrationBudget | undefined,
    attempts: OrchestrationAttempt[],
    failures: RoutingFailure[],
  ): Promise<Result<ProviderHandler, OrchestrationError>> {
    const maxAttempts = budget?.maxAttempts ?? candidates.length;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const decision = this.policy.decide({ candidates, routingKey, recentFailures: failures });
      if (decision.kind === 'unresolved') {
        return {
          ok: false,
          error: {
            kind: 'RouteUnresolvedError',
            reason: decision.reason,
            candidates,
            attempts,
          } satisfies RouteUnresolvedError,
        };
      }
      const handler = this.registry.resolve(decision.providerId);
      const at = this.clock.now();
      const markUnavailable = (id: ProviderId, message: string): void => {
        failures.push({ providerId: id, reason: 'unavailable', at });
        attempts.push({ providerId: id, at, outcome: 'unavailable', message });
      };
      if (!handler) {
        markUnavailable(decision.providerId, 'handler not registered');
        continue;
      }
      if (!handler.healthy()) {
        markUnavailable(handler.id, 'handler.healthy() returned false');
        continue;
      }
      return { ok: true, value: handler };
    }
    return {
      ok: false,
      error: {
        kind: 'BudgetExceededError',
        limit: maxAttempts,
        used: maxAttempts,
        metric: 'attempts',
        attempts,
      } satisfies BudgetExceededError,
    };
  }

  /** Non-streaming entry point. */
  async send(req: OrchestrationRequest): Promise<OrchestrationResponse> {
    const candidates = this.resolveCandidates(req.candidates);
    const attempts: OrchestrationAttempt[] = [];
    const failures: RoutingFailure[] = [];

    if (candidates.length === 0) {
      return this.routeUnresolved('send', candidates, attempts);
    }
    if (req.budget?.maxAttempts !== undefined && req.budget.maxAttempts <= 0) {
      return {
        mode: 'send',
        ok: false,
        error: {
          kind: 'BudgetExceededError',
          limit: req.budget.maxAttempts,
          used: 0,
          metric: 'attempts',
          attempts,
        },
      };
    }

    const maxAttempts = req.budget?.maxAttempts ?? candidates.length;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const selection = await this.selectProvider(candidates, req.routingKey, req.budget, attempts, failures);
      if (!selection.ok) return { mode: 'send', ok: false, error: selection.error };
      const handler = selection.value;
      try {
        const response = await handler.send(req.request);
        attempts.push({ providerId: handler.id, at: this.clock.now(), outcome: 'success' });
        if (req.budget?.maxTokens !== undefined && response.usage && response.usage.totalTokens > req.budget.maxTokens) {
          return {
            mode: 'send',
            ok: false,
            error: {
              kind: 'BudgetExceededError',
              limit: req.budget.maxTokens,
              used: response.usage.totalTokens,
              metric: 'tokens',
              attempts,
            },
          };
        }
        return {
          mode: 'send',
          ok: true,
          value: { kind: 'success', providerId: handler.id, response, attempts },
        };
      } catch (rawError: unknown) {
        const failure = classifyError(rawError);
        const at = this.clock.now();
        failures.push({
          providerId: handler.id,
          reason: failure.outcome === 'rate-limited' ? 'rate-limited' : failure.outcome,
          at,
        });
        attempts.push({ providerId: handler.id, at, outcome: failure.outcome, message: failure.message });
        if (failure.outcome === 'rate-limited' && attempt + 1 === maxAttempts) {
          return {
            mode: 'send',
            ok: false,
            error: {
              kind: 'RateLimitedError',
              providerId: handler.id,
              retryAfterMs: failure.retryAfterMs,
              attempts,
            },
          };
        }
      }
    }

    return {
      mode: 'send',
      ok: false,
      error: {
        kind: 'ProviderUnavailableError',
        providerId: attempts[attempts.length - 1]?.providerId ?? (candidates[0] as ProviderId),
        reason: 'attempts exhausted without a successful response',
        attempts,
      },
    };
  }

  /** Streaming entry point. */
  async stream(req: OrchestrationRequest): Promise<OrchestrationResponse> {
    const candidates = this.resolveCandidates(req.candidates);
    const attempts: OrchestrationAttempt[] = [];
    const failures: RoutingFailure[] = [];

    if (candidates.length === 0) {
      return this.routeUnresolved('stream', candidates, attempts);
    }

    const selection = await this.selectProvider(candidates, req.routingKey, req.budget, attempts, failures);
    if (!selection.ok) return { mode: 'stream', ok: false, error: selection.error };

    const handler = selection.value;
    try {
      const events = await primeStream(handler.stream({ ...req.request, stream: true }));
      attempts.push({ providerId: handler.id, at: this.clock.now(), outcome: 'success' });
      return {
        mode: 'stream',
        ok: true,
        value: { kind: 'stream', providerId: handler.id, events, attempts },
      };
    } catch (rawError: unknown) {
      const failure = classifyError(rawError);
      attempts.push({
        providerId: handler.id,
        at: this.clock.now(),
        outcome: failure.outcome,
        message: failure.message,
      });
      if (failure.outcome === 'rate-limited') {
        return {
          mode: 'stream',
          ok: false,
          error: {
            kind: 'RateLimitedError',
            providerId: handler.id,
            retryAfterMs: failure.retryAfterMs,
            attempts,
          },
        };
      }
      return {
        mode: 'stream',
        ok: false,
        error: {
          kind: 'ProviderUnavailableError',
          providerId: handler.id,
          reason: failure.message,
          attempts,
        },
      };
    }
  }

  private routeUnresolved(
    mode: 'send' | 'stream',
    candidates: readonly ProviderId[],
    attempts: readonly OrchestrationAttempt[],
  ): OrchestrationResponse {
    const error: RouteUnresolvedError = {
      kind: 'RouteUnresolvedError',
      reason: 'no registered providers match the requested candidate set',
      candidates,
      attempts,
    };
    return mode === 'send' ? { mode, ok: false, error } : { mode, ok: false, error };
  }
}
