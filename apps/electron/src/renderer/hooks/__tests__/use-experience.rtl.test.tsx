/**
 * useExperience — RTL coverage (M.9 T271).
 *
 * Exercises the renderer hook against the T270 kernel: subscription
 * lifecycle, reducer transitions, dispatcher escape hatch, unmount cleanup,
 * illegal-transition reporting, and mutation success/failure brackets.
 * Uses the kernel's `createSubject` helper instead of rxjs.
 */

import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import {
  createSubject,
  idle,
  reset as resetEvt,
  unsafeExperienceId,
  type ExperienceState,
  type TransitionError,
} from '@rox-one/shared/experience-layer'
import { useExperience, type UseExperienceMutator } from '../useExperience'

afterEach(cleanup)

const EXP_ID = unsafeExperienceId('01890000-0000-7000-8000-000000000001')
const OTHER_ID = unsafeExperienceId('01890000-0000-7000-8000-000000000002')

type Payload = { value: number }

const makeInitial = (): ExperienceState<Payload> => idle(EXP_ID)

const makeMutator = (
  impl?: (input: Payload) => Promise<Payload>,
): UseExperienceMutator<Payload, Payload> => (input) =>
  impl ? impl(input) : Promise.resolve(input)

const makeOpts = () => {
  let clock = 1_000
  const ids = ['mut-a', 'mut-b', 'mut-c']
  let idx = 0
  return {
    now: () => (clock += 1),
    newMutationId: () => ids[idx++] ?? `mut-${idx}`,
  }
}

