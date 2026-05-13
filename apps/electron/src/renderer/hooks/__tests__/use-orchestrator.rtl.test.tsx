/**
 * useOrchestrator — RTL coverage (M.7 T242b).
 *
 * Exercises the renderer hook against a real T240 `Orchestrator` wired
 * to in-memory `ProviderHandler` fakes — dispatch happy path, streaming
 * chunks → completion, error surfaces, unmount cleanup, pending-flag
 * counter, and iterator early-return cleanup.
 */

import * as React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
// Deep-imports into the T240 source tree mirror the resolution path used
// by the hook itself — see `../useOrchestrator.ts` for the rationale.
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
import { useOrchestrator } from '../useOrchestrator'

afterEach(cleanup)

const PROVIDER = unsafeProviderId('anthropic')

const REQUEST: ProviderRequest = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hello' }],
}

interface FakeHandlerOptions {
  readonly sendError?: Error
  readonly streamError?: Error
}

const DEFAULT_EVENTS: readonly ProviderStreamEvent[] = [
  { kind: 'chunk', delta: 'hel', index: 0 },
  { kind: 'chunk', delta: 'lo', index: 1 },
  { kind: 'end', reason: 'stop' },
]

function makeHandler(opts: FakeHandlerOptions = {}): ProviderHandler {
  return {
    id: PROVIDER,
    healthy: () => true,
    async send(_req: ProviderRequest): Promise<ProviderNonStreamingResponse> {
      if (opts.sendError) throw opts.sendError
      return { text: 'ok', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    },
    stream(_req: ProviderRequest): AsyncIterable<ProviderStreamEvent> {
      const streamError = opts.streamError
      return {
        async *[Symbol.asyncIterator](): AsyncIterator<ProviderStreamEvent> {
          if (streamError) throw streamError
          for (const evt of DEFAULT_EVENTS) yield evt
        },
      }
    },
  }
}

function makeOrchestrator(handler: ProviderHandler): Orchestrator {
  const registry = new ProviderRegistry()
  registry.register(handler)
  return new Orchestrator({ registry, policy: createRoundRobinPolicy() })
}

describe('useOrchestrator', () => {
  it('dispatch resolves with a success response on happy path', async () => {
    const orchestrator = makeOrchestrator(makeHandler())
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    expect(result.current.pending).toBe(false)
    expect(result.current.lastError).toBeNull()

    let response: Awaited<ReturnType<typeof result.current.dispatch>> | null = null
    await act(async () => {
      response = await result.current.dispatch({ request: REQUEST })
    })

    expect(response).not.toBeNull()
    const settled = response!
    expect(settled.mode).toBe('send')
    expect(settled.ok).toBe(true)
    if (settled.ok) {
      expect(settled.value.kind).toBe('success')
      if (settled.value.kind === 'success') {
        expect(settled.value.response.text).toBe('ok')
        expect(settled.value.providerId).toBe(PROVIDER)
      }
    }
    expect(result.current.pending).toBe(false)
    expect(result.current.lastError).toBeNull()
  })

  it('dispatch sets lastError when the orchestrator returns an error result', async () => {
    const handler = makeHandler({ sendError: new Error('boom — provider unreachable') })
    const orchestrator = makeOrchestrator(handler)
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    let response: Awaited<ReturnType<typeof result.current.dispatch>> | null = null
    await act(async () => {
      response = await result.current.dispatch({ request: REQUEST })
    })

    expect(response).not.toBeNull()
    expect(response!.ok).toBe(false)
    expect(result.current.pending).toBe(false)
    expect(result.current.lastError).not.toBeNull()
    expect(result.current.lastError?.kind).toBe('ProviderUnavailableError')
  })

  it('dispatch toggles pending true while in flight and false on resolve', async () => {
    let release: (() => void) | null = null
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const handler: ProviderHandler = {
      id: PROVIDER,
      healthy: () => true,
      async send(): Promise<ProviderNonStreamingResponse> {
        await hold
        return { text: 'late' }
      },
      stream(): AsyncIterable<ProviderStreamEvent> {
        return { async *[Symbol.asyncIterator]() {} }
      },
    }
    const orchestrator = makeOrchestrator(handler)
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    let pendingPromise: Promise<unknown> | null = null
    act(() => {
      pendingPromise = result.current.dispatch({ request: REQUEST })
    })
    // Allow the pending-true setState to flush.
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

  it('stream yields all chunks and then completes', async () => {
    const orchestrator = makeOrchestrator(makeHandler())
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    const collected: ProviderStreamEvent[] = []
    await act(async () => {
      for await (const chunk of result.current.stream({ request: REQUEST })) {
        collected.push(chunk)
      }
    })

    expect(collected).toHaveLength(3)
    expect(collected[0]).toEqual({ kind: 'chunk', delta: 'hel', index: 0 })
    expect(collected[1]).toEqual({ kind: 'chunk', delta: 'lo', index: 1 })
    expect(collected[2]).toEqual({ kind: 'end', reason: 'stop' })
    expect(result.current.pending).toBe(false)
    expect(result.current.lastError).toBeNull()
  })

  it('stream surfaces an OrchestrationError when the provider cannot open the stream', async () => {
    const handler = makeHandler({ streamError: new Error('provider unavailable') })
    const orchestrator = makeOrchestrator(handler)
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    const collected: ProviderStreamEvent[] = []
    await act(async () => {
      for await (const chunk of result.current.stream({ request: REQUEST })) {
        collected.push(chunk)
      }
    })

    expect(collected).toHaveLength(0)
    expect(result.current.pending).toBe(false)
    expect(result.current.lastError).not.toBeNull()
    expect(result.current.lastError?.kind).toBe('ProviderUnavailableError')
  })

  it('stream iterator return() cleans up pending state without consuming all chunks', async () => {
    const orchestrator = makeOrchestrator(makeHandler())
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    await act(async () => {
      const it = result.current.stream({ request: REQUEST })
      const first = await it.next()
      expect(first.done).toBe(false)
      // Abort early — should clear pending and not throw.
      await it.return?.()
    })

    expect(result.current.pending).toBe(false)
    expect(result.current.lastError).toBeNull()
  })

  it('does not update state after unmount', async () => {
    const releaseRef: { fn: (() => void) | null } = { fn: null }
    const hold = new Promise<void>((resolve) => {
      releaseRef.fn = resolve
    })
    const handler: ProviderHandler = {
      id: PROVIDER,
      healthy: () => true,
      async send(): Promise<ProviderNonStreamingResponse> {
        await hold
        return { text: 'too-late' }
      },
      stream(): AsyncIterable<ProviderStreamEvent> {
        return { async *[Symbol.asyncIterator]() {} }
      },
    }
    const orchestrator = makeOrchestrator(handler)
    const { result, unmount } = renderHook(() => useOrchestrator(orchestrator))

    let pendingPromise: Promise<unknown> | null = null
    act(() => {
      pendingPromise = result.current.dispatch({ request: REQUEST })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.pending).toBe(true)

    // Unmount mid-flight; expect no React "setState on unmounted" warnings
    // and the snapshot's last-known `pending` stays true (because the
    // hook can no longer update it).
    unmount()
    await expect(
      (async () => {
        releaseRef.fn?.()
        await pendingPromise
      })(),
    ).resolves.toBeUndefined()
  })

  it('concurrent dispatches share the pending flag until both settle', async () => {
    const releases: Array<() => void> = []
    const handler: ProviderHandler = {
      id: PROVIDER,
      healthy: () => true,
      async send(): Promise<ProviderNonStreamingResponse> {
        await new Promise<void>((resolve) => releases.push(resolve))
        return { text: 'done' }
      },
      stream(): AsyncIterable<ProviderStreamEvent> {
        return { async *[Symbol.asyncIterator]() {} }
      },
    }
    const orchestrator = makeOrchestrator(handler)
    const { result } = renderHook(() => useOrchestrator(orchestrator))

    let p1: Promise<unknown> | null = null
    let p2: Promise<unknown> | null = null
    act(() => {
      p1 = result.current.dispatch({ request: REQUEST })
      p2 = result.current.dispatch({ request: REQUEST })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.pending).toBe(true)

    await act(async () => {
      releases[0]?.()
      await p1
    })
    expect(result.current.pending).toBe(true)

    await act(async () => {
      releases[1]?.()
      await p2
    })
    expect(result.current.pending).toBe(false)
  })
})

// Keep happy-dom's JSX runtime initialised even though this file uses
// no JSX — matches the sibling RTL specs in this folder.
void React
