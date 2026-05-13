/**
 * Integration tests for unified-network-interceptor SSE handling edge cases.
 *
 * Covers the 5 P0 scenarios from the E2E audit:
 *   1. Consolidated SSE emission — split init+args-delta chunks → one consolidated event out
 *   2. Parallel tool calls — N calls at different indices → N consolidated events, no dedup confusion
 *   3. DeepSeek/relay args-only delta scenario — empty-id phase-2 chunks → correct merging
 *   4. sanitizeOpenAiHistoryInPlace — pre-fix poisoned history → healed and validates clean
 *   5. Stream interruption — SSE cut mid-tool-call → graceful flush, no crash
 *
 * All tests use raw SSE byte fixtures; no network involved.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { toolMetadataStore } from '../interceptor-common.ts';

let createOpenAiSseStrippingStream: typeof import('../unified-network-interceptor.ts').createOpenAiSseStrippingStream;
let sanitizeOpenAiHistoryInPlace: typeof import('../unified-network-interceptor.ts').sanitizeOpenAiHistoryInPlace;
let validateOpenAiChatBody: typeof import('../unified-network-interceptor.ts').validateOpenAiChatBody;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Drive SSE string chunks through a TransformStream and collect all output as
 * a single UTF-8 string. Each string in `chunks` is encoded as a Uint8Array
 * and enqueued separately to exercise the line-buffer stitching logic.
 */
