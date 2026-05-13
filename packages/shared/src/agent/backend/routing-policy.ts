/**
 * Routing Policy — M.7 T240.
 *
 * Stateless policies the orchestrator consults on every request. A policy
 * receives candidates + routing key + recent failures and returns a
 * `RoutingDecision`. The orchestrator owns registry resolution, retries, and
 * budget accounting.
 *
 * Three policies ship here:
 *   - `createRoundRobinPolicy` — even distribution by counter
 *   - `createStickyPolicy(byHash?)` — deterministic by hashed routing key
 *   - `createFailoverPolicy({primary, fallbacks})` — primary, then fallbacks
 *
 * Pure module. Counter state is captured in a closure so each orchestrator
 * instance gets its own.
 */

import type { ProviderId } from './provider-id.ts';

export interface RoutingFailure {
  readonly providerId: ProviderId;
  readonly reason: 'unavailable' | 'rate-limited' | 'error';
  readonly at: number;
}

export interface RoutingContext {
  readonly candidates: readonly ProviderId[];
  readonly routingKey?: string;
  readonly recentFailures: readonly RoutingFailure[];
}

export interface RoutingChoice {
  readonly kind: 'choice';
  readonly providerId: ProviderId;
}

export interface RoutingUnresolved {
  readonly kind: 'unresolved';
  readonly reason: string;
}

export type RoutingDecision = RoutingChoice | RoutingUnresolved;

export interface RoutingPolicy {
  readonly name: string;
  decide(context: RoutingContext): RoutingDecision;
}

function filterEligible(
  candidates: readonly ProviderId[],
  recentFailures: readonly RoutingFailure[],
): readonly ProviderId[] {
  if (recentFailures.length === 0) return candidates;
  const failed = new Set(recentFailures.map((f) => f.providerId));
  return candidates.filter((id) => !failed.has(id));
}

function unresolved(candidates: readonly ProviderId[], extra: string): RoutingUnresolved {
  return {
    kind: 'unresolved',
    reason: candidates.length === 0 ? 'no candidates supplied' : extra,
  };
}

// ============================================================
// Round-robin
// ============================================================

export function createRoundRobinPolicy(): RoutingPolicy {
  let counter = 0;
  return {
    name: 'RoundRobin',
    decide({ candidates, recentFailures }): RoutingDecision {
      const eligible = filterEligible(candidates, recentFailures);
      if (eligible.length === 0) return unresolved(candidates, 'every candidate is in recentFailures');
      const index = counter % eligible.length;
      counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
      return { kind: 'choice', providerId: eligible[index] as ProviderId };
    },
  };
}

// ============================================================
// Sticky
// ============================================================

export function createStickyPolicy(
  byHash: (key: string) => number = defaultStickyHash,
): RoutingPolicy {
  return {
    name: 'Sticky',
    decide({ candidates, routingKey, recentFailures }): RoutingDecision {
      const eligible = filterEligible(candidates, recentFailures);
      if (eligible.length === 0) return unresolved(candidates, 'every candidate is in recentFailures');
      if (!routingKey || routingKey.length === 0) {
        return { kind: 'unresolved', reason: 'Sticky policy requires a non-empty routingKey' };
      }
      const hash = byHash(routingKey);
      const safe = Number.isFinite(hash) ? Math.abs(Math.trunc(hash)) : 0;
      return { kind: 'choice', providerId: eligible[safe % eligible.length] as ProviderId };
    },
  };
}

/** Deterministic 32-bit string hash (FNV-1a-inspired). Pure. */
export function defaultStickyHash(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ============================================================
// Failover
// ============================================================

export interface FailoverConfig {
  readonly primary: ProviderId;
  readonly fallbacks: readonly ProviderId[];
}

export function createFailoverPolicy(config: FailoverConfig): RoutingPolicy {
  const ordered: readonly ProviderId[] = [config.primary, ...config.fallbacks];
  return {
    name: 'Failover',
    decide({ candidates, recentFailures }): RoutingDecision {
      const candidateSet = new Set(candidates);
      const failedSet = new Set(recentFailures.map((f) => f.providerId));
      for (const id of ordered) {
        if (candidateSet.has(id) && !failedSet.has(id)) {
          return { kind: 'choice', providerId: id };
        }
      }
      return unresolved(candidates, 'primary and every fallback are unavailable or excluded');
    },
  };
}
