/**
 * Tests for Provider Orchestration Backbone — M.7 T240.
 *
 * Covers provider-id, provider-registry, routing-policy, and orchestrator.
 * Real adapters are NOT exercised — `FakeProvider` is the only handler.
 */
import { describe, it, expect } from 'bun:test';
import {
  PROVIDER_IDS,
  parseProviderId,
  isProviderId,
  unsafeProviderId,
  providerIdToString,
  type ProviderId,
} from '../provider-id.ts';
import {
  ProviderRegistry,
  type ProviderHandler,
  type ProviderNonStreamingResponse,
  type ProviderRequest,
  type ProviderStreamEvent,
} from '../provider-registry.ts';
import {
  createRoundRobinPolicy,
  createStickyPolicy,
  createFailoverPolicy,
  defaultStickyHash,
} from '../routing-policy.ts';
import { Orchestrator } from '../orchestrator.ts';

interface FakeProviderOptions {
  readonly id: ProviderId;
  readonly responseText?: string;
  readonly chunks?: readonly string[];
  readonly healthy?: boolean;
  readonly throwOnSend?: Error;
  readonly throwOnStream?: Error;
  readonly usageTotalTokens?: number;
}

function makeFakeProvider(options: FakeProviderOptions): ProviderHandler {
  return {
    id: options.id,
    healthy: () => options.healthy ?? true,
    async send(request: ProviderRequest): Promise<ProviderNonStreamingResponse> {
      if (options.throwOnSend) throw options.throwOnSend;
      const echo = request.messages.map((m) => m.content).join('|');
      return {
        text: options.responseText ?? `[${options.id}] ${echo}`,
        usage:
          options.usageTotalTokens === undefined
            ? undefined
            : {
                inputTokens: Math.floor(options.usageTotalTokens / 2),
                outputTokens: Math.ceil(options.usageTotalTokens / 2),
                totalTokens: options.usageTotalTokens,
              },
      };
    },
    async *stream(): AsyncIterable<ProviderStreamEvent> {
      if (options.throwOnStream) throw options.throwOnStream;
      const chunks = options.chunks ?? ['hello', ' ', 'world'];
      for (let i = 0; i < chunks.length; i += 1) {
        yield { kind: 'chunk', delta: chunks[i] as string, index: i };
      }
      yield { kind: 'end', reason: 'stop', usage: { inputTokens: 1, outputTokens: 3, totalTokens: 4 } };
    },
  };
}

const PID = {
  anthropic: unsafeProviderId('anthropic'),
  openai: unsafeProviderId('openai'),
  google: unsafeProviderId('google'),
  bedrock: unsafeProviderId('bedrock'),
  ollama: unsafeProviderId('ollama'),
};

function fakeRequest(): ProviderRequest {
  return {
    model: 'test-model',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ],
  };
}

// ============================================================
// provider-id
// ============================================================

describe('provider-id', () => {
  it('exposes the canonical provider set', () => {
    for (const id of ['anthropic', 'openai', 'google', 'azure-openai', 'bedrock', 'ollama']) {
      expect(PROVIDER_IDS).toContain(id);
    }
    expect(PROVIDER_IDS.length).toBe(6);
  });

  it('parses known providers and brands them', () => {
    const result = parseProviderId('anthropic');
    expect(result.ok).toBe(true);
    if (result.ok) expect(providerIdToString(result.value)).toBe('anthropic');
  });

  it('normalises whitespace and case before parsing', () => {
    const result = parseProviderId('  OpenAI  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(providerIdToString(result.value)).toBe('openai');
  });

  it('returns a structured error for unknown providers', () => {
    const result = parseProviderId('cohere');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('ProviderIdParseError');
      expect(result.error.input).toBe('cohere');
      expect(result.error.allowed).toEqual(PROVIDER_IDS);
    }
  });

  it('isProviderId narrows correctly', () => {
    expect(isProviderId('anthropic')).toBe(true);
    expect(isProviderId('  ollama ')).toBe(true);
    expect(isProviderId('mistral')).toBe(false);
  });

  it('unsafeProviderId returns the branded literal', () => {
    expect(providerIdToString(unsafeProviderId('bedrock'))).toBe('bedrock');
  });
});

