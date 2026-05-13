/**
 * Provider Registry — M.7 T240.
 *
 * Branded `ProviderId` -> handler bindings. The registry is the only
 * structural way the orchestrator discovers usable providers. Handler shape
 * is intentionally minimal: streaming + non-streaming chat over a
 * provider-agnostic request/response pair plus a `healthy()` probe.
 *
 * Pure module. Adapters that wrap real LLM SDKs live in T241; this file
 * never imports them.
 */

import type { ProviderId } from './provider-id.ts';

// ============================================================
// Provider request / response surface
// ============================================================

export interface ProviderMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ProviderRequest {
  readonly model: string;
  readonly messages: readonly ProviderMessage[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly stream?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface ProviderResponseChunk {
  readonly kind: 'chunk';
  readonly delta: string;
  readonly index: number;
}

export interface ProviderResponseEnd {
  readonly kind: 'end';
  readonly reason: 'stop' | 'length' | 'tool-use' | 'cancelled';
  readonly usage?: ProviderUsage;
}

export type ProviderStreamEvent = ProviderResponseChunk | ProviderResponseEnd;

export interface ProviderNonStreamingResponse {
  readonly text: string;
  readonly usage?: ProviderUsage;
}

// ============================================================
// Handler contract — pure value the registry stores.
// ============================================================

export interface ProviderHandler {
  readonly id: ProviderId;
  healthy(): boolean;
  send(request: ProviderRequest): Promise<ProviderNonStreamingResponse>;
  stream(request: ProviderRequest): AsyncIterable<ProviderStreamEvent>;
}

// ============================================================
// Registry
// ============================================================

export class ProviderRegistry {
  private readonly handlers = new Map<ProviderId, ProviderHandler>();

  register(handler: ProviderHandler, options: { replace?: boolean } = {}): void {
    const { replace = false } = options;
    if (!replace && this.handlers.has(handler.id)) {
      throw new Error(
        `ProviderRegistry: provider "${handler.id}" already registered; pass { replace: true } to override`,
      );
    }
    this.handlers.set(handler.id, handler);
  }

  resolve(id: ProviderId): ProviderHandler | undefined {
    return this.handlers.get(id);
  }

  listIds(): readonly ProviderId[] {
    return Array.from(this.handlers.keys());
  }

  listHandlers(): readonly ProviderHandler[] {
    return Array.from(this.handlers.values());
  }

  has(id: ProviderId): boolean {
    return this.handlers.has(id);
  }

  size(): number {
    return this.handlers.size;
  }

  unregister(id: ProviderId): boolean {
    return this.handlers.delete(id);
  }

  clear(): void {
    this.handlers.clear();
  }
}
