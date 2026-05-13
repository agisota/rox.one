/**
 * Tests for FakeAnthropicAdapter — M.7 T241-adapters.
 *
 * Coverage:
 *   - construction defaults (id, healthy, observation counters)
 *   - canned-response lookup (success + miss + templated echo)
 *   - streaming yields (chunks + terminal end)
 *   - configured failure modes (unavailable, rate-limited, generic)
 *   - registry registration + resolve round-trip
 */

import { describe, it, expect } from 'bun:test';
import {
  unsafeProviderId,
  type ProviderId,
} from '../provider-id.ts';
import {
  ProviderRegistry,
  type ProviderRequest,
  type ProviderStreamEvent,
} from '../provider-registry.ts';
import {
  FakeAnthropicAdapter,
  createFakeAnthropicAdapter,
} from '../adapters/fake-anthropic-adapter.ts';

const ANTHROPIC: ProviderId = unsafeProviderId('anthropic');

function userPrompt(content: string): ProviderRequest {
  return {
    model: 'claude-fake-1',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content },
    ],
  };
}

async function drain(events: AsyncIterable<ProviderStreamEvent>): Promise<ProviderStreamEvent[]> {
  const out: ProviderStreamEvent[] = [];
  for await (const ev of events) out.push(ev);
  return out;
}

describe('FakeAnthropicAdapter — construction', () => {
  it('binds the anthropic provider id by default', () => {
    const adapter = new FakeAnthropicAdapter();
    expect(adapter.id).toBe(ANTHROPIC);
    expect(adapter.healthy()).toBe(true);
    expect(adapter.sendCalls).toBe(0);
    expect(adapter.streamCalls).toBe(0);
    expect(adapter.lastRequest).toBeUndefined();
  });

  it('honours the healthy=false toggle', () => {
    const adapter = new FakeAnthropicAdapter({ healthy: false });
    expect(adapter.healthy()).toBe(false);
  });

  it('accepts a custom provider id', () => {
    const customId = unsafeProviderId('bedrock');
    const adapter = new FakeAnthropicAdapter({ providerId: customId });
    expect(adapter.id).toBe(customId);
  });

  it('exposes a convenience factory', () => {
    const adapter = createFakeAnthropicAdapter();
    expect(adapter).toBeInstanceOf(FakeAnthropicAdapter);
    expect(adapter.id).toBe(ANTHROPIC);
  });
});

describe('FakeAnthropicAdapter — send()', () => {
  it('returns the templated echo when no canned response matches', async () => {
    const adapter = new FakeAnthropicAdapter();
    const result = await adapter.send(userPrompt('hello'));
    expect(result.text).toContain('[fake-anthropic]');
    expect(result.text).toContain('hello');
    expect(result.usage).toBeDefined();
    expect(result.usage?.totalTokens).toBe(20);
    expect(adapter.sendCalls).toBe(1);
    expect(adapter.lastRequest?.model).toBe('claude-fake-1');
  });

  it('returns the canned response for a matching prompt', async () => {
    const adapter = new FakeAnthropicAdapter({
      canned: [
        { prompt: 'ping', text: 'pong', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ],
    });
    const result = await adapter.send(userPrompt('ping'));
    expect(result.text).toBe('pong');
    expect(result.usage?.totalTokens).toBe(2);
  });

  it('falls back to defaultUsage when a canned entry omits usage', async () => {
    const adapter = new FakeAnthropicAdapter({
      canned: [{ prompt: 'hi', text: 'hello' }],
      defaultUsage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 },
    });
    const result = await adapter.send(userPrompt('hi'));
    expect(result.text).toBe('hello');
    expect(result.usage?.totalTokens).toBe(18);
  });

  it('uses the last user message when multiple are present', async () => {
    const adapter = new FakeAnthropicAdapter({
      canned: [{ prompt: 'second', text: 'matched' }],
    });
    const result = await adapter.send({
      model: 'claude-fake-1',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ],
    });
    expect(result.text).toBe('matched');
  });

  it('increments sendCalls on each invocation', async () => {
    const adapter = new FakeAnthropicAdapter();
    await adapter.send(userPrompt('a'));
    await adapter.send(userPrompt('b'));
    await adapter.send(userPrompt('c'));
    expect(adapter.sendCalls).toBe(3);
    expect(adapter.streamCalls).toBe(0);
  });
});

