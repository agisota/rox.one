/**
 * Tests for the host orchestrator composition root — M.7 T242.
 * Pure: no fs, no fetch, no `process.env`. Uses the T241 fake adapters
 * so the assembled orchestrator dispatches end-to-end without I/O.
 */
import { describe, expect, it } from 'bun:test'

import { unsafeProviderId, type ProviderId } from '@rox-one/shared/agent/backend/provider-id.ts'
import {
  createFakeAnthropicAdapter,
  createFakeOpenAiAdapter,
} from '@rox-one/shared/agent/backend/adapters/index.ts'
import type { ProviderHandler, ProviderRequest } from '@rox-one/shared/agent/backend/provider-registry.ts'

import {
  createHostOrchestrator,
  createHostOrchestratorFromConfig,
  createHostOrchestratorOrThrow,
  describeHostError,
} from '../host.ts'
import {
  parseHostConfig,
  ROUTING_POLICY_KINDS,
  type HostOrchestratorConfig,
  type RoutingPolicySpec,
} from '../host-config.ts'

const ANTHROPIC: ProviderId = unsafeProviderId('anthropic')
const OPENAI: ProviderId = unsafeProviderId('openai')
const GOOGLE: ProviderId = unsafeProviderId('google')

function ask(content: string): ProviderRequest {
  return { model: 'fake-model', messages: [{ role: 'user', content }] }
}

function assertOk<T, E>(r: { ok: true; value: T } | { ok: false; error: E }): asserts r is { ok: true; value: T } {
  if (!r.ok) throw new Error(`expected ok result, got error: ${JSON.stringify(r.error)}`)
}

function assertErr<T, E extends { kind: string }>(
  r: { ok: true; value: T } | { ok: false; error: E },
  kind: E['kind'],
): asserts r is { ok: false; error: E } {
  if (r.ok) throw new Error(`expected error result of kind ${kind}, got ok`)
  if (r.error.kind !== kind) throw new Error(`expected ${kind}, got ${r.error.kind}`)
}

describe('createHostOrchestrator — validation', () => {
  it('returns NoProviders for an empty list', () => {
    const r = createHostOrchestrator({ providers: [], policy: { kind: 'round-robin' } })
    assertErr(r, 'NoProviders')
    expect(describeHostError(r.error)).toContain('NoProviders')
  })

  it('rejects duplicate provider ids', () => {
    const r = createHostOrchestrator({
      providers: [createFakeAnthropicAdapter(), createFakeAnthropicAdapter()],
      policy: { kind: 'round-robin' },
    })
    assertErr(r, 'DuplicateProvider')
  })

  it('rejects a failover policy whose primary is not registered', () => {
    const r = createHostOrchestrator({
      providers: [createFakeOpenAiAdapter()],
      policy: { kind: 'failover', primary: ANTHROPIC, fallbacks: [OPENAI] },
    })
    assertErr(r, 'FailoverPrimaryMissing')
    expect(describeHostError(r.error)).toContain('primary=anthropic')
  })

  it('rejects a failover policy with an unregistered fallback', () => {
    const r = createHostOrchestrator({
      providers: [createFakeAnthropicAdapter()],
      policy: { kind: 'failover', primary: ANTHROPIC, fallbacks: [GOOGLE] },
    })
    assertErr(r, 'FailoverFallbackMissing')
  })
})

describe('createHostOrchestrator — single provider', () => {
  it('builds a working orchestrator', async () => {
    const adapter = createFakeAnthropicAdapter({ canned: [{ prompt: 'hello', text: 'hi' }] })
    const r = createHostOrchestrator({ providers: [adapter], policy: { kind: 'round-robin' } })
    assertOk(r)
    expect(r.value.registry.size()).toBe(1)
    expect(r.value.registry.listIds()).toEqual([ANTHROPIC])
    expect(r.value.policy.name).toBe('RoundRobin')

    const resp = await r.value.orchestrator.send({ request: ask('hello') })
    expect(resp.mode).toBe('send')
    expect(resp.ok).toBe(true)
    if (!resp.ok || resp.mode !== 'send') throw new Error('unreachable')
    expect(resp.value.providerId).toBe(ANTHROPIC)
    expect(resp.value.response.text).toBe('hi')
    expect(adapter.sendCalls).toBe(1)
  })

  it('threads the injected clock through to attempts', async () => {
    const ticks: number[] = []
    const r = createHostOrchestrator({
      providers: [createFakeAnthropicAdapter()],
      policy: { kind: 'round-robin' },
      clock: { now: () => { const t = 1000 + ticks.length; ticks.push(t); return t } },
    })
    assertOk(r)
    const resp = await r.value.orchestrator.send({ request: ask('t') })
    expect(resp.ok).toBe(true)
    expect(ticks.length).toBeGreaterThan(0)
    if (resp.ok && resp.mode === 'send') {
      for (const a of resp.value.attempts) expect(ticks).toContain(a.at)
    }
  })
})

