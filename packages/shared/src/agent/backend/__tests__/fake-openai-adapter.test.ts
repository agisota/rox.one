/**
 * Tests for FakeOpenAiAdapter — M.7 T241-adapters.
 *
 * Mirrors the Anthropic adapter suite but verifies OpenAI-specific defaults
 * (provider id, chunk count, templated echo prefix, setHealthy toggle).
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
  FakeOpenAiAdapter,
  createFakeOpenAiAdapter,
} from '../adapters/fake-openai-adapter.ts';

const OPENAI: ProviderId = unsafeProviderId('openai');

function userPrompt(content: string): ProviderRequest {
  return {
    model: 'gpt-fake-1',
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

describe('FakeOpenAiAdapter — construction', () => {
  it('binds the openai provider id by default', () => {
    const adapter = new FakeOpenAiAdapter();
    expect(adapter.id).toBe(OPENAI);
    expect(adapter.healthy()).toBe(true);
    expect(adapter.sendCalls).toBe(0);
    expect(adapter.streamCalls).toBe(0);
  });

  it('honours the healthy=false toggle', () => {
    const adapter = new FakeOpenAiAdapter({ healthy: false });
    expect(adapter.healthy()).toBe(false);
  });

  it('setHealthy flips the runtime flag', () => {
    const adapter = new FakeOpenAiAdapter();
    expect(adapter.healthy()).toBe(true);
    adapter.setHealthy(false);
    expect(adapter.healthy()).toBe(false);
    adapter.setHealthy(true);
    expect(adapter.healthy()).toBe(true);
  });

  it('accepts a custom provider id', () => {
    const customId = unsafeProviderId('azure-openai');
    const adapter = new FakeOpenAiAdapter({ providerId: customId });
    expect(adapter.id).toBe(customId);
  });

  it('exposes a convenience factory', () => {
    const adapter = createFakeOpenAiAdapter();
    expect(adapter).toBeInstanceOf(FakeOpenAiAdapter);
    expect(adapter.id).toBe(OPENAI);
  });
});

describe('FakeOpenAiAdapter — send()', () => {
  it('returns the templated echo with the [fake-openai] prefix', async () => {
    const adapter = new FakeOpenAiAdapter();
    const result = await adapter.send(userPrompt('hi there'));
    expect(result.text).toContain('[fake-openai]');
    expect(result.text).toContain('hi there');
    expect(result.usage?.totalTokens).toBe(25);
    expect(adapter.sendCalls).toBe(1);
    expect(adapter.lastRequest?.model).toBe('gpt-fake-1');
  });

  it('returns the canned response for a matching prompt', async () => {
    const adapter = new FakeOpenAiAdapter({
      canned: [
        {
          prompt: 'capital of france',
          text: 'Paris',
          usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5 },
        },
      ],
    });
    const result = await adapter.send(userPrompt('capital of france'));
    expect(result.text).toBe('Paris');
    expect(result.usage?.totalTokens).toBe(5);
  });

  it('falls back to defaultUsage when canned entry omits usage', async () => {
    const adapter = new FakeOpenAiAdapter({
      canned: [{ prompt: 'q', text: 'a' }],
      defaultUsage: { inputTokens: 3, outputTokens: 9, totalTokens: 12 },
    });
    const result = await adapter.send(userPrompt('q'));
    expect(result.usage?.totalTokens).toBe(12);
  });

  it('honours the last user message when several are present', async () => {
    const adapter = new FakeOpenAiAdapter({
      canned: [{ prompt: 'second', text: 'matched' }],
    });
    const result = await adapter.send({
      model: 'gpt-fake-1',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ],
    });
    expect(result.text).toBe('matched');
  });

  it('increments sendCalls only on send invocations', async () => {
    const adapter = new FakeOpenAiAdapter();
    await adapter.send(userPrompt('a'));
    await adapter.send(userPrompt('b'));
    expect(adapter.sendCalls).toBe(2);
    expect(adapter.streamCalls).toBe(0);
  });
});

describe('FakeOpenAiAdapter — stream()', () => {
  it('yields chunks plus a terminal end event', async () => {
    const adapter = new FakeOpenAiAdapter({ defaultChunkCount: 4 });
    const events = await drain(adapter.stream(userPrompt('streaming?')));
    const chunks = events.filter((e) => e.kind === 'chunk');
    const ends = events.filter((e) => e.kind === 'end');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.length).toBeLessThanOrEqual(4);
    expect(ends).toHaveLength(1);
    if (ends[0]?.kind === 'end') {
      expect(ends[0].reason).toBe('stop');
      expect(ends[0].usage?.totalTokens).toBe(25);
    }
  });

  it('honours canned chunks when provided', async () => {
    const adapter = new FakeOpenAiAdapter({
      canned: [{ prompt: 'tell', text: 'hello world', chunks: ['hello', ' ', 'world'] }],
    });
    const events = await drain(adapter.stream(userPrompt('tell')));
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ kind: 'chunk', delta: 'hello', index: 0 });
    expect(events[1]).toEqual({ kind: 'chunk', delta: ' ', index: 1 });
    expect(events[2]).toEqual({ kind: 'chunk', delta: 'world', index: 2 });
    expect(events[3]?.kind).toBe('end');
  });

  it('uses canned stopReason when supplied', async () => {
    const adapter = new FakeOpenAiAdapter({
      canned: [{ prompt: 'cap', text: 'x', stopReason: 'tool-use' }],
    });
    const events = await drain(adapter.stream(userPrompt('cap')));
    const end = events.at(-1);
    expect(end?.kind).toBe('end');
    if (end?.kind === 'end') expect(end.reason).toBe('tool-use');
  });

  it('increments streamCalls and records lastRequest', async () => {
    const adapter = new FakeOpenAiAdapter();
    await drain(adapter.stream(userPrompt('one')));
    await drain(adapter.stream(userPrompt('two')));
    await drain(adapter.stream(userPrompt('three')));
    expect(adapter.streamCalls).toBe(3);
    expect(adapter.lastRequest?.messages.at(-1)?.content).toBe('three');
  });
});

describe('FakeOpenAiAdapter — failure modes', () => {
  it('throws an unavailable-style error from send when configured', async () => {
    const adapter = new FakeOpenAiAdapter({ failSend: { kind: 'unavailable' } });
    let caught: unknown;
    try {
      await adapter.send(userPrompt('x'));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error & { code?: string };
    expect(err.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('throws a rate-limited error with retryAfterMs', async () => {
    const adapter = new FakeOpenAiAdapter({
      failSend: { kind: 'rate-limited', retryAfterMs: 750 },
    });
    let caught: unknown;
    try {
      await adapter.send(userPrompt('x'));
    } catch (e) {
      caught = e;
    }
    const err = caught as Error & { code?: string; retryAfterMs?: number };
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterMs).toBe(750);
  });

  it('throws a generic error with a custom message', async () => {
    const adapter = new FakeOpenAiAdapter({
      failSend: { kind: 'error', message: 'boom' },
    });
    let caught: unknown;
    try {
      await adapter.send(userPrompt('x'));
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe('boom');
  });

  it('throws synchronously from stream when failStream is set', async () => {
    const adapter = new FakeOpenAiAdapter({
      failStream: { kind: 'rate-limited', message: '429 stream' },
    });
    let caught: unknown;
    try {
      const iter = adapter.stream(userPrompt('x'))[Symbol.asyncIterator]();
      await iter.next();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('429 stream');
  });
});

describe('FakeOpenAiAdapter — replay()', () => {
  it('returns the canned entry as Result.ok', () => {
    const adapter = new FakeOpenAiAdapter({
      canned: [{ prompt: 'kk', text: 'vv' }],
    });
    const r = adapter.replay('kk');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.text).toBe('vv');
  });

  it('returns Result.err for unknown prompts', () => {
    const adapter = new FakeOpenAiAdapter();
    const r = adapter.replay('nope');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('NotFound');
      expect(r.error.prompt).toBe('nope');
    }
  });
});

describe('FakeOpenAiAdapter — registry integration', () => {
  it('registers cleanly and resolves back to the same handler', () => {
    const adapter = new FakeOpenAiAdapter();
    const registry = new ProviderRegistry();
    registry.register(adapter);
    expect(registry.has(OPENAI)).toBe(true);
    expect(registry.size()).toBe(1);
    expect(registry.resolve(OPENAI)).toBe(adapter);
    expect(registry.listIds()).toContain(OPENAI);
  });

  it('refuses double-registration without replace', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeOpenAiAdapter());
    expect(() => registry.register(new FakeOpenAiAdapter())).toThrow(/already registered/);
  });
});