describe('useExperience', () => {
  it('starts from the supplied initial state when autoLoad is disabled', () => {
    const subject = createSubject<Payload>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), {
        ...makeOpts(),
        autoLoad: false,
      }),
    )
    expect(result.current.state.kind).toBe('idle')
    expect(result.current.isIdle).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isReady).toBe(false)
  })

  it('auto-dispatches Load on mount by default', () => {
    const subject = createSubject<Payload>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), makeOpts()),
    )
    expect(result.current.state.kind).toBe('loading')
    expect(result.current.isLoading).toBe(true)
  })

  it('transitions Loading → Ready when the source emits a value', () => {
    const subject = createSubject<Payload>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), makeOpts()),
    )
    act(() => { subject.next({ value: 42 }) })

    expect(result.current.state.kind).toBe('ready')
    expect(result.current.isReady).toBe(true)
    if (result.current.state.kind === 'ready') {
      expect(result.current.state.data.value).toBe(42)
      expect(result.current.state.version).toBe(1)
    }
  })

  it('bumps version on subsequent Ready emissions', () => {
    const subject = createSubject<Payload>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), makeOpts()),
    )
    act(() => { subject.next({ value: 1 }) })
    act(() => { subject.next({ value: 2 }) })

    expect(result.current.state.kind).toBe('ready')
    if (result.current.state.kind === 'ready') {
      expect(result.current.state.data.value).toBe(2)
      expect(result.current.state.version).toBe(2)
    }
  })

  it('transitions to Error when the source errors', () => {
    const subject = createSubject<Payload>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), makeOpts()),
    )
    act(() => { subject.error(new Error('boom')) })

    expect(result.current.state.kind).toBe('error')
    expect(result.current.isError).toBe(true)
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('load-failed')
      expect(result.current.state.error.message).toBe('boom')
    }
  })

  it('mutate() dispatches Mutate then MutationSucceeded on resolution', async () => {
    const subject = createSubject<Payload>()
    const runner = makeMutator(async (input) => ({ value: input.value + 100 }))
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, runner, makeOpts()),
    )
    act(() => { subject.next({ value: 1 }) })
    expect(result.current.state.kind).toBe('ready')

    await act(async () => { await result.current.mutate({ value: 5 }) })

    expect(result.current.state.kind).toBe('ready')
    if (result.current.state.kind === 'ready') {
      expect(result.current.state.data.value).toBe(105)
      expect(result.current.state.version).toBe(2)
    }
  })

  it('mutate() recovers to Ready at baseVersion when the runner rejects', async () => {
    const subject = createSubject<Payload>()
    const runner = makeMutator(() => Promise.reject(new Error('write-conflict')))
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, runner, makeOpts()),
    )
    act(() => { subject.next({ value: 7 }) })
    expect(result.current.state.kind).toBe('ready')

    await act(async () => { await result.current.mutate({ value: 9 }) })

    expect(result.current.state.kind).toBe('ready')
    if (result.current.state.kind === 'ready') {
      expect(result.current.state.data.value).toBe(7)
      expect(result.current.state.version).toBe(1)
    }
  })

  it('observes Mutating between Mutate and resolution', async () => {
    const subject = createSubject<Payload>()
    let resolveRunner: ((v: Payload) => void) | null = null
    const runner: UseExperienceMutator<Payload, Payload> = () =>
      new Promise<Payload>((resolve) => { resolveRunner = resolve })
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, runner, makeOpts()),
    )
    act(() => { subject.next({ value: 1 }) })

    let mutatePromise: Promise<void> | null = null
    act(() => { mutatePromise = result.current.mutate({ value: 99 }) })
    expect(result.current.state.kind).toBe('mutating')
    expect(result.current.isMutating).toBe(true)
    if (result.current.state.kind === 'mutating') {
      expect(result.current.state.data.value).toBe(1)
      expect(result.current.state.baseVersion).toBe(1)
    }

    await act(async () => {
      resolveRunner?.({ value: 200 })
      await mutatePromise
    })
    expect(result.current.state.kind).toBe('ready')
    if (result.current.state.kind === 'ready') {
      expect(result.current.state.data.value).toBe(200)
    }
  })

  it('dispatch escape hatch resets the experience back to idle', () => {
    const subject = createSubject<Payload>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), makeOpts()),
    )
    act(() => { subject.next({ value: 1 }) })
    expect(result.current.state.kind).toBe('ready')

    act(() => { result.current.dispatch(resetEvt(EXP_ID)) })
    expect(result.current.state.kind).toBe('idle')
    expect(result.current.isIdle).toBe(true)
  })

  it('forwards illegal transitions to onTransitionError without crashing', () => {
    const subject = createSubject<Payload>()
    const onTransitionError = vi.fn<(e: TransitionError) => void>()
    const { result } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), {
        ...makeOpts(),
        onTransitionError,
      }),
    )
    act(() => { subject.next({ value: 1 }) })
    act(() => {
      result.current.dispatch({ kind: 'mutate', id: OTHER_ID, mutationId: 'x', at: 0 })
    })

    expect(onTransitionError).toHaveBeenCalled()
    expect(onTransitionError.mock.calls[0]?.[0]?.kind).toBe('MismatchedId')
    expect(result.current.state.kind).toBe('ready')
  })

  it('unsubscribes from the source on unmount', () => {
    const subject = createSubject<Payload>()
    const { result, unmount } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, makeMutator(), makeOpts()),
    )
    act(() => { subject.next({ value: 1 }) })
    expect(result.current.state.kind).toBe('ready')

    unmount()
    expect(() => subject.next({ value: 999 })).not.toThrow()
  })

  it('does not dispatch post-resolution if unmounted mid-mutation', async () => {
    const subject = createSubject<Payload>()
    let resolveRunner: ((v: Payload) => void) | null = null
    const runner: UseExperienceMutator<Payload, Payload> = () =>
      new Promise<Payload>((resolve) => { resolveRunner = resolve })
    const onTransitionError = vi.fn()
    const { result, unmount } = renderHook(() =>
      useExperience<Payload, Payload>(makeInitial(), subject, runner, {
        ...makeOpts(),
        onTransitionError,
      }),
    )
    act(() => { subject.next({ value: 1 }) })

    let mutatePromise: Promise<void> | null = null
    act(() => { mutatePromise = result.current.mutate({ value: 5 }) })
    expect(result.current.state.kind).toBe('mutating')

    unmount()

    await act(async () => {
      resolveRunner?.({ value: 99 })
      await mutatePromise
    })
    expect(onTransitionError).not.toHaveBeenCalled()
  })
})

// Ensures the JSX runtime is initialised under happy-dom.
void React
