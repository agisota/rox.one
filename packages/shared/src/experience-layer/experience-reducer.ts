/**
 * Experience Reducer — M.9 T270.
 *
 * Pure `reducer(state, event) -> Result<ExperienceState<T>, TransitionError>`.
 * Never throws; illegal `(state, event)` pairs become typed errors.
 *
 *                | load | loaded | mutate | mut-ok | mut-fail  | reset | fail
 *  --------------+------+--------+--------+--------+-----------+-------+------
 *  idle          | Load | err    | err    | err    | err       | Idle  | Err
 *  loading       | Load | Ready  | err    | err    | err       | Idle  | Err
 *  ready         | Load | Ready+ | Mut    | err    | err       | Idle  | Err
 *  error         | Load | err    | err    | err    | err       | Idle  | Err
 *  mutating      | err  | err    | err    | Ready+ | Ready/Err | Idle  | Err
 *
 * `Reset`/`Fail` are universal. Mutation events are rejected if `event.id !=
 * state.id` (MismatchedId) or `event.mutationId != state.mutationId`
 * (MismatchedMutation). Pure module. No I/O.
 */

import type { ExperienceEvent } from './experience-event.ts';
import type { ExperienceId } from './experience-id.ts';
import type { ExperienceState } from './experience-state.ts';
import { errored, idle, loading, mutating, ready } from './experience-state.ts';

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type TransitionError =
  | {
      readonly kind: 'IllegalTransition';
      readonly stateKind: ExperienceState<unknown>['kind'];
      readonly eventKind: ExperienceEvent<unknown>['kind'];
    }
  | { readonly kind: 'MismatchedId'; readonly stateId: ExperienceId; readonly eventId: ExperienceId }
  | { readonly kind: 'MismatchedMutation'; readonly expected: string; readonly received: string };

const ok = <T>(value: T): Result<T, TransitionError> => ({ ok: true, value });
const fail = (error: TransitionError): Result<never, TransitionError> => ({ ok: false, error });

function illegal<T>(s: ExperienceState<T>, e: ExperienceEvent<T>): Result<ExperienceState<T>, TransitionError> {
  return fail({ kind: 'IllegalTransition', stateKind: s.kind, eventKind: e.kind });
}

export function reducer<T>(
  state: ExperienceState<T>,
  event: ExperienceEvent<T>,
): Result<ExperienceState<T>, TransitionError> {
  if (state.id !== event.id) {
    return fail({ kind: 'MismatchedId', stateId: state.id, eventId: event.id });
  }

  // Universal escape hatches.
  if (event.kind === 'reset') return ok(idle(state.id));
  if (event.kind === 'fail') return ok(errored(state.id, event.error));

  switch (state.kind) {
    case 'idle':
      return event.kind === 'load' ? ok(loading(state.id, event.at)) : illegal(state, event);

    case 'loading':
      if (event.kind === 'load') return ok(loading(state.id, event.at));
      if (event.kind === 'loaded') return ok(ready(state.id, event.data, 1));
      return illegal(state, event);

    case 'ready':
      if (event.kind === 'load') return ok(loading(state.id, event.at));
      if (event.kind === 'loaded') return ok(ready(state.id, event.data, state.version + 1));
      if (event.kind === 'mutate') {
        return ok(mutating(state.id, state.data, state.version, event.mutationId, event.at));
      }
      return illegal(state, event);

    case 'error':
      return event.kind === 'load' ? ok(loading(state.id, event.at)) : illegal(state, event);

    case 'mutating':
      if (event.kind === 'mutation-succeeded') {
        if (event.mutationId !== state.mutationId) {
          return fail({ kind: 'MismatchedMutation', expected: state.mutationId, received: event.mutationId });
        }
        return ok(ready(state.id, event.data, state.baseVersion + 1));
      }
      if (event.kind === 'mutation-failed') {
        if (event.mutationId !== state.mutationId) {
          return fail({ kind: 'MismatchedMutation', expected: state.mutationId, received: event.mutationId });
        }
        return event.recoverable
          ? ok(ready(state.id, state.data, state.baseVersion))
          : ok(errored(state.id, event.error));
      }
      return illegal(state, event);

    default: {
      const _exhaustive: never = state;
      void _exhaustive;
      return illegal(state as ExperienceState<T>, event);
    }
  }
}
