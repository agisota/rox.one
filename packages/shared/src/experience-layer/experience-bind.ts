/**
 * Experience Bind — M.9 T270.
 *
 * Adapter wiring a *minimal* `Observable<T> = { subscribe(o): () => void }`
 * and an async `mutate(input)` runner to the pure reducer. No rxjs.
 *
 * The bind is the only kernel module that touches wall-clock / randomness;
 * both are injectable via `now` and `newMutationId`. Illegal reducer
 * transitions surface through `onTransitionError` and never throw.
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
  readonly initialState: ExperienceState<T>;
  readonly source$: Observable<T>;
  /** Reject to trigger `MutationFailed`. */
  readonly mutate: (input: MIn, ctx: { mutationId: string; id: ExperienceId }) => Promise<T>;
  /** Defaults to `Date.now`. */
  readonly now?: () => number;
  readonly newMutationId?: () => string;
  readonly onTransitionError?: (error: TransitionError) => void;
}

export interface BoundExperience<T, MIn> {
  getState(): ExperienceState<T>;
  subscribe(listener: (state: ExperienceState<T>) => void): Unsubscribe;
  start(): void;
  mutate(input: MIn): Promise<ExperienceState<T>>;
  reset(): void;
  dispose(): void;
}

let monotonicMutationCounter = 0;
const defaultMutationId = (): string => {
  monotonicMutationCounter += 1;
  return `m-${monotonicMutationCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

function toExperienceError(kind: ExperienceError['kind'], cause: unknown, at: number): ExperienceError {
  const message =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'unknown';
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

  const dispatch = (event: ExperienceEvent<T>): ExperienceState<T> => {
    const result = reducer<T>(state, event);
    if (!result.ok) {
      options.onTransitionError?.(result.error);
      return state;
    }
    state = result.value;
    for (const listener of listeners) listener(state);
    return state;
  };

  const ensureSourceSubscribed = (): void => {
    if (sourceUnsub || disposed) return;
    sourceUnsub = options.source$.subscribe({
      next: (value) => {
        if (!disposed) dispatch(loaded<T>(state.id, value));
      },
      error: (err) => {
        if (!disposed) dispatch(failEvt(state.id, toExperienceError('load-failed', err, now())));
      },
    });
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: () => {
      if (disposed) return;
      dispatch(load(state.id, now()));
      ensureSourceSubscribed();
    },
    mutate: async (input) => {
      if (disposed) return state;
      const mutationId = newMutationId();
      const stateId = state.id;
      dispatch(mutateEvt(stateId, mutationId, now()));
      try {
        const next = await options.mutate(input, { mutationId, id: stateId });
        if (!disposed) dispatch(mutationSucceeded<T>(stateId, mutationId, next));
      } catch (err) {
        if (!disposed) {
          dispatch(mutationFailed(stateId, mutationId, toExperienceError('mutation-failed', err, now()), true));
        }
      }
      return state;
    },
    reset: () => {
      if (!disposed) dispatch(reset(state.id));
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (sourceUnsub) {
        try {
          sourceUnsub();
        } catch {
          /* disposal must not throw */
        }
        sourceUnsub = null;
      }
      listeners.clear();
    },
  };
}

/** In-memory subject helper — push-based source without rxjs. */
export function createSubject<T>(): Observable<T> & {
  next(value: T): void;
  error(err: unknown): void;
  complete(): void;
} {
  const observers = new Set<Observer<T>>();
  return {
    subscribe: (observer) => {
      observers.add(observer);
      return () => observers.delete(observer);
    },
    next: (value) => {
      for (const o of observers) o.next(value);
    },
    error: (err) => {
      for (const o of observers) o.error?.(err);
    },
    complete: () => {
      for (const o of observers) o.complete?.();
      observers.clear();
    },
  };
}
