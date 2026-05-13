/**
 * Pure data layer for the RBAC admin panel (T228).
 *
 * Keeping the reducer and selectors out of the React component lets the
 * test suite cover the state machine without a DOM. The component layer
 * (`RolesPanel.tsx`) imports the reducer and dispatches actions in
 * response to RPC calls.
 *
 * No React imports here on purpose — these helpers ship as plain
 * functions so they can be exercised under `bun:test` without `react/`
 * runtime dependencies.
 */

import type { Role, RoleGrant } from '@rox-one/shared/auth'

export type RolesPanelStatus = 'loading' | 'ready' | 'error'

export interface RolesPanelState {
  /** The signed-in user id used for owner-grant derivation. */
  callerUserId: string | null
  /** Current load status of the catalogue. */
  status: RolesPanelStatus
  /** Roles returned by `roles.list`. */
  roles: Role[]
  /** Grants visible to the caller. */
  grants: RoleGrant[]
  /** Latest error message, when `status === 'error'`. */
  error: string | null
}

export type RolesPanelAction =
  | { type: 'refresh' }
  | { type: 'roles-loaded'; roles: Role[] }
  | { type: 'roles-failed'; error: string }
  | { type: 'grants-loaded'; grants: RoleGrant[] }

export interface CreateInitialRolesPanelStateInput {
  callerUserId: string | null
  initialRoles?: Role[]
  initialGrants?: RoleGrant[]
}

/**
 * Build the initial reducer state. `roles` and `grants` default to
 * empty arrays; the component triggers `roles.list` on mount and
 * dispatches `roles-loaded` once the promise resolves.
 */
export function createInitialRolesPanelState(
  input: CreateInitialRolesPanelStateInput,
): RolesPanelState {
  return {
    callerUserId: input.callerUserId,
    status: 'loading',
    roles: input.initialRoles ?? [],
    grants: input.initialGrants ?? [],
    error: null,
  }
}

/**
 * Pure-function reducer. Hosts dispatch the four documented actions to
 * walk the panel through its load lifecycle.
 */
export function rolesPanelReducer(
  state: RolesPanelState,
  action: RolesPanelAction,
): RolesPanelState {
  switch (action.type) {
    case 'refresh':
      return { ...state, status: 'loading', error: null }
    case 'roles-loaded':
      return { ...state, status: 'ready', roles: action.roles, error: null }
    case 'roles-failed':
      return { ...state, status: 'error', error: action.error }
    case 'grants-loaded':
      return { ...state, grants: action.grants }
    default:
      return state
  }
}

/**
 * Returns `true` when the caller has at least one `owner`-role grant
 * attributed to their `actorId`. Used to decide whether to mount the
 * mutation forms — the server still gates mutations independently.
 */
export function selectIsOwner(state: RolesPanelState): boolean {
  if (!state.callerUserId) return false
  return state.grants.some(
    (grant) =>
      grant.roleId === 'owner'
      && grant.actorKind === 'user'
      && grant.actorId === state.callerUserId,
  )
}
