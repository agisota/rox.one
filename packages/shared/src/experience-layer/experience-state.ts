/**
 * Experience State — M.9 T270.
 *
 * Exhaustive discriminated union describing the lifecycle of one renderable
 * experience. Every variant carries the {@link ExperienceId} plus a small
 * per-variant payload that downstream renderers can consume directly.
 *
 * State variants:
 * - `Idle`     — created, awaiting a `Load`/`Mutate`.
 * - `Loading`  — fetch in flight; `since` is wall-clock ms (UTC) for budget UI.
 * - `Ready<T>` — last good snapshot; `version` increases monotonically.
 * - `Error`    — terminal failure; renderer should show diagnostic + retry.
 * - `Mutating` — last good snapshot + in-flight write; lets UI show both.
 *
 * The union is closed: the reducer's exhaustiveness check (see
 * `experience-reducer.ts`) depends on this list staying tight.
 *
 * Pure module. No I/O.
 */

import type { ExperienceId } from './experience-id.ts';

export type ExperienceStateKind =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'mutating';

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
  /** Monotonic counter; bumps on every successful Loaded / MutationSucceeded. */
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
  /** The pre-mutation snapshot; renderers may show this while writing. */
  readonly data: T;
  /** Version of the pre-mutation snapshot. */
  readonly baseVersion: number;
  /** Opaque correlation id chosen by the host; reducer just propagates it. */
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
  /** Optional structured cause (e.g. status code, retry hints). */
  readonly cause?: unknown;
  /** Wall-clock ms when the error was observed. */
  readonly at: number;
}

// -------- Constructors (host-facing, no side effects) ----------------------

export function idle(id: ExperienceId): IdleState {
  return { kind: 'idle', id };
}

export function loading(id: ExperienceId, since: number): LoadingState {
  return { kind: 'loading', id, since };
}

export function ready<T>(id: ExperienceId, data: T, version: number): ReadyState<T> {
  return { kind: 'ready', id, data, version };
}

export function errored(id: ExperienceId, error: ExperienceError): ErrorState {
  return { kind: 'error', id, error };
}

export function mutating<T>(
  id: ExperienceId,
  data: T,
  baseVersion: number,
  mutationId: string,
  since: number,
): MutatingState<T> {
  return { kind: 'mutating', id, data, baseVersion, mutationId, since };
}
