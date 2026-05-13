/**
 * TeamManagementPanel — second admin surface introduced by T231.
 *
 * Where `RolesPanel` (T228) groups by *role*, this panel groups by
 * *actor* (user/team). For each actor it lists every (role × scope)
 * grant attributed to that actor as a clickable chip; clicking a chip
 * runs the existing `roles.revoke` RPC behind a `confirm()` gate and
 * dispatches `grant-revoked` to drop the row from local state.
 *
 * The component reuses `RolesPanelContext` so the same RPC adapter
 * powers both panels — admins do not need to provide a second
 * transport just for this view.
 */

import * as React from 'react'
import { SettingsCard, SettingsSection } from '@/components/settings'
import type { Role, RoleGrant } from '@rox-one/shared/auth'
import { useRolesPanelContext } from './RolesPanelContext'
import {
  createInitialTeamManagementState,
  selectActorCount,
  selectActorRows,
  selectIsOwner,
  teamManagementReducer,
  type TeamManagementState,
} from './team-management-state'
import { ActorRow } from './ActorRow'

function mergeInitialState(
  base: TeamManagementState,
  override: Partial<TeamManagementState>,
): TeamManagementState {
  return {
    ...base,
    status: override.status ?? base.status,
    roles: override.roles ?? base.roles,
    grants: override.grants ?? base.grants,
    error: override.error ?? base.error,
  }
}

export interface TeamManagementPanelProps {
  /**
   * Optional pre-seeded state for tests and SSR. Production renderers
   * omit this and let the panel fetch on mount.
   */
  initialState?: Partial<TeamManagementState>
  /**
   * Optional confirm override. Defaults to `window.confirm` inside
   * `ActorRow`. Tests inject a fake to bypass the modal.
   */
  confirm?: (grant: RoleGrant) => boolean
}

export function TeamManagementPanel({
  initialState,
  confirm,
}: TeamManagementPanelProps = {}): React.ReactElement {
  const { rpcClient, callerUserId } = useRolesPanelContext()

  const seed = React.useMemo(() => {
    const base = createInitialTeamManagementState({ callerUserId })
    if (!initialState) return base
    return mergeInitialState(base, initialState)
  }, [callerUserId, initialState])

  const [state, dispatch] = React.useReducer(teamManagementReducer, seed)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const loadAll = React.useCallback(async () => {
    dispatch({ type: 'refresh' })
    try {
      const roles = (await rpcClient.invoke('roles.list')) as Role[]
      dispatch({ type: 'roles-loaded', roles })
      // `roles.grants` returns the grants visible to the caller. We
      // fall back to an empty array if the RPC is not wired so the
      // panel still renders an empty state instead of crashing.
      const grants = (await rpcClient.invoke('roles.grants')) as RoleGrant[] | undefined
      dispatch({ type: 'grants-loaded', grants: Array.isArray(grants) ? grants : [] })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      dispatch({ type: 'load-failed', error: message })
    }
  }, [rpcClient])

  // Skip auto-load when callers pre-seed deterministic state (tests
  // and the future server-side render path).
  React.useEffect(() => {
    if (initialState && initialState.status) return
    void loadAll()
  }, [initialState, loadAll])

  const handleRevoke = React.useCallback(
    async (grant: RoleGrant) => {
      setActionError(null)
      const raw = await rpcClient.invoke('roles.revoke', grant)
      if (raw && typeof raw === 'object' && 'error' in raw) {
        const errResult = raw as { error: string; reason?: string }
        setActionError(
          `${errResult.error}${errResult.reason ? `: ${errResult.reason}` : ''}`,
        )
        return
      }
      dispatch({ type: 'grant-revoked', grant })
    },
    [rpcClient],
  )

  if (state.status === 'loading') {
    return (
      <section data-rbac-team-state="loading" className="space-y-3">
        <SettingsCard className="px-4 py-3.5">
          <p className="text-sm text-muted-foreground">Loading team grants…</p>
        </SettingsCard>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section data-rbac-team-state="error" className="space-y-3">
        <SettingsCard className="px-4 py-3.5">
          <p className="text-sm text-destructive">
            Failed to load team grants: {state.error ?? 'unknown error'}
          </p>
        </SettingsCard>
      </section>
    )
  }

  const rows = selectActorRows(state)
  const isOwner = selectIsOwner(state)
  const actorCount = selectActorCount(state)

  return (
    <section
      data-rbac-team-state="ready"
      data-rbac-team-owner={isOwner ? 'true' : 'false'}
      data-rbac-team-actors={actorCount}
      className="space-y-6"
    >
      <SettingsSection
        title="Actors"
        description={
          isOwner
            ? 'Grants grouped by actor (user/team). Click a chip to revoke.'
            : 'Grants grouped by actor (user/team). Owner required to revoke.'
        }
      >
        <SettingsCard divided>
          {rows.length === 0 ? (
            <div className="px-4 py-3.5 text-sm text-muted-foreground">
              No grants visible. New grants appear here once an owner binds a
              role.
            </div>
          ) : (
            rows.map((row) => (
              <ActorRow
                key={`${row.actorKind}:${row.actorId}`}
                row={row}
                onRevoke={handleRevoke}
                readOnly={!isOwner}
                confirm={confirm}
              />
            ))
          )}
        </SettingsCard>
      </SettingsSection>

      {actionError ? (
        <SettingsCard className="px-4 py-3.5">
          <p data-rbac-team-error="true" className="text-sm text-destructive">
            {actionError}
          </p>
        </SettingsCard>
      ) : null}
    </section>
  )
}