describe('createHostOrchestrator — failover policy', () => {
  it('routes through the primary when healthy', async () => {
    const primary = createFakeAnthropicAdapter({ canned: [{ prompt: 'q', text: 'primary' }] })
    const fallback = createFakeOpenAiAdapter({ canned: [{ prompt: 'q', text: 'fallback' }] })
    const r = createHostOrchestrator({
      providers: [primary, fallback],
      policy: { kind: 'failover', primary: ANTHROPIC, fallbacks: [OPENAI] },
    })
    assertOk(r)
    expect(r.value.policy.name).toBe('Failover')
    expect(r.value.registry.size()).toBe(2)

    const resp = await r.value.orchestrator.send({ request: ask('q') })
    expect(resp.ok).toBe(true)
    if (resp.ok && resp.mode === 'send') {
      expect(resp.value.providerId).toBe(ANTHROPIC)
      expect(resp.value.response.text).toBe('primary')
    }
    expect(primary.sendCalls).toBe(1)
    expect(fallback.sendCalls).toBe(0)
  })

  it('falls back to the secondary when the primary throws', async () => {
    const primary = createFakeAnthropicAdapter({ failSend: { kind: 'unavailable', message: 'down' } })
    const fallback = createFakeOpenAiAdapter({ canned: [{ prompt: 'q', text: 'fallback' }] })
    const r = createHostOrchestrator({
      providers: [primary, fallback],
      policy: { kind: 'failover', primary: ANTHROPIC, fallbacks: [OPENAI] },
    })
    assertOk(r)
    const resp = await r.value.orchestrator.send({ request: ask('q') })
    expect(resp.ok).toBe(true)
    if (resp.ok && resp.mode === 'send') {
      expect(resp.value.providerId).toBe(OPENAI)
      expect(resp.value.response.text).toBe('fallback')
      expect(resp.value.attempts.length).toBeGreaterThanOrEqual(2)
      expect(resp.value.attempts[0]!.providerId).toBe(ANTHROPIC)
      expect(resp.value.attempts[0]!.outcome).toBe('unavailable')
    }
    expect(primary.sendCalls).toBe(1)
    expect(fallback.sendCalls).toBe(1)
  })
})

describe('createHostOrchestrator — sticky / round-robin', () => {
  it('sticky pins the same routingKey to the same provider', async () => {
    const r = createHostOrchestrator({
      providers: [createFakeAnthropicAdapter(), createFakeOpenAiAdapter()],
      policy: { kind: 'sticky' },
    })
    assertOk(r)
    expect(r.value.policy.name).toBe('Sticky')
    const r1 = await r.value.orchestrator.send({ request: ask('q'), routingKey: 't1' })
    const r2 = await r.value.orchestrator.send({ request: ask('q'), routingKey: 't1' })
    expect(r1.ok && r2.ok).toBe(true)
    if (r1.ok && r1.mode === 'send' && r2.ok && r2.mode === 'send') {
      expect(r1.value.providerId).toBe(r2.value.providerId)
    }
  })

  it('round-robin spreads across providers', async () => {
    const r = createHostOrchestrator({
      providers: [createFakeAnthropicAdapter(), createFakeOpenAiAdapter()],
      policy: { kind: 'round-robin' },
    })
    assertOk(r)
    const r1 = await r.value.orchestrator.send({ request: ask('q') })
    const r2 = await r.value.orchestrator.send({ request: ask('q') })
    if (r1.ok && r1.mode === 'send' && r2.ok && r2.mode === 'send') {
      expect(r1.value.providerId).not.toBe(r2.value.providerId)
    }
  })
})

describe('createHostOrchestratorOrThrow', () => {
  it('returns a handle on success', () => {
    const h = createHostOrchestratorOrThrow({
      providers: [createFakeAnthropicAdapter()],
      policy: { kind: 'round-robin' },
    })
    expect(h.registry.size()).toBe(1)
    expect(h.policy.name).toBe('RoundRobin')
  })

  it('throws a descriptive Error on failure', () => {
    expect(() =>
      createHostOrchestratorOrThrow({ providers: [], policy: { kind: 'round-robin' } }),
    ).toThrow(/NoProviders/)
  })
})

describe('createHostOrchestratorFromConfig', () => {
  it('feeds a parsed config straight into the factory', async () => {
    const adapter = createFakeAnthropicAdapter({ canned: [{ prompt: 'hi', text: 'cfg' }] })
    const config: HostOrchestratorConfig = {
      policy: { kind: 'round-robin' },
      budget: { maxAttempts: 2 },
    }
    const r = createHostOrchestratorFromConfig(config, [adapter])
    assertOk(r)
    expect(r.value.budget).toEqual({ maxAttempts: 2 })
    const resp = await r.value.orchestrator.send({ request: ask('hi') })
    if (resp.ok && resp.mode === 'send') expect(resp.value.response.text).toBe('cfg')
  })

  it('propagates clock + budget through the config path', async () => {
    const ticks: number[] = []
    const config: HostOrchestratorConfig = {
      policy: { kind: 'failover', primary: ANTHROPIC, fallbacks: [] },
      budget: { maxTokens: 4096 },
    }
    const r = createHostOrchestratorFromConfig(
      config,
      [createFakeAnthropicAdapter()],
      { now: () => { const t = 5000 + ticks.length; ticks.push(t); return t } },
    )
    assertOk(r)
    expect(r.value.budget).toEqual({ maxTokens: 4096 })
    const resp = await r.value.orchestrator.send({ request: ask('a') })
    expect(resp.ok).toBe(true)
    expect(ticks.length).toBeGreaterThan(0)
  })
})

