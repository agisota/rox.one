/**
 * Host Orchestrator Factory — M.7 T242.
 *
 * Composition root for the M.7 provider-orchestration backbone. The host
 * supplies constructed `ProviderHandler` instances + a `RoutingPolicySpec`
 * (data, see `host-config.ts`); the factory validates the list, builds the
 * `ProviderRegistry`, materialises the policy, and returns a ready-to-use
 * `Orchestrator`. Pure module — no fs/fetch/env; never imports adapters.
 */

import { type ProviderId, type Result } from '@rox-one/shared/agent/backend/provider-id.ts'
import { ProviderRegistry, type ProviderHandler } from '@rox-one/shared/agent/backend/provider-registry.ts'
import {
  createFailoverPolicy,
  createRoundRobinPolicy,
  createStickyPolicy,
  type RoutingPolicy,
} from '@rox-one/shared/agent/backend/routing-policy.ts'
import { Orchestrator, type OrchestratorClock } from '@rox-one/shared/agent/backend/orchestrator.ts'
import type { HostBudgetConfig, HostOrchestratorConfig, RoutingPolicySpec } from './host-config.ts'

export interface CreateHostOrchestratorOptions {
  readonly providers: readonly ProviderHandler[]
  readonly policy: RoutingPolicySpec
  readonly clock?: OrchestratorClock
  readonly budget?: HostBudgetConfig
}

type FailoverErr = { readonly providerId: ProviderId; readonly registered: readonly ProviderId[] }
export type HostOrchestratorError =
  | { readonly kind: 'NoProviders'; readonly reason: string }
  | { readonly kind: 'DuplicateProvider'; readonly providerId: ProviderId }
  | { readonly kind: 'UnknownPolicyKind'; readonly received: string }
  | ({ readonly kind: 'FailoverPrimaryMissing' } & FailoverErr)
  | ({ readonly kind: 'FailoverFallbackMissing' } & FailoverErr)

export interface HostOrchestratorHandle {
  readonly orchestrator: Orchestrator
  readonly registry: ProviderRegistry
  readonly policy: RoutingPolicy
  readonly budget?: HostBudgetConfig
}

function assembleRegistry(
  providers: readonly ProviderHandler[],
): Result<ProviderRegistry, HostOrchestratorError> {
  if (providers.length === 0) {
    return { ok: false, error: { kind: 'NoProviders', reason: 'at least one provider handler is required' } }
  }
  const registry = new ProviderRegistry()
  for (const handler of providers) {
    if (registry.has(handler.id)) {
      return { ok: false, error: { kind: 'DuplicateProvider', providerId: handler.id } }
    }
    registry.register(handler)
  }
  return { ok: true, value: registry }
}

function buildPolicy(
  spec: RoutingPolicySpec,
  registered: readonly ProviderId[],
): Result<RoutingPolicy, HostOrchestratorError> {
  if (spec.kind === 'round-robin') return { ok: true, value: createRoundRobinPolicy() }
  if (spec.kind === 'sticky') return { ok: true, value: createStickyPolicy() }
  if (spec.kind === 'failover') {
    const set = new Set(registered)
    if (!set.has(spec.primary)) {
      return { ok: false, error: { kind: 'FailoverPrimaryMissing', providerId: spec.primary, registered } }
    }
    for (const fb of spec.fallbacks) {
      if (!set.has(fb)) return { ok: false, error: { kind: 'FailoverFallbackMissing', providerId: fb, registered } }
    }
    return { ok: true, value: createFailoverPolicy({ primary: spec.primary, fallbacks: spec.fallbacks }) }
  }
  const exhaustive: never = spec
  return { ok: false, error: { kind: 'UnknownPolicyKind', received: (exhaustive as { kind: string }).kind } }
}

/**
 * Compose providers + policy spec into a ready-to-use `Orchestrator`.
 * Returns a `Result` so the caller can branch without `try/catch`.
 */
export function createHostOrchestrator(
  options: CreateHostOrchestratorOptions,
): Result<HostOrchestratorHandle, HostOrchestratorError> {
  const registryResult = assembleRegistry(options.providers)
  if (!registryResult.ok) return { ok: false, error: registryResult.error }
  const registry = registryResult.value
  const policyResult = buildPolicy(options.policy, registry.listIds())
  if (!policyResult.ok) return { ok: false, error: policyResult.error }
  const policy = policyResult.value
  const orchestrator = new Orchestrator({ registry, policy, clock: options.clock })
  const handle: HostOrchestratorHandle = options.budget === undefined
    ? { orchestrator, registry, policy }
    : { orchestrator, registry, policy, budget: options.budget }
  return { ok: true, value: handle }
}

/** Throw on error. Use when bootstrap should panic on misconfig. */
export function createHostOrchestratorOrThrow(
  options: CreateHostOrchestratorOptions,
): HostOrchestratorHandle {
  const result = createHostOrchestrator(options)
  if (!result.ok) throw new Error(`createHostOrchestrator: ${describeHostError(result.error)}`)
  return result.value
}

/** Build from a parsed `HostOrchestratorConfig`. The host still supplies the providers. */
export function createHostOrchestratorFromConfig(
  config: HostOrchestratorConfig,
  providers: readonly ProviderHandler[],
  clock?: OrchestratorClock,
): Result<HostOrchestratorHandle, HostOrchestratorError> {
  const base = { providers, policy: config.policy }
  const withBudget = config.budget === undefined ? base : { ...base, budget: config.budget }
  const final = clock === undefined ? withBudget : { ...withBudget, clock }
  return createHostOrchestrator(final)
}

export function describeHostError(error: HostOrchestratorError): string {
  switch (error.kind) {
    case 'NoProviders': return `NoProviders: ${error.reason}`
    case 'DuplicateProvider': return `DuplicateProvider: ${error.providerId}`
    case 'UnknownPolicyKind': return `UnknownPolicyKind: ${error.received}`
    case 'FailoverPrimaryMissing':
      return `FailoverPrimaryMissing: primary=${error.providerId} registered=[${error.registered.join(',')}]`
    case 'FailoverFallbackMissing':
      return `FailoverFallbackMissing: fallback=${error.providerId} registered=[${error.registered.join(',')}]`
  }
}
