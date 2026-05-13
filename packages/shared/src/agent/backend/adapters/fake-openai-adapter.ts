/**
 * Fake OpenAI Provider Adapter — M.7 T241-adapters.
 *
 * Same shape as `fake-anthropic-adapter.ts`, different `ProviderId` and a
 * different default canned-response style so registry-level tests can tell
 * the two apart by output. The adapter is a PURE FAKE: no fetch, no fs, no
 * `process.env`.
 *
 * Key differences from the Anthropic fake:
 *   - default chunk count is 4 (matching the rough cadence of OpenAI's SSE
 *     deltas vs Anthropic's larger chunks)
 *   - default templated reply prefixes `[fake-openai]` for easy assertion
 *   - exposes a `setHealthy(boolean)` toggle so tests can flip availability
 *     mid-suite without re-instantiating
 *
 * Both adapters intentionally share zero code — they are templates first,
 * fixtures second, and DRYing them would obscure the contract that real
 * adapters in T242 must implement independently.
 */

import type { ProviderId, Result } from '../provider-id.ts';
import { unsafeProviderId } from '../provider-id.ts';
import type {
  ProviderHandler,
  ProviderNonStreamingResponse,
  ProviderRequest,
  ProviderStreamEvent,
  ProviderUsage,
} from '../provider-registry.ts';

// ============================================================
// Canned responses
// ============================================================

export interface FakeOpenAiCannedResponse {
  readonly prompt: string;
  readonly text: string;
  readonly chunks?: readonly string[];
  readonly usage?: ProviderUsage;
  readonly stopReason?: 'stop' | 'length' | 'tool-use' | 'cancelled';
}

export type FakeOpenAiFailureMode =
  | { readonly kind: 'unavailable'; readonly message?: string }
  | { readonly kind: 'rate-limited'; readonly retryAfterMs?: number; readonly message?: string }
  | { readonly kind: 'error'; readonly message?: string };

export interface FakeOpenAiAdapterOptions {
  readonly providerId?: ProviderId;
  readonly healthy?: boolean;
  readonly canned?: readonly FakeOpenAiCannedResponse[];
  readonly defaultChunkCount?: number;
  readonly failSend?: FakeOpenAiFailureMode;
  readonly failStream?: FakeOpenAiFailureMode;
  readonly defaultUsage?: ProviderUsage;
}

const OPENAI_DEFAULT_USAGE: ProviderUsage = Object.freeze({
  inputTokens: 10,
  outputTokens: 15,
  totalTokens: 25,
});

const DEFAULT_REPLY_TEMPLATE = (echo: string): string =>
  `[fake-openai] echo<${echo.length}>: ${echo.slice(0, 120)}`;

// ============================================================
// Helpers
// ============================================================

function lastUserMessage(request: ProviderRequest): string {
  for (let i = request.messages.length - 1; i >= 0; i -= 1) {
    const msg = request.messages[i];
    if (msg && msg.role === 'user') return msg.content;
  }
  return '';
}

function splitIntoChunks(text: string, count: number): readonly string[] {
  if (text.length === 0) return [''];
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount === 1) return [text];
  const chunkSize = Math.max(1, Math.ceil(text.length / safeCount));
  const out: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    out.push(text.slice(i, i + chunkSize));
  }
  return out;
}

function failureToError(mode: FakeOpenAiFailureMode): Error {
  const base: Error & { code?: string; retryAfterMs?: number } = new Error(
    mode.message ?? defaultFailureMessage(mode.kind),
  );
  if (mode.kind === 'rate-limited') {
    base.code = 'RATE_LIMITED';
    if (mode.retryAfterMs !== undefined) base.retryAfterMs = mode.retryAfterMs;
  } else if (mode.kind === 'unavailable') {
    base.code = 'PROVIDER_UNAVAILABLE';
  }
  return base;
}

function defaultFailureMessage(kind: FakeOpenAiFailureMode['kind']): string {
  switch (kind) {
    case 'rate-limited':
      return 'fake-openai: rate-limited by configured failure';
    case 'unavailable':
      return 'fake-openai: provider unavailable (configured failure)';
    case 'error':
    default:
      return 'fake-openai: configured failure';
  }
}

// ============================================================
// Adapter
// ============================================================

export class FakeOpenAiAdapter implements ProviderHandler {
  readonly id: ProviderId;

  private readonly canned: readonly FakeOpenAiCannedResponse[];
  private readonly defaultChunkCount: number;
  private readonly defaultUsage: ProviderUsage;
  private _healthy: boolean;
  private readonly failSend?: FakeOpenAiFailureMode;
  private readonly failStream?: FakeOpenAiFailureMode;

  public sendCalls = 0;
  public streamCalls = 0;
  public lastRequest?: ProviderRequest;

  constructor(options: FakeOpenAiAdapterOptions = {}) {
    this.id = options.providerId ?? unsafeProviderId('openai');
    this.canned = options.canned ?? [];
    this.defaultChunkCount = Math.max(1, options.defaultChunkCount ?? 4);
    this.defaultUsage = options.defaultUsage ?? OPENAI_DEFAULT_USAGE;
    this._healthy = options.healthy ?? true;
    this.failSend = options.failSend;
    this.failStream = options.failStream;
  }

  healthy(): boolean {
    return this._healthy;
  }

  /** Flip the health flag at runtime. Useful for failover tests. */
  setHealthy(value: boolean): void {
    this._healthy = value;
  }

  /** Return the canned entry for a prompt without invoking send/stream. */
  replay(prompt: string): Result<FakeOpenAiCannedResponse, { kind: 'NotFound'; prompt: string }> {
    const hit = this.canned.find((c) => c.prompt === prompt);
    if (hit) return { ok: true, value: hit };
    return { ok: false, error: { kind: 'NotFound', prompt } };
  }

  async send(request: ProviderRequest): Promise<ProviderNonStreamingResponse> {
    this.sendCalls += 1;
    this.lastRequest = request;
    if (this.failSend) throw failureToError(this.failSend);
    const user = lastUserMessage(request);
    const canned = this.canned.find((c) => c.prompt === user);
    if (canned) {
      return { text: canned.text, usage: canned.usage ?? this.defaultUsage };
    }
    return {
      text: DEFAULT_REPLY_TEMPLATE(user),
      usage: this.defaultUsage,
    };
  }

  async *stream(request: ProviderRequest): AsyncIterable<ProviderStreamEvent> {
    this.streamCalls += 1;
    this.lastRequest = request;
    if (this.failStream) throw failureToError(this.failStream);
    const user = lastUserMessage(request);
    const canned = this.canned.find((c) => c.prompt === user);
    const text = canned?.text ?? DEFAULT_REPLY_TEMPLATE(user);
    const chunks = canned?.chunks ?? splitIntoChunks(text, this.defaultChunkCount);
    for (let i = 0; i < chunks.length; i += 1) {
      yield { kind: 'chunk', delta: chunks[i] as string, index: i };
    }
    yield {
      kind: 'end',
      reason: canned?.stopReason ?? 'stop',
      usage: canned?.usage ?? this.defaultUsage,
    };
  }
}

export function createFakeOpenAiAdapter(
  options: FakeOpenAiAdapterOptions = {},
): FakeOpenAiAdapter {
  return new FakeOpenAiAdapter(options);
}
