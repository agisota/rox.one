/**
 * useExperience — Experience Layer renderer hook adapter (M.9 T271).
 *
 * Thin React adapter over the T270 kernel. Defers ALL state-machine logic
 * to the pure reducer; owns only the subscription lifecycle and the
 * React-side wrapping for dispatch / mutate.
 *
 *   const r = useExperience(initial, source$, runMutation, options?)
 *   r.state           // ExperienceState<T>
 *   r.dispatch(event) // raw escape hatch (reset, fail, etc.)
 *   r.mutate(input)   // brackets runMutation with Mutate + Succeeded/Failed
 *   r.isReady, r.isLoading, r.isError, r.isMutating, r.isIdle
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  fail as failEvt,
  load as loadEvt,
  loaded as loadedEvt,
  mutate as mutateEvt,
  mutationFailed as mutationFailedEvt,
  mutationSucceeded as mutationSucceededEvt,
  reducer,
  type ExperienceEvent,
  type ExperienceError,
  type ExperienceState,
  type Observable,
  type TransitionError,
} from '@rox-one/shared/experience-layer'

export type UseExperienceMutator<T, MIn> = (
  input: MIn,
  ctx: { mutationId: string },
) => Promise<T>

export interface UseExperienceOptions {
  readonly now?: () => number
  readonly newMutationId?: () => string
  readonly onTransitionError?: (error: TransitionError) => void
  /** When true (default), auto-dispatches `Load` on mount. */
  readonly autoLoad?: boolean
}

export interface UseExperienceResult<T, MIn> {
  readonly state: ExperienceState<T>
  readonly dispatch: (event: ExperienceEvent<T>) => void
  readonly mutate: (input: MIn) => Promise<void>
  readonly isIdle: boolean
  readonly isLoading: boolean
  readonly isReady: boolean
  readonly isError: boolean
  readonly isMutating: boolean
}

let monotonicMutationCounter = 0
const defaultMutationId = (): string => {
  monotonicMutationCounter += 1
  return `m-${monotonicMutationCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function toExperienceError(
  kind: ExperienceError['kind'],
  cause: unknown,
  at: number,
): ExperienceError {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown'
  return { kind, message, cause, at }
}

type ReducerCtx<T> = { reportError(error: TransitionError): void }

function makeHookReducer<T>(ctx: ReducerCtx<T>) {
  return function hookReducer(
    state: ExperienceState<T>,
    event: ExperienceEvent<T>,
  ): ExperienceState<T> {
    const result = reducer<T>(state, event)
    if (!result.ok) {
      ctx.reportError(result.error)
      return state
    }
    return result.value
  }
}

export function useExperience<T, MIn = unknown>(
  initial: ExperienceState<T>,
  source$: Observable<T>,
  runMutation: UseExperienceMutator<T, MIn>,
  options?: UseExperienceOptions,
): UseExperienceResult<T, MIn> {
  const now = options?.now ?? Date.now
  const newMutationId = options?.newMutationId ?? defaultMutationId
  const autoLoad = options?.autoLoad !== false

  // Refs hold callbacks/runners so useEffect doesn't re-bind on every render.
  const onTransitionErrorRef = useRef(options?.onTransitionError)
  onTransitionErrorRef.current = options?.onTransitionError
  const runMutationRef = useRef(runMutation)
  runMutationRef.current = runMutation
  const nowRef = useRef(now)
  nowRef.current = now
  const newMutationIdRef = useRef(newMutationId)
  newMutationIdRef.current = newMutationId

  const reducerCtx = useMemo<ReducerCtx<T>>(
    () => ({
      reportError(error) {
        onTransitionErrorRef.current?.(error)
      },
    }),
    [],
  )
  const hookReducer = useMemo(() => makeHookReducer<T>(reducerCtx), [reducerCtx])
  const [state, dispatch] = useReducer(hookReducer, initial)

  const stateRef = useRef(state)
  stateRef.current = state
  const disposedRef = useRef(false)

  useEffect(() => {
    disposedRef.current = false
    if (autoLoad) dispatch(loadEvt(initial.id, nowRef.current()))
    const unsub = source$.subscribe({
      next: (value) => {
        if (!disposedRef.current) dispatch(loadedEvt<T>(stateRef.current.id, value))
      },
      error: (err) => {
        if (disposedRef.current) return
        dispatch(failEvt(stateRef.current.id, toExperienceError('load-failed', err, nowRef.current())))
      },
    })
    return () => {
      disposedRef.current = true
      try { unsub() } catch { /* unsubscription must not throw */ }
    }
    // We intentionally pin to source$ identity. Re-subscribing on every render
    // would break observable semantics; initial.id is captured for autoLoad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source$])

  const mutate = useCallback(async (input: MIn): Promise<void> => {
    if (disposedRef.current) return
    const mutationId = newMutationIdRef.current()
    const id = stateRef.current.id
    dispatch(mutateEvt(id, mutationId, nowRef.current()))
    try {
      const next = await runMutationRef.current(input, { mutationId })
      if (!disposedRef.current) dispatch(mutationSucceededEvt<T>(id, mutationId, next))
    } catch (err) {
      if (disposedRef.current) return
      dispatch(mutationFailedEvt(
        id, mutationId,
        toExperienceError('mutation-failed', err, nowRef.current()),
        true,
      ))
    }
  }, [])

  return {
    state,
    dispatch,
    mutate,
    isIdle: state.kind === 'idle',
    isLoading: state.kind === 'loading',
    isReady: state.kind === 'ready',
    isError: state.kind === 'error',
    isMutating: state.kind === 'mutating',
  }
}
