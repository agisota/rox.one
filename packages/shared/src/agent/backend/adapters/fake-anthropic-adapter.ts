/**
 * Fake Anthropic Provider Adapter — M.7 T241-adapters.
 *
 * Implements the {@link ProviderHandler} contract from T240's
 * {@link ProviderRegistry} surface. This adapter is a PURE FAKE: it never
 * touches the network, the filesystem, or `process.env`. It exists as:
 *   1. A unit/integration-test fixture for the orchestration backbone.
 *   2. A template for the real Anthropic adapter that lands in T242.
 *
 * Lifecycle exercised:
 *   - construction / id binding
 *   - healthy() probe with a configurable toggle
 *   - send() returning canned text for known prompts (or a templated echo)
 *   - stream() yielding chunk events plus a terminal `end` event
 *   - configurable failure surface mirroring the orchestrator's classifier:
 *     `ProviderUnavailableError`-style throws + `RateLimitedError`-style
 *     throws (the orchestrator inspects `error.code` / `error.message`).
 *
 * The Result<T,E> envelope from `../provider-id.ts` is reused for the
 * `replay()` helper that lets tests peek at the canned response without
 * invoking `send`. We deliberately do not redefine Result here.
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

/** A canned answer keyed by an exact match against the last user message. */
export interface FakeAnthropicCannedResponse {
  /** Exact user-message content to match (case-sensitive). */
  readonly prompt: string;
  /** Non-streaming response text. */
  readonly text: string;
  /** Streaming chunks. If omitted, the text is split into 3 even chunks. */
  readonly chunks?: readonly string[];
  /** Optional token usage to attach. */
  readonly usage?: ProviderUsage;
  /** Optional terminal reason; defaults to `'stop'`. */
  readonly stopReason?: 'stop' | 'length' | 'tool-use' | 'cancelled';
}

/**
 * Failure modes the adapter exposes. These map onto the orchestrator's
 * `classifyError` heuristics so the discriminated error union in
 * `orchestrator.ts` recognises them without bespoke wiring.
 */
export type FakeAnthropicFailureMode =
  | { readonly kind: 'unavailable'; readonly message?: string }
  | { readonly kind: 'rate-limited'; readonly retryAfterMs?: number; readonly message?: string }
  | { readonly kind: 'error'; readonly message?: string };

export interface FakeAnthropicAdapterOptions {
  /** Override the provider id used to register. Defaults to `'anthropic'`. */
  readonly providerId?: ProviderId;
  /** Toggle for `healthy()`. Defaults to `true`. */
  readonly healthy?: boolean;
  /** Canned responses; falls back to a templated echo. */
  readonly canned?: readonly FakeAnthropicCannedResponse[];
  /** Default chunk count when splitting an un-chunked text response. */
  readonly defaultChunkCount?: number;
  /** Configured failure for `send()`. */
  readonly failSend?: FakeAnthropicFailureMode;
  /** Configured failure for `stream()`. */
  readonly failStream?: FakeAnthropicFailureMode;
  /** Default token usage when the canned entry omits one. */
  readonly defaultUsage?: ProviderUsage;
}

const ANTHROPIC_DEFAULT_USAGE: ProviderUsage = Object.freeze({
  inputTokens: 8,
  outputTokens: 12,
  totalTokens: 20,
});

const DEFAULT_REPLY_TEMPLATE = (echo: string): string =>
  `[fake-anthropic] received ${echo.length} char(s): ${echo.slice(0, 120)}`;

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

function failureToError(mode: FakeAnthropicFailureMode): Error {
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

function defaultFailureMessage(kind: FakeAnthropicFailureMode['kind']): string {
  switch (kind) {
    case 'rate-limited':
      return 'fake-anthropic: rate-limited by configured failure';
    case 'unavailable':
      return 'fake-anthropic: provider unavailable (configured failure)';
    case 'error':
    default:
      return 'fake-anthropic: configured failure';
  }
}

// ============================================================
// Adapter
// ============================================================

export class FakeAnthropicAdapter implements ProviderHandler {
  readonly id: ProviderId;

  private readonly canned: readonly FakeAnthropicCannedResponse[];
  private readonly defaultChunkCount: number;
  private readonly defaultUsage: ProviderUsage;
  private readonly _healthy: boolean;
  private readonly failSend?: FakeAnthropicFailureMode;
  private readonly failStream?: FakeAnthropicFailureMode;

  /** Observation surface for tests — increments on every send / stream call. */
  public sendCalls = 0;
  public streamCalls = 0;
  public lastRequest?: ProviderRequest;

  constructor(options: FakeAnthropicAdapterOptions = {}) {
    this.id = options.providerId ?? unsafeProviderId('anthropic');
    this.canned = options.canned ?? [];
    this.defaultChunkCount = Math.max(1, options.defaultChunkCount ?? 3);
    this.defaultUsage = options.defaultUsage ?? ANTHROPIC_DEFAULT_USAGE;
    this._healthy = options.healthy ?? true;
    this.failSend = options.failSend;
    this.failStream = options.failStream;
  }

  healthy(): boolean {
    return this._healthy;
  }

  /** Return the canned entry for a prompt without invoking send/stream. */
  replay(prompt: string): Result<FakeAnthropicCannedResponse, { kind: 'NotFound'; prompt: string }> {
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

/** Convenience factory for tests that want a one-off adapter. */
export function createFakeAnthropicAdapter(
  options: FakeAnthropicAdapterOptions = {},
): FakeAnthropicAdapter {
  return new FakeAnthropicAdapter(options);
}
