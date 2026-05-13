/**
 * Experience Bind — M.9 T270.
 *
 * Tiny adapter that wires a *minimal* `Observable<T>` to the kernel's pure
 * reducer. We deliberately do not depend on rxjs; the local
 * {@link Observable} shape is the smallest contract that lets a host source
 * notify the kernel of fresh snapshots, and an optional `error` channel lets
 * adapters surface load failures without crashing.
 *
 *   type Observable<T> = { subscribe(observer): () => void }
 *
 * Callers also supply an async `mutate(input) -> Promise<U>` which the bind
 * runs against the reducer's mutation lifecycle: `Mutate` → either
 * `MutationSucceeded` or `MutationFailed`.
 *
 * The bind is the *only* place in the kernel that produces wall-clock
 * timestamps; everything below it is pure.
 */

import type { ExperienceEvent } from './experience-event.ts';
import {
  fail as failEvt,
  load,
  loaded,
  mutate as mutateEvt,
  mutationFailed,
  mutationSucceeded,
  reset,
} from './experience-event.ts';
import type { ExperienceId } from './experience-id.ts';
import { reducer, type TransitionError } from './experience-reducer.ts';
import type { ExperienceError, ExperienceState } from './experience-state.ts';

export type Unsubscribe = () => void;

export interface Observer<T> {
  next(value: T): void;
  error?(err: unknown): void;
  complete?(): void;
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): Unsubscribe;
}

export interface BindOptions<T, MIn> {
  /** Initial reducer state (typically `idle(id)` or a seeded `ready(...)`). */
  readonly initialState: ExperienceState<T>;
  /** Source emitting fresh snapshots; bind subscribes lazily on first start(). */
  readonly source$: Observable<T>;
  /**
   * Mutation runner. Resolves with the new snapshot on success; rejects to
   * trigger `MutationFailed`. Receives a mutation id so adapters can
   * correlate retries.
   */
  readonly mutate: (
    input: MIn,
    ctx: { mutationId: string; id: ExperienceId },
  ) => Promise<T>;
  /** Wall-clock provider (injectable for tests). Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Random source for mutation ids (injectable for tests). */
  readonly newMutationId?: () => string;
  /**
   * Optional sink that observes every typed `TransitionError` the reducer
   * produces. Useful in tests and for instrumentation. The bind itself
   * silently ignores illegal transitions — it just doesn't update state.
   */
  readonly onTransitionError?: (error: TransitionError) => void;
}

export interface BoundExperience<T, MIn> {
  /** Snapshot the current reducer state. */
  getState(): ExperienceState<T>;
  /** Subscribe to state changes; returns an unsubscribe handle. */
  subscribe(listener: (state: ExperienceState<T>) => void): Unsubscribe;
  /** Trigger a load: dispatches `Load`, subscribes to `source$` lazily. */
  start(): void;
  /** Dispatch a mutation; resolves with the *next* state for convenience. */
  mutate(input: MIn): Promise<ExperienceState<T>>;
  /** Manually reset back to `idle`. */
  reset(): void;
  /** Dispose: unsubscribes from `source$`, clears listeners. Idempotent. */
  dispose(): void;
}

let monotonicMutationCounter = 0;
function defaultMutationId(): string {
  monotonicMutationCounter += 1;
  return `m-${monotonicMutationCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toExperienceError(
  kind: ExperienceError['kind'],
  cause: unknown,
  at: number,
): ExperienceError {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : 'unknown';
  return { kind, message, cause, at };
}

export function bindExperience<T, MIn = unknown>(
  options: BindOptions<T, MIn>,
): BoundExperience<T, MIn> {
  const now = options.now ?? Date.now;
  const newMutationId = options.newMutationId ?? defaultMutationId;

  let state: ExperienceState<T> = options.initialState;
  const listeners = new Set<(state: ExperienceState<T>) => void>();
  let sourceUnsub: Unsubscribe | null = null;
  let disposed = false;

  function dispatch(event: ExperienceEvent<T>): ExperienceState<T> {
    const result = reducer<T>(state, event);
    if (!result.ok) {
      options.onTransitionError?.(result.error);
      return state;
    }
    state = result.value;
    for (const listener of listeners) listener(state);
    return state;
  }

  function ensureSourceSubscribed(): void {
    if (sourceUnsub || disposed) return;
    sourceUnsub = options.source$.subscribe({
      next(value) {
        if (disposed) return;
        dispatch(loaded<T>(state.id, value));
      },
      error(err) {
        if (disposed) return;
        dispatch(failEvt<T>(state.id, toExperienceError('load-failed', err, now())));
      },
    });
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (disposed) return;
      dispatch(load<T>(state.id, now()));
      ensureSourceSubscribed();
    },
    async mutate(input) {
      if (disposed) return state;
      const mutationId = newMutationId();
      const stateId = state.id;
      dispatch(mutateEvt<T>(stateId, mutationId, now()));
      try {
        const next = await options.mutate(input, { mutationId, id: stateId });
        if (disposed) return state;
        dispatch(mutationSucceeded<T>(stateId, mutationId, next));
      } catch (err) {
        if (disposed) return state;
        dispatch(
          mutationFailed(
            stateId,
            mutationId,
            toExperienceError('mutation-failed', err, now()),
            true,
          ),
        );
      }
      return state;
    },
    reset() {
      if (disposed) return;
      dispatch(reset<T>(state.id));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (sourceUnsub) {
        try {
          sourceUnsub();
        } catch {
          /* swallow — disposal must not throw */
        }
        sourceUnsub = null;
      }
      listeners.clear();
    },
  };
}

/**
 * Tiny in-memory subject helper for tests and adapters that need a
 * push-based source without pulling in rxjs.
 */
export function createSubject<T>(): Observable<T> & {
  next(value: T): void;
  error(err: unknown): void;
  complete(): void;
} {
  const observers = new Set<Observer<T>>();
  return {
    subscribe(observer) {
      observers.add(observer);
      return () => observers.delete(observer);
    },
    next(value) {
      for (const o of observers) o.next(value);
    },
    error(err) {
      for (const o of observers) o.error?.(err);
    },
    complete() {
      for (const o of observers) o.complete?.();
      observers.clear();
    },
  };
}
