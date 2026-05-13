/**
 * useOrchestrator — M.7 T242b renderer-side orchestrator React hook.
 *
 * Thin React adapter over the T240 backbone / T242 host-composed
 * `Orchestrator`. Defers ALL routing, dispatch, and streaming logic to
 * the orchestrator; owns only `pending` + `lastError` plus unmount
 * cleanup.
 *
 *   const r = useOrchestrator(orchestrator)
 *   await r.dispatch(request)                              // OrchestrationResponse (mode==='send')
 *   for await (const chunk of r.stream(request)) { ... }   // ProviderStreamEvent
 *   r.pending     // true while any dispatch / stream is in flight
 *   r.lastError   // OrchestrationError | null
 */

import { useCallback, useEffect, useRef, useState } from 'react'
// Deep relative imports into the T240 source tree: the
// `./agent/backend/*` subpaths are not yet re-exported through the
// shared package's `./agent` barrel, and editing the barrel / package
// exports is out of scope for this ticket. The relative path keeps
// vite and tsconfig happy without modifying the frozen T240 source.
import type {
  OrchestrationError,
  OrchestrationRequest,
  OrchestrationResponse,
  Orchestrator,
} from '../../../../../packages/shared/src/agent/backend/orchestrator.ts'
import type { ProviderStreamEvent } from '../../../../../packages/shared/src/agent/backend/provider-registry.ts'

/** A single chunk yielded by an orchestrator stream. */
export type OrchestrationChunk = ProviderStreamEvent

export interface UseOrchestratorResult {
  /** Non-streaming dispatch. Resolves with the full response; check `.ok`. */
  readonly dispatch: (request: OrchestrationRequest) => Promise<OrchestrationResponse>
  /** Streaming dispatch. Closes on error with `lastError` populated. */
  readonly stream: (request: OrchestrationRequest) => AsyncIterableIterator<OrchestrationChunk>
  /** True while at least one in-flight `dispatch` or `stream` is running. */
  readonly pending: boolean
  /** Most recent `OrchestrationError`; cleared at the start of each call. */
  readonly lastError: OrchestrationError | null
}

/**
 * Wrap a constructed {@link Orchestrator} with React state. The hook is
 * intentionally thin: it never inspects the registry or policy, never
 * branches on `providerId`, and never retries — that lives in the
 * orchestrator. The hook only owns the renderer lifecycle.
 */
export function useOrchestrator(orchestrator: Orchestrator): UseOrchestratorResult {
  const [pending, setPending] = useState(false)
  const [lastError, setLastError] = useState<OrchestrationError | null>(null)

  // mountedRef guards every setState; inflightRef counts overlapping
  // calls so concurrent dispatches don't race the `pending` flag.
  const mountedRef = useRef(true)
  const inflightRef = useRef(0)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const safeSetPending = useCallback((value: boolean) => {
    if (mountedRef.current) setPending(value)
  }, [])

  const safeSetError = useCallback((value: OrchestrationError | null) => {
    if (mountedRef.current) setLastError(value)
  }, [])

  const beginCall = useCallback(() => {
    inflightRef.current += 1
    safeSetPending(true)
    safeSetError(null)
  }, [safeSetError, safeSetPending])

  const endCall = useCallback(
    (error: OrchestrationError | null) => {
      inflightRef.current = Math.max(0, inflightRef.current - 1)
      if (inflightRef.current === 0) safeSetPending(false)
      if (error !== null) safeSetError(error)
    },
    [safeSetError, safeSetPending],
  )

  const dispatch = useCallback(
    async (request: OrchestrationRequest): Promise<OrchestrationResponse> => {
      beginCall()
      try {
        const response = await orchestrator.send(request)
        endCall(response.ok ? null : response.error)
        return response
      } catch (rawError: unknown) {
        // `Orchestrator.send` returns typed Results; this branch only
        // matters if a future impl throws. Synthesise a typed error so
        // React error boundaries don't see a raw Error.
        const synthetic: OrchestrationError = {
          kind: 'RouteUnresolvedError',
          reason: rawError instanceof Error ? rawError.message : 'orchestrator.send threw',
          candidates: [],
          attempts: [],
        }
        endCall(synthetic)
        throw rawError
      }
    },
    [beginCall, endCall, orchestrator],
  )

  const stream = useCallback(
    (request: OrchestrationRequest): AsyncIterableIterator<OrchestrationChunk> => {
      // Hand-rolled iterator (rather than `async function*`) so the
      // wrapper owns the begin/end bracket independently of the
      // generator's resume points.
      let started = false
      let inner: AsyncIterator<OrchestrationChunk> | null = null
      let finished = false
      const finish = (error: OrchestrationError | null): void => {
        if (finished) return
        finished = true
        endCall(error)
      }
      const closed = (): IteratorResult<OrchestrationChunk> => ({
        done: true,
        value: undefined as unknown as OrchestrationChunk,
      })

      const iterator: AsyncIterableIterator<OrchestrationChunk> = {
        [Symbol.asyncIterator](): AsyncIterableIterator<OrchestrationChunk> {
          return iterator
        },
        async next(): Promise<IteratorResult<OrchestrationChunk>> {
          if (!started) {
            started = true
            beginCall()
            const response = await orchestrator.stream(request)
            if (!response.ok) {
              finish(response.error)
              return closed()
            }
            if (response.mode !== 'stream') {
              finish({
                kind: 'RouteUnresolvedError',
                reason: 'orchestrator.stream returned non-stream success',
                candidates: [],
                attempts: [],
              })
              return closed()
            }
            inner = response.value.events[Symbol.asyncIterator]()
          }
          if (!inner) return closed()
          try {
            const step = await inner.next()
            if (step.done) finish(null)
            return step
          } catch (rawError: unknown) {
            finish({
              kind: 'ProviderUnavailableError',
              providerId: '' as never,
              reason: rawError instanceof Error ? rawError.message : 'stream iteration threw',
              attempts: [],
            })
            throw rawError
          }
        },
        async return(value?: OrchestrationChunk): Promise<IteratorResult<OrchestrationChunk>> {
          finish(null)
          if (inner && typeof inner.return === 'function') return inner.return(value)
          return { done: true, value: value as OrchestrationChunk }
        },
      }
      return iterator
    },
    [beginCall, endCall, orchestrator],
  )

  return { dispatch, stream, pending, lastError }
}
