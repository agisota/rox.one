/**
 * useDomainOrchestratorClient — M.7 T242d.
 *
 * Domain-shape bridge over the T242b `useOrchestrator` hook. T242c audit
 * (docs/release/m7-composer-orchestrator-audit.md) identified the
 * composer surfaces (`createPromptRewriteService`,
 * `createThinkingPartnerService`) as blocked from direct orchestrator
 * wiring: their requests carry domain-specific fields, not kernel
 * `ProviderRequest` (`{ model, messages, ... }`). T242d ships the
 * adapter-aware client hook so consumers can keep speaking their domain
 * shape while the call still flows through the T240/T242 backbone.
 *
 *   const client = useDomainOrchestratorClient({ adapter, orchestrator })
 *   const result = await client.dispatch(domainRequest)   // TDomainResponse
 *   client.pending     // mirrors the inner useOrchestrator
 *   client.lastError   // OrchestrationError | null (kernel error union)
 *
 * Composition-only: this hook does NOT modify `useOrchestrator` (T242b
 * is frozen on `main`) nor any backbone module. All adaptation happens
 * inside `dispatch` — domain → kernel on the way in, kernel → domain
 * on the way out.
 */

import { useCallback } from 'react'
import { useOrchestrator } from './useOrchestrator'
// Deep relative imports into the T240 source tree mirror the resolution
// path used by `useOrchestrator.ts`. See that file for rationale.
import type {
  OrchestrationError,
  Orchestrator,
} from '../../../../../packages/shared/src/agent/backend/orchestrator.ts'
import type {
  ProviderNonStreamingResponse,
  ProviderRequest,
} from '../../../../../packages/shared/src/agent/backend/provider-registry.ts'

/**
 * Bidirectional adapter that bridges a domain-shaped request/response
 * pair with the kernel's `ProviderRequest` /
 * `ProviderNonStreamingResponse`.
 */
export interface DomainOrchestratorAdapter<TDomainRequest, TDomainResponse> {
  /** Translate a domain request into a kernel provider request. */
  toProviderRequest(domain: TDomainRequest): ProviderRequest
  /** Translate the provider response back into the domain response. */
  fromProviderResponse(response: ProviderNonStreamingResponse): TDomainResponse
}

export interface UseDomainOrchestratorClientOptions<TDomainRequest, TDomainResponse> {
  readonly adapter: DomainOrchestratorAdapter<TDomainRequest, TDomainResponse>
  readonly orchestrator: Orchestrator
}

export interface UseDomainOrchestratorClientResult<TDomainRequest, TDomainResponse> {
  /**
   * Dispatch a domain request through the orchestrator backbone.
   *
   * Resolves with the adapted `TDomainResponse` on a successful, non-
   * streaming provider call. Rejects with a thrown
   * {@link DomainOrchestratorError} when:
   *   - the orchestrator returns a typed `OrchestrationError`
   *   - the orchestrator returns a streaming success (which this
   *     domain-shape client deliberately does not support — composer
   *     domains today are non-streaming, deterministic synthesizers).
   *
   * `lastError` is populated in both error branches.
   */
  readonly dispatch: (request: TDomainRequest) => Promise<TDomainResponse>
  /** Mirrors the inner `useOrchestrator.pending`. */
  readonly pending: boolean
  /** Mirrors the inner `useOrchestrator.lastError`. */
  readonly lastError: OrchestrationError | null
}

/**
 * Error thrown by `dispatch` when the kernel returns a typed
 * `OrchestrationError` or an unexpected stream success. The original
 * orchestration error is kept on `.cause` so callers can branch on
 * `.cause.kind`.
 */
export class DomainOrchestratorError extends Error {
  readonly cause: OrchestrationError

  constructor(cause: OrchestrationError) {
    super(`Domain orchestrator dispatch failed: ${cause.kind}`)
    this.name = 'DomainOrchestratorError'
    this.cause = cause
  }
}

/**
 * Wrap a constructed {@link Orchestrator} with a domain-shape adapter.
 *
 * The hook is a thin composition over {@link useOrchestrator}: it
 * inherits the inner hook's `pending` / `lastError` and unmount safety
 * verbatim, and adds only the request/response translation step at the
 * dispatch boundary.
 */
export function useDomainOrchestratorClient<TDomainRequest, TDomainResponse>(
  options: UseDomainOrchestratorClientOptions<TDomainRequest, TDomainResponse>,
): UseDomainOrchestratorClientResult<TDomainRequest, TDomainResponse> {
  const { adapter, orchestrator } = options
  const inner = useOrchestrator(orchestrator)

  const dispatch = useCallback(
    async (domain: TDomainRequest): Promise<TDomainResponse> => {
      // Domain → kernel. Adapter errors propagate as-is (caller decides
      // how to handle zod / shape-validation failures from their own
      // adapter). We deliberately do NOT swallow them into
      // OrchestrationError state — they are pre-dispatch wiring bugs.
      const providerRequest = adapter.toProviderRequest(domain)
      const response = await inner.dispatch({ request: providerRequest })

      if (!response.ok) {
        // Inner hook has already set `lastError`. Surface the typed
        // error to the caller too.
        throw new DomainOrchestratorError(response.error)
      }
      if (response.mode !== 'send' || response.value.kind !== 'success') {
        // Defensive: orchestrator.send() should never resolve in any
        // other shape today, but the union permits it. Map to a typed
        // RouteUnresolvedError so consumers don't see an untyped raw
        // Error escape.
        const synthetic: OrchestrationError = {
          kind: 'RouteUnresolvedError',
          reason: 'domain orchestrator received non-send orchestration response',
          candidates: [],
          attempts: [],
        }
        throw new DomainOrchestratorError(synthetic)
      }
      // Kernel → domain.
      return adapter.fromProviderResponse(response.value.response)
    },
    [adapter, inner],
  )

  return {
    dispatch,
    pending: inner.pending,
    lastError: inner.lastError,
  }
}