// ============================================================
// ProviderRegistry
// ============================================================

describe('ProviderRegistry', () => {
  it('starts empty', () => {
    const reg = new ProviderRegistry();
    expect(reg.size()).toBe(0);
    expect(reg.listIds().length).toBe(0);
    expect(reg.listHandlers().length).toBe(0);
  });

  it('registers and resolves a handler', () => {
    const reg = new ProviderRegistry();
    const handler = makeFakeProvider({ id: PID.anthropic });
    reg.register(handler);
    expect(reg.size()).toBe(1);
    expect(reg.has(PID.anthropic)).toBe(true);
    expect(reg.resolve(PID.anthropic)).toBe(handler);
  });

  it('rejects duplicate registration unless replace is true', () => {
    const reg = new ProviderRegistry();
    const first = makeFakeProvider({ id: PID.openai, responseText: 'A' });
    const second = makeFakeProvider({ id: PID.openai, responseText: 'B' });
    reg.register(first);
    expect(() => reg.register(second)).toThrow(/already registered/);
    reg.register(second, { replace: true });
    expect(reg.resolve(PID.openai)).toBe(second);
  });

  it('unregister and clear behave correctly', () => {
    const reg = new ProviderRegistry();
    reg.register(makeFakeProvider({ id: PID.google }));
    reg.register(makeFakeProvider({ id: PID.bedrock }));
    expect(reg.size()).toBe(2);
    expect(reg.unregister(PID.google)).toBe(true);
    expect(reg.unregister(PID.google)).toBe(false);
    reg.clear();
    expect(reg.size()).toBe(0);
  });

  it('listIds returns every registered provider', () => {
    const reg = new ProviderRegistry();
    reg.register(makeFakeProvider({ id: PID.anthropic }));
    reg.register(makeFakeProvider({ id: PID.openai }));
    const ids = reg.listIds();
    expect(ids.length).toBe(2);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
  });

  it('resolve returns undefined for unknown providers', () => {
    expect(new ProviderRegistry().resolve(PID.ollama)).toBeUndefined();
  });
});

// ============================================================
// routing policies
// ============================================================

describe('createRoundRobinPolicy', () => {
  it('returns unresolved for an empty candidate set', () => {
    const d = createRoundRobinPolicy().decide({ candidates: [], recentFailures: [] });
    expect(d.kind).toBe('unresolved');
  });

  it('cycles through eligible candidates', () => {
    const policy = createRoundRobinPolicy();
    const candidates: ProviderId[] = [PID.anthropic, PID.openai, PID.google];
    const picks: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const d = policy.decide({ candidates, recentFailures: [] });
      if (d.kind === 'choice') picks.push(d.providerId);
    }
    expect(picks).toEqual(['anthropic', 'openai', 'google', 'anthropic', 'openai', 'google']);
  });

  it('skips failed providers via recentFailures', () => {
    const d = createRoundRobinPolicy().decide({
      candidates: [PID.anthropic, PID.openai],
      recentFailures: [{ providerId: PID.anthropic, reason: 'unavailable', at: 0 }],
    });
    expect(d.kind).toBe('choice');
    if (d.kind === 'choice') expect(d.providerId).toBe('openai');
  });
});

