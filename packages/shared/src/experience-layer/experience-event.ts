/**
 * Experience Events — M.9 T270.
 *
 * Closed set of events the reducer accepts. Variants: Load, Loaded<T>,
 * Mutate, MutationSucceeded<T>, MutationFailed, Reset, Fail. Pure module.
 */

import type { ExperienceId } from './experience-id.ts';
import type { ExperienceError } from './experience-state.ts';

export type ExperienceEventKind =
  | 'load'
  | 'loaded'
  | 'mutate'
  | 'mutation-succeeded'
  | 'mutation-failed'
  | 'reset'
  | 'fail';

export interface LoadEvent {
  readonly kind: 'load';
  readonly id: ExperienceId;
  readonly at: number;
}
export interface LoadedEvent<T> {
  readonly kind: 'loaded';
  readonly id: ExperienceId;
  readonly data: T;
}
export interface MutateEvent {
  readonly kind: 'mutate';
  readonly id: ExperienceId;
  readonly mutationId: string;
  readonly at: number;
}
export interface MutationSucceededEvent<T> {
  readonly kind: 'mutation-succeeded';
  readonly id: ExperienceId;
  readonly mutationId: string;
  readonly data: T;
}
export interface MutationFailedEvent {
  readonly kind: 'mutation-failed';
  readonly id: ExperienceId;
  readonly mutationId: string;
  readonly error: ExperienceError;
  /** true → reducer restores `Ready` at `baseVersion`; false → `Error`. */
  readonly recoverable: boolean;
}
export interface ResetEvent {
  readonly kind: 'reset';
  readonly id: ExperienceId;
}
export interface FailEvent {
  readonly kind: 'fail';
  readonly id: ExperienceId;
  readonly error: ExperienceError;
}

export type ExperienceEvent<T> =
  | LoadEvent
  | LoadedEvent<T>
  | MutateEvent
  | MutationSucceededEvent<T>
  | MutationFailedEvent
  | ResetEvent
  | FailEvent;

// -------- Constructors -----------------------------------------------------

export const load = (id: ExperienceId, at: number): LoadEvent => ({ kind: 'load', id, at });
export const loaded = <T>(id: ExperienceId, data: T): LoadedEvent<T> => ({ kind: 'loaded', id, data });
export const mutate = (id: ExperienceId, mutationId: string, at: number): MutateEvent =>
  ({ kind: 'mutate', id, mutationId, at });
export const mutationSucceeded = <T>(id: ExperienceId, mutationId: string, data: T): MutationSucceededEvent<T> =>
  ({ kind: 'mutation-succeeded', id, mutationId, data });
export const mutationFailed = (
  id: ExperienceId,
  mutationId: string,
  error: ExperienceError,
  recoverable: boolean,
): MutationFailedEvent => ({ kind: 'mutation-failed', id, mutationId, error, recoverable });
export const reset = (id: ExperienceId): ResetEvent => ({ kind: 'reset', id });
export const fail = (id: ExperienceId, error: ExperienceError): FailEvent => ({ kind: 'fail', id, error });
