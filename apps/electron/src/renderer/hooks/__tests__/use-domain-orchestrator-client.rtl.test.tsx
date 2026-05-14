/**
 * useDomainOrchestratorClient — RTL coverage (M.7 T242d).
 *
 * Exercises the domain-shape bridge hook against a real T240
 * `Orchestrator` wired to in-memory `ProviderHandler` fakes. The fake
 * domain adapter mimics composer's prompt-rewrite shape
 * (`{ rawText, audience }` → `{ rewritten, score }`) — the headline
 * use case from `docs/release/m7-composer-orchestrator-audit.md`.
 */

import * as React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
// Deep imports mirror `useOrchestrator.ts` resolution.
import { Orchestrator } from '../../../../../../packages/shared/src/agent/backend/orchestrator.ts'
import {
  ProviderRegistry,
  type ProviderHandler,
  type ProviderNonStreamingResponse,
  type ProviderRequest,
  type ProviderStreamEvent,
} from '../../../../../../packages/shared/src/agent/backend/provider-registry.ts'
import { unsafeProviderId } from '../../../../../../packages/shared/src/agent/backend/provider-id.ts'
import { createRoundRobinPolicy } from '../../../../../../packages/shared/src/agent/backend/routing-policy.ts'
import {
  DomainOrchestratorError,
  useDomainOrchestratorClient,
  type DomainOrchestratorAdapter,
} from '../useDomainOrchestratorClient'

afterEach(cleanup)

const PROVIDER = unsafeProviderId('anthropic')

// Local domain shape (fixture stays runtime-validation-free).
interface DomainRequest {
  readonly rawText: string
  readonly audience: 'engineer' | 'pm'
}

interface DomainResponse {
  readonly rewritten: string
  readonly score: number
}

const adapter: DomainOrchestratorAdapter<DomainRequest, DomainResponse> = {
  toProviderRequest(domain: DomainRequest): ProviderRequest {
    return {
      model: 'rewriter-v1',
      messages: [
        { role: 'system', content: `audience=${domain.audience}` },
        { role: 'user', content: domain.rawText },
      ],
    }
  },
  fromProviderResponse(response: ProviderNonStreamingResponse): DomainResponse {
    // Fake provider convention: `text` is `<rewritten>|<score>`.
    const [rewritten = '', rawScore = '0'] = response.text.split('|', 2)
    return { rewritten, score: Number(rawScore) }
  },
}

interface FakeHandlerOptions {
  readonly send?: (req: ProviderRequest) => Promise<ProviderNonStreamingResponse>
  readonly sendError?: Error
}

function makeHandler(opts: FakeHandlerOptions = {}): ProviderHandler {
  return {
    id: PROVIDER,
    healthy: () => true,
    async send(req: ProviderRequest): Promise<ProviderNonStreamingResponse> {
      if (opts.sendError) throw opts.sendError
      if (opts.send) return opts.send(req)
      return { text: 'tidied|0.7' }
    },
    stream(_req: ProviderRequest): AsyncIterable<ProviderStreamEvent> {
      return { async *[Symbol.asyncIterator]() {} }
    },
  }
}

function makeOrchestrator(handler: ProviderHandler): Orchestrator {
  const registry = new ProviderRegistry()
  registry.register(handler)
  return new Orchestrator({ registry, policy: createRoundRobinPolicy() })
}

