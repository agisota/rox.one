/**
 * Pure data layer for the Team management view (T231).
 *
 * Where T228's `RolesPanel` slices role grants by *role*, this surface
 * slices them by *actor* — the admin sees one row per user/team and the
 * chip list shows every (role × scope) binding attributed to that
 * actor.
 *
 * The reducer + selector are pure (no React, no DOM, no I/O) so
 * `bun:test` can cover the state machine directly. The component layer
 * (`TeamManagementPanel.tsx`) imports the reducer and dispatches the
 * documented actions as the RPC adapter resolves.
 */

import type { Role, RoleGrant } from '@rox-one/shared/auth'

export type TeamManagementStatus = 'loading' | 'ready' | 'error'

/**
 * One grant attributed to an actor, enriched with the optional
 * human-facing role name so the chip can render `Editor` instead of
 * `editor` when the catalogue is loaded. Falls back to `roleId` when
 * the catalogue has not been resolved yet.
 */
export interface ActorGrantEntry {
  roleId: string
  roleName: string
  scopeKind: RoleGrant['scopeKind']
  scopeId: RoleGrant['scopeId']
  /** The underlying grant — handy for revoke dispatch. */
  grant: RoleGrant
  /** Stable composite key for React lists. */
  key: string
}

/**
 * One row in the team management view. `actorKind` + `actorId` together
 * uniquely identify the row.
 */
export interface ActorRowView {
  actorKind: RoleGrant['actorKind']
  actorId: string
  /** Display label — typically the actorId until a directory lookup lands. */
  displayName: string
  grants: ActorGrantEntry[]
}

export interface TeamManagementState {
  /** The signed-in user id used for permission gating in the UI. */
  callerUserId: string | null
  /** Current load status of the catalogue / grants. */
  status: TeamManagementStatus
  /** Role catalogue used for chip labels (id → name). */
  roles: Role[]
  /** All grants visible to the caller. */
  grants: RoleGrant[]
  /** Latest error message, when `status === 'error'`. */
  error: string | null
}

export type TeamManagementAction =
  | { type: 'refresh' }
  | { type: 'roles-loaded'; roles: Role[] }
  | { type: 'grants-loaded'; grants: RoleGrant[] }
  | { type: 'load-failed'; error: string }
  | { type: 'grant-revoked'; grant: RoleGrant }

export interface CreateInitialTeamManagementStateInput {
  callerUserId: string | null
  initialRoles?: Role[]
  initialGrants?: RoleGrant[]
}

/**
 * Build the initial reducer state. Defaults the catalogue + grants to
 * empty arrays; the host component triggers `roles.list` / `roles.grants`
 * on mount and dispatches the loaded actions when the promises resolve.
 */
export function createInitialTeamManagementState(
  input: CreateInitialTeamManagementStateInput,
): TeamManagementState {
  return {
    callerUserId: input.callerUserId,
    status: 'loading',
    roles: input.initialRoles ?? [],
    grants: input.initialGrants ?? [],
    error: null,
  }
}

/**
 * Pure-function reducer. Hosts dispatch the documented actions to walk
 * the panel through its load + revoke lifecycle.
 */
export function teamManagementReducer(
  state: TeamManagementState,
  action: TeamManagementAction,
): TeamManagementState {
  switch (action.type) {
    case 'refresh':
      return { ...state, status: 'loading', error: null }
    case 'roles-loaded':
      return { ...state, status: 'ready', roles: action.roles, error: null }
    case 'grants-loaded':
      return { ...state, status: 'ready', grants: action.grants, error: null }
    case 'load-failed':
      return { ...state, status: 'error', error: action.error }
    case 'grant-revoked':
      return {
        ...state,
        grants: state.grants.filter((g) => !grantsMatch(g, action.grant)),
      }
    default:
      return state
  }
}

/**
 * Stable identifier for a grant tuple. Two grants are considered the
 * same iff every shape field matches. The string form is used as a
 * React list `key` and for composite map lookups.
 */