describe('parseHostConfig', () => {
  it('parses a minimal round-robin config', () => {
    const r = parseHostConfig({ policy: { kind: 'round-robin' } })
    assertOk(r)
    expect(r.value.policy).toEqual({ kind: 'round-robin' })
    expect(r.value.budget).toBeUndefined()
  })

  it('parses a failover config with primary + fallbacks', () => {
    const r = parseHostConfig({
      policy: { kind: 'failover', primary: 'anthropic', fallbacks: ['openai', 'google'] },
      budget: { maxAttempts: 3, maxTokens: 1024 },
    })
    assertOk(r)
    const policy = r.value.policy as RoutingPolicySpec & { kind: 'failover' }
    expect(policy.primary).toBe(ANTHROPIC)
    expect(policy.fallbacks).toEqual([OPENAI, GOOGLE])
    expect(r.value.budget).toEqual({ maxAttempts: 3, maxTokens: 1024 })
  })

  it('rejects non-object input', () => {
    assertErr(parseHostConfig('not a config'), 'NotAnObject')
  })

  it('rejects when policy is missing', () => {
    assertErr(parseHostConfig({ budget: { maxAttempts: 1 } }), 'MissingPolicy')
  })

  it('rejects an unknown policy kind with a typed error', () => {
    const r = parseHostConfig({ policy: { kind: 'random' } })
    assertErr(r, 'UnknownPolicyKind')
    if (r.error.kind === 'UnknownPolicyKind') {
      expect(r.error.received).toBe('random')
      expect(r.error.allowed).toEqual(ROUTING_POLICY_KINDS)
    }
  })

  it('rejects a failover spec missing the primary', () => {
    assertErr(parseHostConfig({ policy: { kind: 'failover', fallbacks: ['openai'] } }), 'InvalidProviderId')
  })

  it('rejects a failover spec with non-array fallbacks', () => {
    assertErr(
      parseHostConfig({ policy: { kind: 'failover', primary: 'anthropic', fallbacks: 'oai' } }),
      'InvalidPolicyShape',
    )
  })

  it('rejects a failover spec containing an unknown provider id', () => {
    const r = parseHostConfig({ policy: { kind: 'failover', primary: 'anthropic', fallbacks: ['nope'] } })
    assertErr(r, 'InvalidProviderId')
    if (r.error.kind === 'InvalidProviderId') expect(r.error.field).toBe('policy.fallbacks[0]')
  })

  it('rejects negative budget values', () => {
    assertErr(parseHostConfig({ policy: { kind: 'round-robin' }, budget: { maxAttempts: -1 } }), 'InvalidBudget')
  })

  it('rejects non-finite budget values', () => {
    assertErr(
      parseHostConfig({ policy: { kind: 'round-robin' }, budget: { maxTokens: Number.POSITIVE_INFINITY } }),
      'InvalidBudget',
    )
  })

  it('accepts a sticky policy spec', () => {
    const r = parseHostConfig({ policy: { kind: 'sticky' } })
    assertOk(r)
    expect(r.value.policy.kind).toBe('sticky')
  })
})

describe('describeHostError', () => {
  it('formats every variant', () => {
    expect(describeHostError({ kind: 'NoProviders', reason: 'x' })).toContain('NoProviders')
    expect(describeHostError({ kind: 'DuplicateProvider', providerId: ANTHROPIC })).toContain('DuplicateProvider')
    expect(describeHostError({ kind: 'UnknownPolicyKind', received: 'x' })).toContain('UnknownPolicyKind')
    expect(describeHostError({ kind: 'FailoverPrimaryMissing', providerId: ANTHROPIC, registered: [OPENAI] }))
      .toContain('FailoverPrimaryMissing')
    expect(describeHostError({ kind: 'FailoverFallbackMissing', providerId: GOOGLE, registered: [ANTHROPIC] }))
      .toContain('FailoverFallbackMissing')
  })
})

describe('end-to-end composition', () => {
  it('lets a custom handler ship alongside fake adapters', async () => {
    const customId: ProviderId = unsafeProviderId('bedrock')
    const custom: ProviderHandler = {
      id: customId,
      healthy: () => true,
      async send() { return { text: 'custom' } },
      async *stream() { yield { kind: 'end' as const, reason: 'stop' as const } },
    }
    const r = createHostOrchestrator({
      providers: [createFakeAnthropicAdapter(), custom],
      policy: { kind: 'failover', primary: customId, fallbacks: [ANTHROPIC] },
    })
    assertOk(r)
    const resp = await r.value.orchestrator.send({ request: ask('q') })
    expect(resp.ok).toBe(true)
    if (resp.ok && resp.mode === 'send') {
      expect(resp.value.providerId).toBe(customId)
      expect(resp.value.response.text).toBe('custom')
    }
  })
})
