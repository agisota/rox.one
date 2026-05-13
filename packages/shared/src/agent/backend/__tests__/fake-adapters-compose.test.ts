/**
 * Compose Test — M.7 T241-adapters.
 *
 * Builds a `ProviderRegistry` with both fake adapters, wires a `Failover`
 * policy (primary: openai, fallback: anthropic), and dispatches a single
 * request through the `Orchestrator`. Asserts the response shape and the
 * attempt trail end-to-end.
 *
 * This is the proof that the T241 fakes plug into the T240 backbone
 * without any glue code beyond what the public surface already exposes.
 */

import { describe, it, expect } from 'bun:test';
import { unsafeProviderId, type ProviderId } from '../provider-id.ts';
import {
  ProviderRegistry,
  type ProviderRequest,
  type ProviderStreamEvent,
} from '../provider-registry.ts';
import { createFailoverPolicy } from '../routing-policy.ts';
import { Orchestrator } from '../orchestrator.ts';
import {
  FakeAnthropicAdapter,
  FakeOpenAiAdapter,
} from '../adapters/index.ts';

const ANTHROPIC: ProviderId = unsafeProviderId('anthropic');
const OPENAI: ProviderId = unsafeProviderId('openai');

function buildRequest(content: string): ProviderRequest {
  return {
    model: 'fake-compose-model',
    messages: [
      { role: 'system', content: 'be brief' },
      { role: 'user', content },
    ],
  };
}

async function drain(events: AsyncIterable<ProviderStreamEvent>): Promise<ProviderStreamEvent[]> {
  const out: ProviderStreamEvent[] = [];
  for await (const ev of events) out.push(ev);
  return out;
}

describe('compose-test — registry + failover + orchestrator (T241 fakes)', () => {
  it('routes one request through Orchestrator.send() with the primary up', async () => {
    const anthropic = new FakeAnthropicAdapter({
      canned: [{ prompt: 'ping', text: 'pong-from-anthropic' }],
    });
    const openai = new FakeOpenAiAdapter({
      canned: [{ prompt: 'ping', text: 'pong-from-openai' }],
    });

    const registry = new ProviderRegistry();
    registry.register(anthropic);
    registry.register(openai);

    const policy = createFailoverPolicy({ primary: OPENAI, fallbacks: [ANTHROPIC] });
    const orchestrator = new Orchestrator({ registry, policy });

    const response = await orchestrator.send({ request: buildRequest('ping') });

    expect(response.mode).toBe('send');
    expect(response.ok).toBe(true);
    if (response.mode === 'send' && response.ok) {
      expect(response.value.kind).toBe('success');
      expect(response.value.providerId).toBe(OPENAI);
      expect(response.value.response.text).toBe('pong-from-openai');
      expect(response.value.attempts).toHaveLength(1);
      expect(response.value.attempts[0]?.providerId).toBe(OPENAI);
      expect(response.value.attempts[0]?.outcome).toBe('success');
    }

    expect(openai.sendCalls).toBe(1);
    expect(anthropic.sendCalls).toBe(0);
  });

  it('falls over to the secondary when the primary is unhealthy', async () => {
    const anthropic = new FakeAnthropicAdapter({
      canned: [{ prompt: 'ping', text: 'pong-from-anthropic' }],
    });
    const openai = new FakeOpenAiAdapter({
      healthy: false,
      canned: [{ prompt: 'ping', text: 'pong-from-openai' }],
    });

    const registry = new ProviderRegistry();
    registry.register(anthropic);
    registry.register(openai);

    const policy = createFailoverPolicy({ primary: OPENAI, fallbacks: [ANTHROPIC] });
    const orchestrator = new Orchestrator({ registry, policy });

    const response = await orchestrator.send({ request: buildRequest('ping') });

    expect(response.ok).toBe(true);
    if (response.mode === 'send' && response.ok) {
      expect(response.value.providerId).toBe(ANTHROPIC);
      expect(response.value.response.text).toBe('pong-from-anthropic');
      const outcomes = response.value.attempts.map((a) => a.outcome);
      expect(outcomes).toContain('unavailable');
      expect(outcomes).toContain('success');
    }

    expect(openai.sendCalls).toBe(0);
    expect(anthropic.sendCalls).toBe(1);
  });

  it('streams via failover from openai → anthropic when openai is unhealthy', async () => {
    const anthropic = new FakeAnthropicAdapter({
      canned: [
        {
          prompt: 'tell story',
          text: 'once upon',
          chunks: ['once', ' upon'],
        },
      ],
    });
    const openai = new FakeOpenAiAdapter({ healthy: false });

    const registry = new ProviderRegistry();
    registry.register(anthropic);
    registry.register(openai);

    const policy = createFailoverPolicy({ primary: OPENAI, fallbacks: [ANTHROPIC] });
    const orchestrator = new Orchestrator({ registry, policy });

    const response = await orchestrator.stream({ request: buildRequest('tell story') });

    expect(response.mode).toBe('stream');
    expect(response.ok).toBe(true);
    if (response.mode === 'stream' && response.ok) {
      expect(response.value.providerId).toBe(ANTHROPIC);
      const events = await drain(response.value.events);
      const chunks = events.filter((e) => e.kind === 'chunk');
      const ends = events.filter((e) => e.kind === 'end');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]?.kind === 'chunk' && chunks[0]?.delta).toBe('once');
      expect(chunks[1]?.kind === 'chunk' && chunks[1]?.delta).toBe(' upon');
      expect(ends).toHaveLength(1);
    }
  });

  it('exposes both adapters via registry.listIds()', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeAnthropicAdapter());
    registry.register(new FakeOpenAiAdapter());
    const ids = registry.listIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain(ANTHROPIC);
    expect(ids).toContain(OPENAI);
  });
});