describe('useDomainOrchestratorClient', () => {
  it('adapter transforms domain request → provider request → provider response → domain response', async () => {
    let observed: ProviderRequest | null = null
    const orchestrator = makeOrchestrator(
      makeHandler({
        async send(req): Promise<ProviderNonStreamingResponse> {
          observed = req
          return { text: 'cleaner version|0.92' }
        },
      }),
    )

    const { result } = renderHook(() => useDomainOrchestratorClient({ adapter, orchestrator }))

    let response: DomainResponse | null = null
    await act(async () => {
      response = await result.current.dispatch({ rawText: 'fix this', audience: 'engineer' })
    })

    // Provider received the adapted kernel request.
    expect(observed).not.toBeNull()
    expect(observed!.model).toBe('rewriter-v1')
    expect(observed!.messages[0]).toEqual({ role: 'system', content: 'audience=engineer' })
    expect(observed!.messages[1]).toEqual({ role: 'user', content: 'fix this' })

    // Caller received the adapted domain response.
    expect(response).toEqual({ rewritten: 'cleaner version', score: 0.92 })

    // No error.
    expect(result.current.lastError).toBeNull()
    expect(result.current.pending).toBe(false)
  })

  it('error path: orchestrator failure surfaces a DomainOrchestratorError and populates lastError', async () => {
    const handler = makeHandler({ sendError: new Error('provider down') })
    const orchestrator = makeOrchestrator(handler)
    const { result } = renderHook(() => useDomainOrchestratorClient({ adapter, orchestrator }))

    let thrown: unknown = null
    await act(async () => {
      try {
        await result.current.dispatch({ rawText: 'x', audience: 'pm' })
      } catch (err) {
        thrown = err
      }
    })

    expect(thrown).toBeInstanceOf(DomainOrchestratorError)
    const err = thrown as DomainOrchestratorError
    expect(err.cause.kind).toBe('ProviderUnavailableError')
    expect(result.current.lastError).not.toBeNull()
    expect(result.current.lastError?.kind).toBe('ProviderUnavailableError')
    expect(result.current.pending).toBe(false)
  })

  it('pending toggles true while in flight and false on resolve', async () => {
    let release: (() => void) | null = null
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const orchestrator = makeOrchestrator(
      makeHandler({
        async send(): Promise<ProviderNonStreamingResponse> {
          await hold
          return { text: 'late|1' }
        },
      }),
    )
    const { result } = renderHook(() => useDomainOrchestratorClient({ adapter, orchestrator }))

    expect(result.current.pending).toBe(false)

    let pendingPromise: Promise<DomainResponse> | null = null
    act(() => {
      pendingPromise = result.current.dispatch({ rawText: 'slow', audience: 'engineer' })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.pending).toBe(true)

    await act(async () => {
      release?.()
      await pendingPromise
    })
    expect(result.current.pending).toBe(false)
  })

  it('adapter errors on input propagate to the caller without populating orchestrator lastError', async () => {
    const orchestrator = makeOrchestrator(makeHandler())
    const failingAdapter: DomainOrchestratorAdapter<DomainRequest, DomainResponse> = {
      toProviderRequest(): ProviderRequest {
        throw new Error('adapter input rejected')
      },
      fromProviderResponse: adapter.fromProviderResponse,
    }
    const { result } = renderHook(() =>
      useDomainOrchestratorClient({ adapter: failingAdapter, orchestrator }),
    )

    let thrown: unknown = null
    await act(async () => {
      try {
        await result.current.dispatch({ rawText: 'oops', audience: 'engineer' })
      } catch (err) {
        thrown = err
      }
    })

    // Pre-dispatch adapter bugs are NOT orchestration errors — they
    // surface raw so caller's own error boundary handles them.
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('adapter input rejected')
    expect(result.current.lastError).toBeNull()
    expect(result.current.pending).toBe(false)
  })

  it('adapter errors on output propagate after a successful provider call', async () => {
    const orchestrator = makeOrchestrator(makeHandler())
    const failingAdapter: DomainOrchestratorAdapter<DomainRequest, DomainResponse> = {
      toProviderRequest: adapter.toProviderRequest,
      fromProviderResponse(): DomainResponse {
        throw new Error('output schema rejected')
      },
    }
    const { result } = renderHook(() =>
      useDomainOrchestratorClient({ adapter: failingAdapter, orchestrator }),
    )

    let thrown: unknown = null
    await act(async () => {
      try {
        await result.current.dispatch({ rawText: 'ok', audience: 'pm' })
      } catch (err) {
        thrown = err
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('output schema rejected')
    // Orchestrator itself succeeded — lastError stays clean.
    expect(result.current.lastError).toBeNull()
    expect(result.current.pending).toBe(false)
  })

  it('subsequent successful dispatch clears the previous lastError', async () => {
    let failNext = true
    const orchestrator = makeOrchestrator(
      makeHandler({
        async send(): Promise<ProviderNonStreamingResponse> {
          if (failNext) {
            failNext = false
            throw new Error('transient')
          }
          return { text: 'recovered|0.5' }
        },
      }),
    )
    const { result } = renderHook(() => useDomainOrchestratorClient({ adapter, orchestrator }))

    await act(async () => {
      try {
        await result.current.dispatch({ rawText: 'first', audience: 'engineer' })
      } catch {
        // swallow — first call is expected to fail
      }
    })
    expect(result.current.lastError).not.toBeNull()

    let recovered: DomainResponse | null = null
    await act(async () => {
      recovered = await result.current.dispatch({ rawText: 'second', audience: 'engineer' })
    })

    expect(recovered).toEqual({ rewritten: 'recovered', score: 0.5 })
    expect(result.current.lastError).toBeNull()
    expect(result.current.pending).toBe(false)
  })

  it('two consecutive dispatches each transform independently', async () => {
    const captured: ProviderRequest[] = []
    const responses = ['first|0.1', 'second|0.9']
    const orchestrator = makeOrchestrator(
      makeHandler({
        async send(req): Promise<ProviderNonStreamingResponse> {
          captured.push(req)
          return { text: responses.shift() ?? 'last|0' }
        },
      }),
    )
    const { result } = renderHook(() => useDomainOrchestratorClient({ adapter, orchestrator }))

    let r1: DomainResponse | null = null
    let r2: DomainResponse | null = null
    await act(async () => {
      r1 = await result.current.dispatch({ rawText: 'one', audience: 'engineer' })
      r2 = await result.current.dispatch({ rawText: 'two', audience: 'pm' })
    })

    expect(captured).toHaveLength(2)
    expect(captured[0]?.messages[1]).toEqual({ role: 'user', content: 'one' })
    expect(captured[1]?.messages[1]).toEqual({ role: 'user', content: 'two' })
    expect(captured[0]?.messages[0]).toEqual({ role: 'system', content: 'audience=engineer' })
    expect(captured[1]?.messages[0]).toEqual({ role: 'system', content: 'audience=pm' })

    expect(r1).toEqual({ rewritten: 'first', score: 0.1 })
    expect(r2).toEqual({ rewritten: 'second', score: 0.9 })
  })
})

// Keep happy-dom's JSX runtime initialised (matches sibling RTL specs).
void React
