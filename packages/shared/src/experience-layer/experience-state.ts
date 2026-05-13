/**
 * Experience State — M.9 T270.
 *
 * Exhaustive discriminated union over the lifecycle of one renderable
 * experience: Idle, Loading, Ready<T>, Error, Mutating<T>. The union is
 * closed — the reducer's exhaustiveness check depends on this list staying
 * tight. Pure module. No I/O.
 */

import type { ExperienceId } from './experience-id.ts';

export type ExperienceStateKind = 'idle' | 'loading' | 'ready' | 'error' | 'mutating';

export interface IdleState {
  readonly kind: 'idle';
  readonly id: ExperienceId;
}
export interface LoadingState {
  readonly kind: 'loading';
  readonly id: ExperienceId;
  /** Wall-clock ms (UTC) when the load began. */
  readonly since: number;
}
export interface ReadyState<T> {
  readonly kind: 'ready';
  readonly id: ExperienceId;
  readonly data: T;
  /** Monotonic; bumps on every successful Loaded / MutationSucceeded. */
  readonly version: number;
}
export interface ErrorState {
  readonly kind: 'error';
  readonly id: ExperienceId;
  readonly error: ExperienceError;
}
export interface MutatingState<T> {
  readonly kind: 'mutating';
  readonly id: ExperienceId;
  /** Pre-mutation snapshot; renderers may show this while writing. */
  readonly data: T;
  readonly baseVersion: number;
  readonly mutationId: string;
  readonly since: number;
}

export type ExperienceState<T> =
  | IdleState
  | LoadingState
  | ReadyState<T>
  | ErrorState
  | MutatingState<T>;

/** Normalised failure payload — host adapters fill these in. */
export interface ExperienceError {
  readonly kind: 'load-failed' | 'mutation-failed' | 'host-fault';
  readonly message: string;
  readonly cause?: unknown;
  /** Wall-clock ms when the error was observed. */
  readonly at: number;
}

// -------- Constructors ----------------------------------------------------

export const idle = (id: ExperienceId): IdleState => ({ kind: 'idle', id });
export const loading = (id: ExperienceId, since: number): LoadingState =>
  ({ kind: 'loading', id, since });
export const ready = <T>(id: ExperienceId, data: T, version: number): ReadyState<T> =>
  ({ kind: 'ready', id, data, version });
export const errored = (id: ExperienceId, error: ExperienceError): ErrorState =>
  ({ kind: 'error', id, error });
export const mutating = <T>(
  id: ExperienceId,
  data: T,
  baseVersion: number,
  mutationId: string,
  since: number,
): MutatingState<T> => ({ kind: 'mutating', id, data, baseVersion, mutationId, since });
