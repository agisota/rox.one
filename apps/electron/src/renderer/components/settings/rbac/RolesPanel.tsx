/**
 * RolesPanel — top-level component for the "Team & permissions"
 * settings tab. Loads the role catalogue from T227's `roles.list`,
 * renders the table, and conditionally mounts the create/grant
 * mutation forms when the caller holds an `owner` grant.
 *
 * The component reads its RPC client and caller id from
 * `RolesPanelContext`. Tests inject a fake context to bypass real
 * transport.
 */

import * as React from 'react'
import { SettingsCard, SettingsRow, SettingsSection } from '@/components/settings'
import type { Role, RoleGrant } from '@rox-one/shared/auth'
import { useRolesPanelContext } from './RolesPanelContext'
import {
  createInitialRolesPanelState,
  rolesPanelReducer,
  selectIsOwner,
  type RolesPanelState,
} from './roles-panel-state'
import { CreateRoleForm } from './CreateRoleForm'
import { GrantRoleForm } from './GrantRoleForm'
import { RevokeButton } from './RevokeButton'

function mergeInitialState(
  base: RolesPanelState,
  override: RolesPanelState['status'] extends never ? never : Partial<RolesPanelState>,
): RolesPanelState {
  return {
    ...base,
    status: override.status ?? base.status,
    roles: override.roles ?? base.roles,
    grants: override.grants ?? base.grants,
    error: override.error ?? base.error,
  }
}

export function RolesPanel(): React.ReactElement {
  const { rpcClient, callerUserId, initialState } = useRolesPanelContext()
  const seed = React.useMemo(() => {
    const base = createInitialRolesPanelState({ callerUserId })
    if (!initialState) return base
    return mergeInitialState(base, initialState as Partial<RolesPanelState>)
  }, [callerUserId, initialState])
  const [state, dispatch] = React.useReducer(rolesPanelReducer, seed)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const loadRoles = React.useCallback(async () => {
    dispatch({ type: 'refresh' })
    try {
      const result = (await rpcClient.invoke('roles.list')) as Role[]
      dispatch({ type: 'roles-loaded', roles: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      dispatch({ type: 'roles-failed', error: message })
    }
  }, [rpcClient])

  // Only auto-load when no initial state was supplied (test path keeps
  // the panel deterministic by pre-seeding the reducer).
  React.useEffect(() => {
    if (initialState && initialState.status) return
    void loadRoles()
  }, [initialState, loadRoles])

  const isOwner = selectIsOwner(state)

  const handleCreate = async (role: Role) => {
    setActionError(null)
    const raw = await rpcClient.invoke('roles.create', role)
    if (raw && typeof raw === 'object' && 'error' in raw) {
      const errResult = raw as { error: string; reason?: string }
      setActionError(`${errResult.error}${errResult.reason ? `: ${errResult.reason}` : ''}`)
      return
    }
    await loadRoles()
  }

  const handleGrant = async (grant: RoleGrant) => {
    setActionError(null)
    const raw = await rpcClient.invoke('roles.grant', grant)
    if (raw && typeof raw === 'object' && 'error' in raw) {
      const errResult = raw as { error: string; reason?: string }
      setActionError(`${errResult.error}${errResult.reason ? `: ${errResult.reason}` : ''}`)
    }
  }

  if (state.status === 'loading') {
    return (
      <section data-rbac-state="loading" className="space-y-3">
        <SettingsCard className="px-4 py-3.5">
          <p className="text-sm text-muted-foreground">Loading roles…</p>
        </SettingsCard>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section data-rbac-state="error" className="space-y-3">
        <SettingsCard className="px-4 py-3.5">
          <p className="text-sm text-destructive">
            Failed to load roles: {state.error ?? 'unknown error'}
          </p>
        </SettingsCard>
      </section>
    )
  }

  return (
    <section
      data-rbac-state="ready"
      data-rbac-owner={isOwner ? 'true' : 'false'}
      className="space-y-6"
    >
      <SettingsSection title="Roles" description="System and custom roles available on this server.">
        <SettingsCard divided>
          {state.roles.length === 0 ? (
            <SettingsRow label="No roles" description="The role catalogue is empty." />
          ) : (
            state.roles.map((role) => (
              <SettingsRow
                key={role.id}
                label={`${role.name}${role.systemManaged ? ' (system)' : ''}`}
                description={role.description ?? role.id}
                action={
                  role.systemManaged ? (
                    <button
                      type="button"
                      data-rbac-delete-system="disabled"
                      disabled
                      className="text-xs text-muted-foreground"
                    >
                      Delete
                    </button>
                  ) : null
                }
              />
            ))
          )}
        </SettingsCard>
      </SettingsSection>

      {!isOwner ? (
        <SettingsSection title="Team & permissions" description="Only owners can change roles or grants.">
          <SettingsCard className="px-4 py-3.5">
            <p data-rbac-banner="permission-denied" className="text-sm text-muted-foreground">
              You need owner role on this scope to manage roles and grants.
            </p>
          </SettingsCard>
        </SettingsSection>
      ) : (
        <>
          <SettingsSection title="Create role" description="Adds a custom role to the catalogue. System role ids are rejected.">
            <SettingsCard className="px-4 py-3.5">
              <CreateRoleForm onSubmit={handleCreate} />
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title="Grant role" description="Binds a role to a user on a scope.">
            <SettingsCard className="px-4 py-3.5">
              <GrantRoleForm onSubmit={handleGrant} availableRoles={state.roles} />
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title="Active grants" description="Grants the caller can see. Use revoke to remove a binding.">
            <SettingsCard divided>
              {state.grants.length === 0 ? (
                <SettingsRow label="No active grants" description="Use the form above to grant a role." />
              ) : (
                state.grants.map((grant) => (
                  <SettingsRow
                    key={`${grant.roleId}:${grant.actorKind}:${grant.actorId}:${grant.scopeKind}:${grant.scopeId ?? '*'}`}
                    label={`${grant.roleId} → ${grant.actorId}`}
                    description={`${grant.actorKind} on ${grant.scopeKind}${grant.scopeId ? `:${grant.scopeId}` : ''}`}
                    action={
                      <RevokeButton
                        grant={grant}
                        rpcClient={rpcClient}
                        onRevoke={() => {
                          void loadRoles()
                        }}
                      />
                    }
                  />
                ))
              )}
            </SettingsCard>
          </SettingsSection>
        </>
      )}

      {actionError ? (
        <SettingsCard className="px-4 py-3.5">
          <p data-rbac-action-error="true" className="text-sm text-destructive">
            {actionError}
          </p>
        </SettingsCard>
      ) : null}
    </section>
  )
}