describe('createStickyPolicy', () => {
  it('hashes the same key to the same provider deterministically', () => {
    const policy = createStickyPolicy();
    const candidates: ProviderId[] = [PID.anthropic, PID.openai, PID.google];
    const a = policy.decide({ candidates, routingKey: 'session-42', recentFailures: [] });
    const b = policy.decide({ candidates, routingKey: 'session-42', recentFailures: [] });
    expect(a.kind).toBe('choice');
    expect(b.kind).toBe('choice');
    if (a.kind === 'choice' && b.kind === 'choice') expect(a.providerId).toBe(b.providerId);
  });

  it('returns unresolved when no routing key is given', () => {
    const d = createStickyPolicy().decide({ candidates: [PID.anthropic], recentFailures: [] });
    expect(d.kind).toBe('unresolved');
  });

  it('honours a custom hash function', () => {
    const d = createStickyPolicy(() => 1).decide({
      candidates: [PID.anthropic, PID.openai],
      routingKey: 'any',
      recentFailures: [],
    });
    expect(d.kind).toBe('choice');
    if (d.kind === 'choice') expect(d.providerId).toBe('openai');
  });

  it('defaultStickyHash is stable and non-negative', () => {
    const a = defaultStickyHash('alpha');
    expect(defaultStickyHash('alpha')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(defaultStickyHash('beta')).not.toBe(a);
  });
});

describe('createFailoverPolicy', () => {
  it('returns the primary when it is eligible', () => {
    const d = createFailoverPolicy({ primary: PID.anthropic, fallbacks: [PID.openai] }).decide({
      candidates: [PID.anthropic, PID.openai],
      recentFailures: [],
    });
    expect(d.kind).toBe('choice');
    if (d.kind === 'choice') expect(d.providerId).toBe('anthropic');
  });

  it('falls back when the primary recently failed', () => {
    const d = createFailoverPolicy({
      primary: PID.anthropic,
      fallbacks: [PID.openai, PID.google],
    }).decide({
      candidates: [PID.anthropic, PID.openai, PID.google],
      recentFailures: [{ providerId: PID.anthropic, reason: 'unavailable', at: 0 }],
    });
    expect(d.kind).toBe('choice');
    if (d.kind === 'choice') expect(d.providerId).toBe('openai');
  });

  it('returns unresolved when everything is failed or absent', () => {
    const d = createFailoverPolicy({ primary: PID.anthropic, fallbacks: [PID.openai] }).decide({
      candidates: [PID.anthropic, PID.openai],
      recentFailures: [
        { providerId: PID.anthropic, reason: 'unavailable', at: 0 },
        { providerId: PID.openai, reason: 'unavailable', at: 0 },
      ],
    });
    expect(d.kind).toBe('unresolved');
  });
});

// ============================================================
// Orchestrator.send
// ============================================================

describe('Orchestrator.send', () => {
  it('routes to a registered provider and returns the response', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic, responseText: 'hi back' }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
    });
    expect(result.mode).toBe('send');
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === 'send') {
      expect(result.value.providerId).toBe('anthropic');
      expect(result.value.response.text).toBe('hi back');
      expect(result.value.attempts.length).toBeGreaterThan(0);
    }
  });

  it('returns RouteUnresolvedError when the registry is empty', async () => {
    const result = await new Orchestrator({
      registry: new ProviderRegistry(),
      policy: createRoundRobinPolicy(),
    }).send({ request: fakeRequest() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('RouteUnresolvedError');
  });

  it('returns RouteUnresolvedError when no candidate matches the registry', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
      candidates: [PID.ollama],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('RouteUnresolvedError');
  });

  it('skips unhealthy providers and falls through to the next', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic, healthy: false }));
    registry.register(makeFakeProvider({ id: PID.openai, responseText: 'fallback works' }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === 'send') {
      expect(result.value.response.text).toBe('fallback works');
      expect(result.value.attempts.filter((a) => a.outcome === 'unavailable').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns BudgetExceededError when token usage exceeds the budget', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic, usageTotalTokens: 1000 }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
      budget: { maxTokens: 100 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'BudgetExceededError') {
      expect(result.error.metric).toBe('tokens');
      expect(result.error.limit).toBe(100);
      expect(result.error.used).toBe(1000);
    }
  });

  it('returns BudgetExceededError when attempts is zero', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
      budget: { maxAttempts: 0 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'BudgetExceededError') {
      expect(result.error.metric).toBe('attempts');
    }
  });

  it('returns RateLimitedError when a provider throws a rate-limit signal', async () => {
    const registry = new ProviderRegistry();
    const err = Object.assign(new Error('rate limit exceeded'), {
      code: 'RATE_LIMITED',
      retryAfterMs: 1500,
    });
    registry.register(makeFakeProvider({ id: PID.openai, throwOnSend: err }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'RateLimitedError') {
      expect(result.error.retryAfterMs).toBe(1500);
    }
  });

  it('returns ProviderUnavailableError after exhausting attempts', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.openai, throwOnSend: new Error('boom') }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).send({
      request: fakeRequest(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('ProviderUnavailableError');
  });
});

