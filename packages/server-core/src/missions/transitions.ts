/**
 * Pure mission state transitions.
 *
 * `transition(state, event)` is the single point that decides whether a
 * mission may move from one state to another. No I/O, no clock reads, no
 * module-level state. Each event carries the timestamp the scheduler
 * stamps it with (`at`) so the algebra itself stays deterministic.
 *
 * Legality matrix:
 *   Pending   : Start, Cancel
 *   Running   : Pause, AwaitInput, Complete, Fail, Cancel
 *   Paused    : Resume, Fail, Cancel
 *   Awaiting  : ProvideInput, Fail, Cancel
 *   Completed / Failed / Cancelled : terminal
 */

import { isMissionTerminal, type MissionState, type MissionStateKind } from './state.ts'

export type MissionEvent =
  | { readonly kind: 'Start'; readonly at: string }
  | { readonly kind: 'Pause'; readonly at: string; readonly reason: string }
  | { readonly kind: 'Resume'; readonly at: string }
  | { readonly kind: 'AwaitInput'; readonly at: string; readonly prompt: string }
  | { readonly kind: 'ProvideInput'; readonly at: string; readonly input: string }
  | { readonly kind: 'Complete'; readonly at: string; readonly output: string }
  | { readonly kind: 'Fail'; readonly at: string; readonly reason: string }
  | { readonly kind: 'Cancel'; readonly at: string; readonly reason: string }

export type MissionEventKind = MissionEvent['kind']

export type TransitionError =
  | {
      readonly kind: 'illegal_transition'
      readonly from: MissionStateKind
      readonly event: MissionEventKind
      readonly message: string
    }
  | {
      readonly kind: 'terminal_state'
      readonly from: MissionStateKind
      readonly event: MissionEventKind
      readonly message: string
    }

export type TransitionResult =
  | { readonly ok: true; readonly value: MissionState }
  | { readonly ok: false; readonly error: TransitionError }

function illegal(state: MissionState, event: MissionEvent): TransitionResult {
  return {
    ok: false,
    error: {
      kind: 'illegal_transition',
      from: state.kind,
      event: event.kind,
      message: `Cannot apply ${event.kind} while mission is in ${state.kind}`,
    },
  }
}

function terminal(state: MissionState, event: MissionEvent): TransitionResult {
  return {
    ok: false,
    error: {
      kind: 'terminal_state',
      from: state.kind,
      event: event.kind,
      message: `Mission is already terminal (${state.kind}); no further events accepted`,
    },
  }
}

function ok(value: MissionState): TransitionResult {
  return { ok: true, value }
}

export function transition(state: MissionState, event: MissionEvent): TransitionResult {
  if (isMissionTerminal(state)) {
    return terminal(state, event)
  }
  switch (state.kind) {
    case 'Pending':
      return fromPending(state, event)
    case 'Running':
      return fromRunning(state, event)
    case 'Paused':
      return fromPaused(state, event)
    case 'Awaiting':
      return fromAwaiting(state, event)
    case 'Completed':
    case 'Failed':
    case 'Cancelled':
      return terminal(state, event)
  }
}

function fromPending(state: MissionState & { kind: 'Pending' }, event: MissionEvent): TransitionResult {
  switch (event.kind) {
    case 'Start':
      return ok({ kind: 'Running', startedAt: event.at })
    case 'Cancel':
      return ok({ kind: 'Cancelled', at: event.at, reason: event.reason })
    case 'Pause':
    case 'Resume':
    case 'AwaitInput':
    case 'ProvideInput':
    case 'Complete':
    case 'Fail':
      return illegal(state, event)
  }
}

function fromRunning(state: MissionState & { kind: 'Running' }, event: MissionEvent): TransitionResult {
  switch (event.kind) {
    case 'Pause':
      return ok({ kind: 'Paused', at: event.at, reason: event.reason })
    case 'AwaitInput':
      return ok({ kind: 'Awaiting', at: event.at, prompt: event.prompt })
    case 'Complete':
      return ok({ kind: 'Completed', at: event.at, output: event.output })
    case 'Fail':
      return ok({ kind: 'Failed', at: event.at, reason: event.reason })
    case 'Cancel':
      return ok({ kind: 'Cancelled', at: event.at, reason: event.reason })
    case 'Start':
    case 'Resume':
    case 'ProvideInput':
      return illegal(state, event)
  }
}

function fromPaused(state: MissionState & { kind: 'Paused' }, event: MissionEvent): TransitionResult {
  switch (event.kind) {
    case 'Resume':
      return ok({ kind: 'Running', startedAt: event.at })
    case 'Fail':
      return ok({ kind: 'Failed', at: event.at, reason: event.reason })
    case 'Cancel':
      return ok({ kind: 'Cancelled', at: event.at, reason: event.reason })
    case 'Start':
    case 'Pause':
    case 'AwaitInput':
    case 'ProvideInput':
    case 'Complete':
      return illegal(state, event)
  }
}

function fromAwaiting(state: MissionState & { kind: 'Awaiting' }, event: MissionEvent): TransitionResult {
  switch (event.kind) {
    case 'ProvideInput':
      // Resuming work after the human answers — re-entry into Running,
      // stamped with the answer's timestamp.
      return ok({ kind: 'Running', startedAt: event.at })
    case 'Fail':
      return ok({ kind: 'Failed', at: event.at, reason: event.reason })
    case 'Cancel':
      return ok({ kind: 'Cancelled', at: event.at, reason: event.reason })
    case 'Start':
    case 'Pause':
    case 'Resume':
    case 'AwaitInput':
    case 'Complete':
      return illegal(state, event)
  }
}
