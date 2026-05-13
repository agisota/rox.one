/**
 * Experience Reducer — M.9 T270.
 *
 * Pure `reducer(state, event)` returning a `Result<ExperienceState<T>,
 * TransitionError>`. The kernel never throws; illegal `(state, event)` pairs
 * become typed `TransitionError` values that adapters can surface as
 * diagnostics without crashing the renderer.
 *
 * Truth table (rows = state, cols = event):
 *
 *                | load   | loaded | mutate | mut-ok | mut-fail | reset | fail
 *  --------------+--------+--------+--------+--------+----------+-------+------
 *  idle          | Load.  | err    | err    | err    | err      | Idle  | Err
 *  loading       | Load*  | Ready  | err    | err    | err      | Idle  | Err
 *  ready         | Load*  | Ready+ | Mut.   | err    | err      | Idle  | Err
 *  error         | Load.  | err    | err    | err    | err      | Idle  | Err
 *  mutating      | err    | err    | err    | Ready+ | Ready/Err| Idle  | Err
 *
 * Legend
 *   Load.    : transition to Loading (no version change)
 *   Load*    : restart Loading from a non-idle state (loading/ready/error)
 *   Ready    : enter Ready with version=1
 *   Ready+   : enter Ready and bump version
 *   Ready/Err: branch on `MutationFailedEvent.recoverable`
 *   err      : returns `{ ok:false, error: IllegalTransition }`
 *   Err      : transition to Error
 *
 * Mutation events are also rejected if `event.id !== state.id` or, for
 * MutationSucceeded / MutationFailed, if `event.mutationId !==
 * state.mutationId`. Both are typed `MismatchedId` / `MismatchedMutation`.
 *
 * Pure module. No I/O, no rxjs.
 */

import type { ExperienceEvent } from './experience-event.ts';
import type { ExperienceId } from './experience-id.ts';
import type { ExperienceState, ReadyState } from './experience-state.ts';
import { errored, idle, loading, mutating, ready } from './experience-state.ts';

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type TransitionError =
  | {
      readonly kind: 'IllegalTransition';
      readonly stateKind: ExperienceState<unknown>['kind'];
      readonly eventKind: ExperienceEvent<unknown>['kind'];
    }
  | {
      readonly kind: 'MismatchedId';
      readonly stateId: ExperienceId;
      readonly eventId: ExperienceId;
    }
  | {
      readonly kind: 'MismatchedMutation';
      readonly expected: string;
      readonly received: string;
    };

function illegal<T>(
  state: ExperienceState<T>,
  event: ExperienceEvent<T>,
): Result<ExperienceState<T>, TransitionError> {
  return {
    ok: false,
    error: {
      kind: 'IllegalTransition',
      stateKind: state.kind,
      eventKind: event.kind,
    },
  };
}

function checkId<T>(
  state: ExperienceState<T>,
  event: ExperienceEvent<T>,
): TransitionError | null {
  if (state.id !== event.id) {
    return { kind: 'MismatchedId', stateId: state.id, eventId: event.id };
  }
  return null;
}

export function reducer<T>(
  state: ExperienceState<T>,
  event: ExperienceEvent<T>,
): Result<ExperienceState<T>, TransitionError> {
  const idErr = checkId(state, event);
  if (idErr) return { ok: false, error: idErr };

  // Universal transitions: Reset and Fail are accepted from any state.
  switch (event.kind) {
    case 'reset':
      return { ok: true, value: idle(state.id) };
    case 'fail':
      return { ok: true, value: errored(state.id, event.error) };
    default:
      break;
  }

  switch (state.kind) {
    case 'idle':
      switch (event.kind) {
        case 'load':
          return { ok: true, value: loading(state.id, event.at) };
        default:
          return illegal(state, event);
      }

    case 'loading':
      switch (event.kind) {
        case 'load':
          return { ok: true, value: loading(state.id, event.at) };
        case 'loaded':
          return { ok: true, value: ready(state.id, event.data, 1) };
        default:
          return illegal(state, event);
      }

    case 'ready':
      switch (event.kind) {
        case 'load':
          return { ok: true, value: loading(state.id, event.at) };
        case 'loaded':
          return { ok: true, value: ready(state.id, event.data, state.version + 1) };
        case 'mutate':
          return {
            ok: true,
            value: mutating(
              state.id,
              state.data,
              state.version,
              event.mutationId,
              event.at,
            ),
          };
        default:
          return illegal(state, event);
      }

    case 'error':
      switch (event.kind) {
        case 'load':
          return { ok: true, value: loading(state.id, event.at) };
        default:
          return illegal(state, event);
      }

    case 'mutating':
      switch (event.kind) {
        case 'mutation-succeeded':
          if (event.mutationId !== state.mutationId) {
            return {
              ok: false,
              error: {
                kind: 'MismatchedMutation',
                expected: state.mutationId,
                received: event.mutationId,
              },
            };
          }
          return {
            ok: true,
            value: ready(state.id, event.data, state.baseVersion + 1),
          };
        case 'mutation-failed':
          if (event.mutationId !== state.mutationId) {
            return {
              ok: false,
              error: {
                kind: 'MismatchedMutation',
                expected: state.mutationId,
                received: event.mutationId,
              },
            };
          }
          if (event.recoverable) {
            const restored: ReadyState<T> = ready(state.id, state.data, state.baseVersion);
            return { ok: true, value: restored };
          }
          return { ok: true, value: errored(state.id, event.error) };
        default:
          return illegal(state, event);
      }

    default: {
      // Exhaustiveness guard — the type system should make this unreachable.
      const _exhaustive: never = state;
      void _exhaustive;
      return illegal(state as ExperienceState<T>, event);
    }
  }
}
