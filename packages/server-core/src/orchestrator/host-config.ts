/**
 * Host Orchestrator Config — M.7 T242.
 *
 * Data shape for assembling the orchestration backbone. The host may
 * hand-roll, load from disk, or receive over IPC; `parseHostConfig`
 * validates the shape and returns a typed `Result`. Provider handlers
 * (which carry credentials/clients) are supplied at runtime — only the
 * routing-policy spec and serialisable budget knobs live here. Pure
 * module: no fs/fetch/env, no third-party deps.
 */

import {
  parseProviderId,
  type ProviderId,
  type Result,
} from '@rox-one/shared/agent/backend/provider-id.ts'

export interface RoundRobinPolicySpec { readonly kind: 'round-robin' }
export interface StickyPolicySpec { readonly kind: 'sticky' }
export interface FailoverPolicySpec {
  readonly kind: 'failover'
  readonly primary: ProviderId
  readonly fallbacks: readonly ProviderId[]
}
export type RoutingPolicySpec = RoundRobinPolicySpec | StickyPolicySpec | FailoverPolicySpec
export type RoutingPolicyKind = RoutingPolicySpec['kind']

export const ROUTING_POLICY_KINDS: readonly RoutingPolicyKind[] = [
  'round-robin',
  'sticky',
  'failover',
] as const

export interface HostBudgetConfig {
  readonly maxAttempts?: number
  readonly maxTokens?: number
}

export interface HostOrchestratorConfig {
  readonly policy: RoutingPolicySpec
  readonly budget?: HostBudgetConfig
}

export type HostConfigParseError =
  | { readonly kind: 'NotAnObject'; readonly input: unknown }
  | { readonly kind: 'MissingPolicy' }
  | { readonly kind: 'UnknownPolicyKind'; readonly received: unknown; readonly allowed: readonly RoutingPolicyKind[] }
  | { readonly kind: 'InvalidPolicyShape'; readonly reason: string }
  | { readonly kind: 'InvalidProviderId'; readonly field: string; readonly input: unknown }
  | { readonly kind: 'InvalidBudget'; readonly field: string; readonly reason: string }

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asProviderId(field: string, input: unknown): Result<ProviderId, HostConfigParseError> {
  if (typeof input !== 'string') {
    return { ok: false, error: { kind: 'InvalidProviderId', field, input } }
  }
  const parsed = parseProviderId(input)
  if (!parsed.ok) return { ok: false, error: { kind: 'InvalidProviderId', field, input } }
  return { ok: true, value: parsed.value }
}

function parsePolicy(raw: unknown): Result<RoutingPolicySpec, HostConfigParseError> {
  if (!isObj(raw)) {
    return { ok: false, error: { kind: 'InvalidPolicyShape', reason: 'policy must be an object' } }
  }
  const kind = raw.kind
  if (typeof kind !== 'string') {
    return { ok: false, error: { kind: 'UnknownPolicyKind', received: kind, allowed: ROUTING_POLICY_KINDS } }
  }
  if (kind === 'round-robin') return { ok: true, value: { kind: 'round-robin' } }
  if (kind === 'sticky') return { ok: true, value: { kind: 'sticky' } }
  if (kind === 'failover') {
    const primary = asProviderId('policy.primary', raw.primary)
    if (!primary.ok) return { ok: false, error: primary.error }
    if (!Array.isArray(raw.fallbacks)) {
      return { ok: false, error: { kind: 'InvalidPolicyShape', reason: 'failover policy requires fallbacks: ProviderId[]' } }
    }
    const fallbacks: ProviderId[] = []
    for (let i = 0; i < raw.fallbacks.length; i += 1) {
      const fb = asProviderId(`policy.fallbacks[${i}]`, raw.fallbacks[i])
      if (!fb.ok) return { ok: false, error: fb.error }
      fallbacks.push(fb.value)
    }
    return { ok: true, value: { kind: 'failover', primary: primary.value, fallbacks } }
  }
  return { ok: false, error: { kind: 'UnknownPolicyKind', received: kind, allowed: ROUTING_POLICY_KINDS } }
}

function parseBudgetField(
  raw: Record<string, unknown>,
  field: 'maxAttempts' | 'maxTokens',
): Result<number | undefined, HostConfigParseError> {
  const value = raw[field]
  if (value === undefined) return { ok: true, value: undefined }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return { ok: false, error: { kind: 'InvalidBudget', field: `budget.${field}`, reason: 'must be a non-negative finite number' } }
  }
  return { ok: true, value }
}

function parseBudget(raw: unknown): Result<HostBudgetConfig | undefined, HostConfigParseError> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined }
  if (!isObj(raw)) {
    return { ok: false, error: { kind: 'InvalidBudget', field: 'budget', reason: 'must be an object' } }
  }
  const maxAttempts = parseBudgetField(raw, 'maxAttempts')
  if (!maxAttempts.ok) return { ok: false, error: maxAttempts.error }
  const maxTokens = parseBudgetField(raw, 'maxTokens')
  if (!maxTokens.ok) return { ok: false, error: maxTokens.error }
  return {
    ok: true,
    value: {
      ...(maxAttempts.value !== undefined ? { maxAttempts: maxAttempts.value } : {}),
      ...(maxTokens.value !== undefined ? { maxTokens: maxTokens.value } : {}),
    },
  }
}

/** Validate a host orchestrator config payload (already JS-parsed). */
export function parseHostConfig(input: unknown): Result<HostOrchestratorConfig, HostConfigParseError> {
  if (!isObj(input)) return { ok: false, error: { kind: 'NotAnObject', input } }
  if (!('policy' in input)) return { ok: false, error: { kind: 'MissingPolicy' } }
  const policy = parsePolicy(input.policy)
  if (!policy.ok) return { ok: false, error: policy.error }
  const budget = parseBudget(input.budget)
  if (!budget.ok) return { ok: false, error: budget.error }
  const config: HostOrchestratorConfig = budget.value === undefined
    ? { policy: policy.value }
    : { policy: policy.value, budget: budget.value }
  return { ok: true, value: config }
}