// ============================================================
// Orchestrator.stream
// ============================================================

describe('Orchestrator.stream', () => {
  it('streams three chunks from a FakeProvider then ends', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic, chunks: ['alpha', '|beta', '|gamma'] }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).stream({
      request: fakeRequest(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.mode !== 'stream') return;
    const collected: string[] = [];
    let endReason: string | null = null;
    for await (const event of result.value.events) {
      if (event.kind === 'chunk') collected.push(event.delta);
      if (event.kind === 'end') endReason = event.reason;
    }
    expect(collected.length).toBe(3);
    expect(collected.join('')).toBe('alpha|beta|gamma');
    expect(endReason).toBe('stop');
    expect(result.value.providerId).toBe('anthropic');
  });

  it('emits RouteUnresolvedError for an empty registry', async () => {
    const result = await new Orchestrator({
      registry: new ProviderRegistry(),
      policy: createRoundRobinPolicy(),
    }).stream({ request: fakeRequest() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('RouteUnresolvedError');
  });

  it('propagates a rate-limit error from the streaming handler', async () => {
    const registry = new ProviderRegistry();
    const err = Object.assign(new Error('rate limit'), { code: 'RATE_LIMITED' });
    registry.register(makeFakeProvider({ id: PID.openai, throwOnStream: err }));
    const result = await new Orchestrator({ registry, policy: createRoundRobinPolicy() }).stream({
      request: fakeRequest(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('RateLimitedError');
  });

  it('routes streaming via the Sticky policy with a consistent key', async () => {
    const registry = new ProviderRegistry();
    registry.register(makeFakeProvider({ id: PID.anthropic, chunks: ['x', 'y', 'z'] }));
    registry.register(makeFakeProvider({ id: PID.openai, chunks: ['1', '2', '3'] }));
    const orchestrator = new Orchestrator({ registry, policy: createStickyPolicy(() => 0) });
    const a = await orchestrator.stream({ request: fakeRequest(), routingKey: 'same-key' });
    const b = await orchestrator.stream({ request: fakeRequest(), routingKey: 'same-key' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && a.mode === 'stream' && b.ok && b.mode === 'stream') {
      expect(a.value.providerId).toBe(b.value.providerId);
    }
  });
});

// ============================================================
// Orchestrator + Failover policy end-to-end
// ============================================================

describe('Orchestrator + Failover policy', () => {
  it('falls over to the secondary when the primary errors', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      makeFakeProvider({
        id: PID.anthropic,
        throwOnSend: new Error('PROVIDER_UNAVAILABLE: down'),
      }),
    );
    registry.register(makeFakeProvider({ id: PID.openai, responseText: 'recovered' }));
    const result = await new Orchestrator({
      registry,
      policy: createFailoverPolicy({ primary: PID.anthropic, fallbacks: [PID.openai] }),
    }).send({ request: fakeRequest() });
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === 'send') {
      expect(result.value.providerId).toBe('openai');
      expect(result.value.response.text).toBe('recovered');
      expect(result.value.attempts.filter((a) => a.outcome === 'unavailable').length).toBe(1);
    }
  });
});
