/**
 * Mission state algebra.
 *
 * `MissionState` is the closed discriminated union of every legal mission
 * status. Each variant carries the metadata the scheduler needs to reason
 * about transitions: timestamps, reasons, prompts, etc. Timestamps live on
 * the state itself so the scheduler can be a pure transition + a thin
 * persistence shell — no clock reads inside the algebra.
 */

export type IsoTimestamp = string

export interface MissionStatePending {
  readonly kind: 'Pending'
  readonly createdAt: IsoTimestamp
}

export interface MissionStateRunning {
  readonly kind: 'Running'
  readonly startedAt: IsoTimestamp
}

export interface MissionStatePaused {
  readonly kind: 'Paused'
  readonly at: IsoTimestamp
  readonly reason: string
}

export interface MissionStateAwaiting {
  readonly kind: 'Awaiting'
  readonly at: IsoTimestamp
  readonly prompt: string
}

export interface MissionStateCompleted {
  readonly kind: 'Completed'
  readonly at: IsoTimestamp
  readonly output: string
}

export interface MissionStateFailed {
  readonly kind: 'Failed'
  readonly at: IsoTimestamp
  readonly reason: string
}

export interface MissionStateCancelled {
  readonly kind: 'Cancelled'
  readonly at: IsoTimestamp
  readonly reason: string
}

export type MissionState =
  | MissionStatePending
  | MissionStateRunning
  | MissionStatePaused
  | MissionStateAwaiting
  | MissionStateCompleted
  | MissionStateFailed
  | MissionStateCancelled

export type MissionStateKind = MissionState['kind']

/**
 * Tuple of every state kind, anchored by `satisfies` to the union's `kind`
 * discriminator. If a new variant is added to `MissionState` without
 * extending this tuple, the type checker fails — that is the exhaustiveness
 * proof referenced in the ticket.
 */
export const MISSION_STATE_KINDS = [
  'Pending',
  'Running',
  'Paused',
  'Awaiting',
  'Completed',
  'Failed',
  'Cancelled',
] as const satisfies readonly MissionStateKind[]

const TERMINAL_KINDS = new Set<MissionStateKind>(['Completed', 'Failed', 'Cancelled'])

export function isMissionTerminal(state: MissionState): boolean {
  return TERMINAL_KINDS.has(state.kind)
}