export function grantKey(grant: RoleGrant): string {
  const scope = grant.scopeId ?? '*'
  return `${grant.roleId}:${grant.actorKind}:${grant.actorId}:${grant.scopeKind}:${scope}`
}

/**
 * Composite key identifying an actor row.
 */
export function actorRowKey(
  actorKind: RoleGrant['actorKind'],
  actorId: string,
): string {
  return `${actorKind}:${actorId}`
}

/**
 * Equality predicate for two grant tuples. Avoids a deep-equal helper
 * so the reducer stays dependency-free.
 */
export function grantsMatch(a: RoleGrant, b: RoleGrant): boolean {
  return (
    a.roleId === b.roleId
    && a.actorKind === b.actorKind
    && a.actorId === b.actorId
    && a.scopeKind === b.scopeKind
    && (a.scopeId ?? null) === (b.scopeId ?? null)
  )
}

/**
 * Group the visible grants by actor (user/team). Within each actor the
 * grants are ordered by `roleId`, then `scopeKind`, then `scopeId` so
 * the rendered chip list is deterministic regardless of server order.
 *
 * Actor rows themselves are ordered by `actorKind` (users first, teams
 * second) and then by `actorId` ascending — so admins reading the page
 * twice see the same layout.
 */
export function selectActorRows(state: TeamManagementState): ActorRowView[] {
  const roleNameById = new Map<string, string>()
  for (const role of state.roles) {
    roleNameById.set(role.id, role.name)
  }

  const byActor = new Map<string, ActorRowView>()
  for (const grant of state.grants) {
    const key = actorRowKey(grant.actorKind, grant.actorId)
    let row = byActor.get(key)
    if (!row) {
      row = {
        actorKind: grant.actorKind,
        actorId: grant.actorId,
        displayName: grant.actorId,
        grants: [],
      }
      byActor.set(key, row)
    }
    row.grants.push({
      roleId: grant.roleId,
      roleName: roleNameById.get(grant.roleId) ?? grant.roleId,
      scopeKind: grant.scopeKind,
      scopeId: grant.scopeId,
      grant,
      key: grantKey(grant),
    })
  }

  for (const row of byActor.values()) {
    row.grants.sort(compareGrantEntries)
  }

  return Array.from(byActor.values()).sort(compareActorRows)
}

/**
 * Count distinct actors in the panel. Convenient for empty-state
 * rendering and for the test suite.
 */
export function selectActorCount(state: TeamManagementState): number {
  const seen = new Set<string>()
  for (const grant of state.grants) {
    seen.add(actorRowKey(grant.actorKind, grant.actorId))
  }
  return seen.size
}

/**
 * Returns `true` if the caller (matched by `actorKind === 'user'` and
 * `actorId === callerUserId`) holds at least one `owner`-role grant.
 * Mirrors `selectIsOwner` from `roles-panel-state` so the team view
 * can hide the revoke affordance for non-owners without re-issuing the
 * permission check.
 */
export function selectIsOwner(state: TeamManagementState): boolean {
  if (!state.callerUserId) return false
  return state.grants.some(
    (grant) =>
      grant.roleId === 'owner'
      && grant.actorKind === 'user'
      && grant.actorId === state.callerUserId,
  )
}

function compareGrantEntries(a: ActorGrantEntry, b: ActorGrantEntry): number {
  if (a.roleId !== b.roleId) return a.roleId < b.roleId ? -1 : 1
  if (a.scopeKind !== b.scopeKind) return a.scopeKind < b.scopeKind ? -1 : 1
  const aScope = a.scopeId ?? ''
  const bScope = b.scopeId ?? ''
  if (aScope !== bScope) return aScope < bScope ? -1 : 1
  return 0
}

function compareActorRows(a: ActorRowView, b: ActorRowView): number {
  // Users sort before teams so admins see human accounts first.
  if (a.actorKind !== b.actorKind) {
    return a.actorKind === 'user' ? -1 : 1
  }
  if (a.actorId !== b.actorId) return a.actorId < b.actorId ? -1 : 1
  return 0
}
