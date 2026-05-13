/**
 * Experience Events — M.9 T270.
 *
 * The complete set of events the reducer accepts. The kernel is the only
 * surface that may translate an event into a state transition; host adapters
 * (T271 renderer, T272 server emit) emit these and consume the resulting
 * `ExperienceState`.
 *
 * Event variants:
 * - `Load`               — request a fresh fetch (Idle → Loading).
 * - `Loaded<T>`          — fetch returned a snapshot (Loading → Ready).
 * - `Mutate`             — host begins a write (Ready → Mutating).
 * - `MutationSucceeded`  — write committed (Mutating → Ready).
 * - `MutationFailed`     — write rejected (Mutating → Ready or Error).
 * - `Reset`              — drop back to Idle (any → Idle).
 * - `Fail`               — terminal failure (any → Error).
 *
 * Pure module. No rxjs, no I/O.
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
  /**
   * When true, the reducer drops back to the pre-mutation `Ready` snapshot.
   * When false, the reducer transitions to `Error`.
   */
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

export function load(id: ExperienceId, at: number): LoadEvent {
  return { kind: 'load', id, at };
}

export function loaded<T>(id: ExperienceId, data: T): LoadedEvent<T> {
  return { kind: 'loaded', id, data };
}

export function mutate(id: ExperienceId, mutationId: string, at: number): MutateEvent {
  return { kind: 'mutate', id, mutationId, at };
}

export function mutationSucceeded<T>(
  id: ExperienceId,
  mutationId: string,
  data: T,
): MutationSucceededEvent<T> {
  return { kind: 'mutation-succeeded', id, mutationId, data };
}

export function mutationFailed(
  id: ExperienceId,
  mutationId: string,
  error: ExperienceError,
  recoverable: boolean,
): MutationFailedEvent {
  return { kind: 'mutation-failed', id, mutationId, error, recoverable };
}

export function reset(id: ExperienceId): ResetEvent {
  return { kind: 'reset', id };
}

export function fail(id: ExperienceId, error: ExperienceError): FailEvent {
  return { kind: 'fail', id, error };
}