describe('FakeAnthropicAdapter — stream()', () => {
  it('yields default chunks plus an end event when no canned match', async () => {
    const adapter = new FakeAnthropicAdapter({ defaultChunkCount: 3 });
    const events = await drain(adapter.stream(userPrompt('streaming?')));
    const chunks = events.filter((e) => e.kind === 'chunk');
    const ends = events.filter((e) => e.kind === 'end');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.length).toBeLessThanOrEqual(3);
    expect(ends).toHaveLength(1);
    expect(ends[0]?.kind).toBe('end');
    if (ends[0]?.kind === 'end') {
      expect(ends[0].reason).toBe('stop');
      expect(ends[0].usage?.totalTokens).toBe(20);
    }
  });

  it('honours canned chunks when provided', async () => {
    const adapter = new FakeAnthropicAdapter({
      canned: [{ prompt: 'tell me', text: 'a story', chunks: ['a ', 'story'] }],
    });
    const events = await drain(adapter.stream(userPrompt('tell me')));
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ kind: 'chunk', delta: 'a ', index: 0 });
    expect(events[1]).toEqual({ kind: 'chunk', delta: 'story', index: 1 });
    expect(events[2]?.kind).toBe('end');
  });

  it('uses the canned stopReason when supplied', async () => {
    const adapter = new FakeAnthropicAdapter({
      canned: [{ prompt: 'cap', text: 'XYZ', stopReason: 'length' }],
    });
    const events = await drain(adapter.stream(userPrompt('cap')));
    const end = events[events.length - 1];
    expect(end?.kind).toBe('end');
    if (end?.kind === 'end') expect(end.reason).toBe('length');
  });

  it('increments streamCalls and records lastRequest', async () => {
    const adapter = new FakeAnthropicAdapter();
    await drain(adapter.stream(userPrompt('first')));
    await drain(adapter.stream(userPrompt('second')));
    expect(adapter.streamCalls).toBe(2);
    expect(adapter.lastRequest?.messages.at(-1)?.content).toBe('second');
  });
});

describe('FakeAnthropicAdapter — failure modes', () => {
  it('throws an unavailable-style error from send when configured', async () => {
    const adapter = new FakeAnthropicAdapter({
      failSend: { kind: 'unavailable' },
    });
    let caught: unknown;
    try {
      await adapter.send(userPrompt('any'));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error & { code?: string };
    expect(err.code).toBe('PROVIDER_UNAVAILABLE');
    expect(err.message).toMatch(/unavailable/i);
  });

  it('throws a rate-limited error with retryAfterMs', async () => {
    const adapter = new FakeAnthropicAdapter({
      failSend: { kind: 'rate-limited', retryAfterMs: 1500 },
    });
    let caught: unknown;
    try {
      await adapter.send(userPrompt('any'));
    } catch (e) {
      caught = e;
    }
    const err = caught as Error & { code?: string; retryAfterMs?: number };
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterMs).toBe(1500);
  });

  it('uses a custom failure message when supplied', async () => {
    const adapter = new FakeAnthropicAdapter({
      failSend: { kind: 'error', message: 'custom boom' },
    });
    let caught: unknown;
    try {
      await adapter.send(userPrompt('x'));
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe('custom boom');
  });

  it('throws synchronously from stream when failStream is set', async () => {
    const adapter = new FakeAnthropicAdapter({
      failStream: { kind: 'unavailable', message: 'streaming offline' },
    });
    let caught: unknown;
    try {
      const iter = adapter.stream(userPrompt('x'))[Symbol.asyncIterator]();
      await iter.next();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('streaming offline');
  });
});

describe('FakeAnthropicAdapter — replay()', () => {
  it('returns the canned entry as a Result.ok', () => {
    const adapter = new FakeAnthropicAdapter({
      canned: [{ prompt: 'k', text: 'v' }],
    });
    const r = adapter.replay('k');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.text).toBe('v');
  });

  it('returns Result.err for unknown prompts', () => {
    const adapter = new FakeAnthropicAdapter();
    const r = adapter.replay('missing');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('NotFound');
      expect(r.error.prompt).toBe('missing');
    }
  });
});

describe('FakeAnthropicAdapter — registry integration', () => {
  it('registers cleanly and resolves back to the same handler', () => {
    const adapter = new FakeAnthropicAdapter();
    const registry = new ProviderRegistry();
    registry.register(adapter);
    expect(registry.has(ANTHROPIC)).toBe(true);
    expect(registry.size()).toBe(1);
    const resolved = registry.resolve(ANTHROPIC);
    expect(resolved).toBe(adapter);
    expect(registry.listIds()).toContain(ANTHROPIC);
  });

  it('refuses double-registration without replace', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeAnthropicAdapter());
    expect(() => registry.register(new FakeAnthropicAdapter())).toThrow(/already registered/);
  });

  it('accepts replace=true to swap handlers', () => {
    const registry = new ProviderRegistry();
    const first = new FakeAnthropicAdapter({ canned: [{ prompt: 'p', text: 'v1' }] });
    const second = new FakeAnthropicAdapter({ canned: [{ prompt: 'p', text: 'v2' }] });
    registry.register(first);
    registry.register(second, { replace: true });
    expect(registry.resolve(ANTHROPIC)).toBe(second);
  });
});