async function runStream(
  processor: TransformStream<Uint8Array, Uint8Array>,
  chunks: string[],
): Promise<string> {
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  const reader = readable.pipeThrough(processor).getReader();
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

/**
 * Parse the SSE output and collect every tool_call entry that appears in a
 * `delta.tool_calls` field, accumulating arguments via index-keyed reassembly
 * exactly as a standard OpenAI-compatible SDK would.
 */
function reassembleOutput(out: string): Array<{
  index: number;
  id: string;
  name: string;
  arguments: string;
}> {
  const byIndex = new Map<number, { index: number; id: string; name: string; arguments: string }>();

  for (const line of out.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    let parsed: { choices?: Array<{ delta?: { tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> };
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    const tcs = parsed.choices?.[0]?.delta?.tool_calls;
    if (!tcs) continue;
    for (const tc of tcs) {
      const idx = tc.index ?? 0;
      const existing = byIndex.get(idx);
      if (!existing) {
        byIndex.set(idx, { index: idx, id: tc.id ?? '', name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '' });
      } else {
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
      }
    }
  }

  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

/** Count how many SSE data lines carry a tool_call entry with the given id AND a non-empty name. */
function countConsolidatedEventsForId(out: string, id: string): number {
  let count = 0;
  for (const line of out.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { tool_calls?: Array<{ id?: string; function?: { name?: string } }> } }> };
      const tcs = parsed.choices?.[0]?.delta?.tool_calls;
      if (!tcs) continue;
      for (const tc of tcs) {
        if (tc.id === id && tc.function?.name) count++;
      }
    } catch {
      continue;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------

describe('unified-network-interceptor SSE edge cases', () => {
  let sessionDir: string;

  beforeAll(async () => {
    process.env.ROX_INTERCEPTOR_DISABLE_AUTO_INSTALL = '1';
    const mod = await import('../unified-network-interceptor.ts');
    createOpenAiSseStrippingStream = mod.createOpenAiSseStrippingStream;
    sanitizeOpenAiHistoryInPlace = mod.sanitizeOpenAiHistoryInPlace;
    validateOpenAiChatBody = mod.validateOpenAiChatBody;
  });

  afterAll(() => {
    delete process.env.ROX_INTERCEPTOR_DISABLE_AUTO_INSTALL;
  });

  beforeEach(() => {
    sessionDir = mkdtempSync(join(tmpdir(), 'interceptor-edge-'));
    toolMetadataStore.setSessionDir(sessionDir);
  });

  afterEach(() => {
    toolMetadataStore._clearForTesting();
    rmSync(sessionDir, { recursive: true, force: true });
  });

  // =========================================================================
  // Scenario 1: Consolidated SSE emission
  // =========================================================================
  describe('1. Consolidated SSE emission', () => {
    it('emits exactly ONE consolidated event per tool call for split init+args-delta stream', async () => {
      // Standard OpenAI shape: first chunk carries id+name+empty-args, subsequent
      // chunks carry partial JSON args at the same index, finish_reason closes.
      // The interceptor must suppress all upstream chunks and emit ONE consolidated
      // event with id + name + cleanArgs together.
      const chunks = [
        // Init chunk — id, name, empty args
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_init","type":"function","function":{"name":"read_file","arguments":""}}]}}]}\n\n',
        // Args-only delta chunk 1
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\":"}}]}}]}\n\n',
        // Args-only delta chunk 2 — note: no id, no name
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"/etc/hosts\\"}"}}]}}]}\n\n',
        // Finish event
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);

      // Exactly one event carries id + name for this tool call.
      expect(countConsolidatedEventsForId(out, 'call_init')).toBe(1);

      const calls = reassembleOutput(out);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.id).toBe('call_init');
      expect(calls[0]!.name).toBe('read_file');
      expect(JSON.parse(calls[0]!.arguments)).toEqual({ path: '/etc/hosts' });

      // No metadata fields must leak.
      expect(out).not.toContain('_intent');
      expect(out).not.toContain('_displayName');
    });

    it('strips _intent and _displayName from args and stores them in toolMetadataStore', async () => {
      const chunks = [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_meta","type":"function","function":{"name":"web_fetch","arguments":"{\\"_intent\\":\\"fetch homepage\\",\\"_displayName\\":\\"Fetch Home\\",\\"url\\":\\"https://example.com\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);

      expect(out).not.toContain('_intent');
      expect(out).not.toContain('_displayName');

      const calls = reassembleOutput(out);
      expect(JSON.parse(calls[0]!.arguments)).toEqual({ url: 'https://example.com' });

      // Metadata captured into store.
      const meta = toolMetadataStore.get('call_meta', sessionDir);
      expect(meta?.intent).toBe('fetch homepage');
      expect(meta?.displayName).toBe('Fetch Home');
    });

    it('passes non-tool SSE events through unmodified', async () => {
      // A normal assistant text response (no tool calls) must pass through
      // without modification.
      const chunks = [
        'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{"content":" world"}}]}\n\n',
        'data: {"choices":[{"index":0,"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);

      expect(out).toContain('"content":"Hello"');
      expect(out).toContain('"content":" world"');
      expect(out).toContain('"finish_reason":"stop"');
      expect(out).toContain('[DONE]');
    });
  });

  // =========================================================================
  // Scenario 2: Parallel tool calls
  // =========================================================================
  describe('2. Parallel tool calls', () => {
    it('emits exactly one consolidated event per call when two parallel calls arrive in separate init chunks', async () => {
      // Each tool call opens in its own chunk, then gets arg-deltas, then finish.
      const chunks = [
        // Open call_A at index 0
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_A","type":"function","function":{"name":"list_files","arguments":""}}]}}]}\n\n',
        // Open call_B at index 1 in the same response
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"call_B","type":"function","function":{"name":"read_file","arguments":""}}]}}]}\n\n',
        // Args delta for call_A
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"dir\\":\\"/tmp\\"}"}}]}}]}\n\n',
        // Args delta for call_B
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{\\"path\\":\\"/etc/hosts\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);

      // One consolidated event each — no duplicates.
      expect(countConsolidatedEventsForId(out, 'call_A')).toBe(1);
      expect(countConsolidatedEventsForId(out, 'call_B')).toBe(1);

      const calls = reassembleOutput(out);
      expect(calls).toHaveLength(2);

      const callA = calls.find(c => c.id === 'call_A');
      const callB = calls.find(c => c.id === 'call_B');
      expect(callA).toBeDefined();
      expect(callB).toBeDefined();
      expect(JSON.parse(callA!.arguments)).toEqual({ dir: '/tmp' });
      expect(JSON.parse(callB!.arguments)).toEqual({ path: '/etc/hosts' });
    });

    it('preserves correct args for each call — no cross-contamination between indices', async () => {
      // Three parallel calls. Verify args are assigned to the right call.
      const chunks = [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"tc_0","type":"function","function":{"name":"fn0","arguments":"{\\"k\\":0}"}},{"index":1,"id":"tc_1","type":"function","function":{"name":"fn1","arguments":"{\\"k\\":1}"}},{"index":2,"id":"tc_2","type":"function","function":{"name":"fn2","arguments":"{\\"k\\":2}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);
      const calls = reassembleOutput(out);

      expect(calls).toHaveLength(3);
      expect(JSON.parse(calls[0]!.arguments)).toEqual({ k: 0 });
      expect(JSON.parse(calls[1]!.arguments)).toEqual({ k: 1 });
      expect(JSON.parse(calls[2]!.arguments)).toEqual({ k: 2 });

      // No cross-contamination: each id appears exactly once.
      expect(countConsolidatedEventsForId(out, 'tc_0')).toBe(1);
      expect(countConsolidatedEventsForId(out, 'tc_1')).toBe(1);
      expect(countConsolidatedEventsForId(out, 'tc_2')).toBe(1);
    });
  });

  // =========================================================================
  // Scenario 3: DeepSeek / relay args-only delta scenario
  // =========================================================================
  describe('3. DeepSeek/relay args-only delta (legacy behavior)', () => {
    it('merges phase-2 args-at-shifted-index into phase-1 entries; output has correct count and clean args', async () => {
      // Classic DeepSeek two-phase shape:
      //   Phase 1: index 0 carries id+name+metadata-only args
      //   Phase 2: index 1 carries empty id/name + actual content args
      // The interceptor merges them; output must show 1 tool_call with merged + stripped args.
      const chunks = [
        // Phase 1 — metadata-only args at index 0
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_ds","type":"function","function":{"name":"search","arguments":"{\\"_intent\\":\\"search web\\",\\"_displayName\\":\\"Web Search\\"}"}}]}}]}\n\n',
        // Phase 2 — actual args at shifted index 1, empty id+name
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"id":"","function":{"name":"","arguments":"{\\"query\\":\\"climate change 2025\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);
      const calls = reassembleOutput(out);

      // Exactly 1 call — no phantom empty-id entry from phase 2.
      expect(calls).toHaveLength(1);
      expect(calls[0]!.id).toBe('call_ds');
      expect(calls[0]!.name).toBe('search');

      // Phase-2 args win (they carry the real content).
      const args = JSON.parse(calls[0]!.arguments);
      expect(args).toHaveProperty('query', 'climate change 2025');
      expect(args).not.toHaveProperty('_intent');
      expect(args).not.toHaveProperty('_displayName');

      // Metadata captured from phase-1.
      const meta = toolMetadataStore.get('call_ds', sessionDir);
      expect(meta?.intent).toBe('search web');
      expect(meta?.displayName).toBe('Web Search');
    });

    it('output contains zero tool_call entries with empty id for any relay shape', async () => {
      // Feed a stream where relay also repeats tc.id on subsequent arg-delta chunks.
      // None of those should produce extra empty-id entries in output.
      const chunks = [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_rep","type":"function","function":{"name":"ls","arguments":"{\\"pa"}}]}}]}\n\n',
        // Relay repeats id on second arg-delta chunk
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_rep","type":"function","function":{"name":"ls","arguments":"th\\":\\""}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_rep","type":"function","function":{"name":"ls","arguments":"/tmp\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);
      const calls = reassembleOutput(out);

      // No empty-id entries.
      for (const call of calls) {
        expect(call.id).not.toBe('');
      }

      // One consolidated event with reassembled args.
      expect(calls).toHaveLength(1);
      expect(calls[0]!.id).toBe('call_rep');
      expect(JSON.parse(calls[0]!.arguments)).toEqual({ path: '/tmp' });
    });
  });

  // =========================================================================
  // Scenario 4: sanitizeOpenAiHistoryInPlace
  // =========================================================================
  describe('4. sanitizeOpenAiHistoryInPlace heals pre-fix poisoned history', () => {
    it('drops empty-id tool_calls and their orphan tool results, leaving valid history', () => {
      // This is the exact shape written to disk by the pre-fix strip stream:
      // one real call + two phantom empty-id entries from split-emit flush.
      const body = {
        messages: [
          { role: 'user', content: 'summarize these articles' },
          {
            role: 'assistant',
            tool_calls: [
              { id: 'call_real', type: 'function', function: { name: 'web_fetch', arguments: '{"url":"https://good.example"}' } },
              // Phantom entries from pre-fix emit: empty id, empty name
              { id: '', type: 'function', function: { name: '', arguments: '{"url":"https://a.example"}' } },
              { id: '', type: 'function', function: { name: '', arguments: '{"url":"https://b.example"}' } },
            ],
          },
          // Corresponding tool results — the real one is legit, the others are orphaned
          { role: 'tool', tool_call_id: 'call_real', content: 'article text' },
          { role: 'tool', tool_call_id: '', content: 'orphan result 1' },
          { role: 'tool', tool_call_id: '', content: 'orphan result 2' },
        ],
      };

      const result = sanitizeOpenAiHistoryInPlace(body);

      expect(result.droppedToolCalls).toBe(2);
      expect(result.droppedToolResults).toBe(2);

      // Healed body must pass the outgoing body validator.
      expect(() => validateOpenAiChatBody(body)).not.toThrow();

      // Structure: user + assistant(1 call) + 1 tool result.
      const msgs = body.messages as Array<{ role?: string; tool_calls?: unknown[]; tool_call_id?: string }>;
      expect(msgs).toHaveLength(3);
      expect(msgs[1]?.tool_calls).toHaveLength(1);
      expect(msgs[2]?.tool_call_id).toBe('call_real');
    });

    it('removes tool_calls key entirely when ALL entries are empty-id (edge: assistant with no valid calls)', () => {
      const body = {
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              { id: '', type: 'function', function: { name: '', arguments: '{}' } },
            ],
          },
        ],
      };

      sanitizeOpenAiHistoryInPlace(body);

      const msg = (body.messages as Array<{ tool_calls?: unknown }>)[0];
      expect(msg).not.toHaveProperty('tool_calls');
    });

    it('is a strict no-op on healthy history (no phantom entries)', () => {
      const body = {
        messages: [
          { role: 'user', content: 'ping' },
          {
            role: 'assistant',
            tool_calls: [
              { id: 'call_good', type: 'function', function: { name: 'ping', arguments: '{}' } },
            ],
          },
          { role: 'tool', tool_call_id: 'call_good', content: 'pong' },
        ],
      };
      const snapshot = JSON.stringify(body);
      const result = sanitizeOpenAiHistoryInPlace(body);
      expect(result.droppedToolCalls).toBe(0);
      expect(result.droppedToolResults).toBe(0);
      expect(JSON.stringify(body)).toBe(snapshot);
    });

    it('handles multi-turn history with phantom entries only in middle turns', () => {
      // Turn 1 is clean; Turn 2 has phantom empty-id entries; Turn 3 is a follow-up.
      // Only Turn 2 artifacts should be sanitized.
      const body = {
        messages: [
          { role: 'user', content: 'first turn' },
          {
            role: 'assistant',
            tool_calls: [
              { id: 'call_t1', type: 'function', function: { name: 'read', arguments: '{}' } },
            ],
          },
          { role: 'tool', tool_call_id: 'call_t1', content: 'result' },
          { role: 'user', content: 'second turn' },
          {
            role: 'assistant',
            tool_calls: [
              { id: 'call_t2', type: 'function', function: { name: 'write', arguments: '{}' } },
              { id: '', type: 'function', function: { name: '', arguments: '{"phantom":true}' } },
            ],
          },
          { role: 'tool', tool_call_id: 'call_t2', content: 'written' },
          { role: 'tool', tool_call_id: '', content: 'phantom result' },
        ],
      };

      const result = sanitizeOpenAiHistoryInPlace(body);

      expect(result.droppedToolCalls).toBe(1);
      expect(result.droppedToolResults).toBe(1);
      expect(() => validateOpenAiChatBody(body)).not.toThrow();

      // Turn 1 intact.
      const msgs = body.messages as Array<{ role?: string; tool_calls?: unknown[]; tool_call_id?: string }>;
      const assistantTurn1 = msgs.find((m, i) => m.role === 'assistant' && i === 1);
      expect(assistantTurn1?.tool_calls).toHaveLength(1);
    });
  });

  // =========================================================================
  // Scenario 5: Stream interruption
  // =========================================================================
  describe('5. Stream interruption — graceful flush on truncated input', () => {
    it('does not crash when stream ends mid-tool-call (no [DONE] or finish_reason)', async () => {
      // Simulate a network cut: the stream closes after arg-delta chunks
      // but before [DONE] or finish_reason. The interceptor's flush handler
      // should emit whatever it has buffered without throwing.
      const chunks = [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_cut","type":"function","function":{"name":"ls","arguments":"{\\"path\\":"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"/tmp\\"}"}}]}}]}\n\n',
        // Stream ends here — no [DONE], no finish_reason
      ];

      let out: string | undefined;
      let thrownError: unknown;
      try {
        out = await runStream(createOpenAiSseStrippingStream(), chunks);
      } catch (err) {
        thrownError = err;
      }

      // Must not crash.
      expect(thrownError).toBeUndefined();

      // The buffered call should have been flushed with the args assembled so far.
      expect(out).toBeDefined();
      const calls = reassembleOutput(out!);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.id).toBe('call_cut');
      expect(JSON.parse(calls[0]!.arguments)).toEqual({ path: '/tmp' });
    });

    it('does not crash when stream ends mid-json-chunk (incomplete SSE line)', async () => {
      // The last byte-chunk is cut inside the JSON payload — no trailing \n\n.
      const chunks = [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_trunc","type":"function","function":{"name":"grep","arguments":"{\\"q\\":\\"foo\\"}"}}]}}]}\n\n',
        // Truncated: no \n\n at end, line buffer will hold this on flush
        'data: {"choices":[{"index":0,"finish_reason":"tool_calls',
      ];

      let out: string | undefined;
      let thrownError: unknown;
      try {
        out = await runStream(createOpenAiSseStrippingStream(), chunks);
      } catch (err) {
        thrownError = err;
      }

      // Must not throw — malformed tail should be ignored gracefully.
      expect(thrownError).toBeUndefined();
      expect(out).toBeDefined();

      // The complete tool call before the truncation should have been flushed.
      const calls = reassembleOutput(out!);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.id).toBe('call_trunc');
    });

    it('does not crash on a completely empty stream', async () => {
      let out: string | undefined;
      let thrownError: unknown;
      try {
        out = await runStream(createOpenAiSseStrippingStream(), []);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeUndefined();
      expect(out).toBeDefined();
      expect(out).toBe('');
    });

    it('handles stream that sends [DONE] with no preceding tool_call chunks (no buffered state)', async () => {
      const chunks = [
        'data: [DONE]\n\n',
      ];

      const out = await runStream(createOpenAiSseStrippingStream(), chunks);
      expect(out).toContain('[DONE]');
      expect(reassembleOutput(out)).toHaveLength(0);
    });
  });
});
