/**
 * GrantRoleForm — owner-only form that binds a role to a user on a
 * scope by calling the T227 `roles.grant` RPC. The component receives
 * `availableRoles` from the parent so the role-id dropdown reflects
 * the current catalogue (system roles plus any custom ones).
 *
 * `buildGrantRolePayload` is a pure helper exported for tests. It
 * normalises `scopeId` to `null` when `scopeKind === 'global'` to
 * match the server's validation expectations.
 */

import * as React from 'react'
import { SettingsInput, SettingsRow } from '@/components/settings'
import { Button } from '@/components/ui/button'
import type { Role, RoleGrant } from '@rox-one/shared/auth'

const SCOPE_KIND_OPTIONS = ['workspace', 'org', 'global'] as const
type ScopeKindOption = (typeof SCOPE_KIND_OPTIONS)[number]

export interface GrantRoleFormFields {
  actorId: string
  roleId: string
  scopeKind: ScopeKindOption
  scopeId: string
}

export interface GrantRoleFormProps {
  /** Called with a fully built `RoleGrant` payload when the user submits. */
  onSubmit: (grant: RoleGrant) => void | Promise<void>
  /** Roles offered in the role-id dropdown. Usually `SYSTEM_ROLES + custom`. */
  availableRoles: ReadonlyArray<Pick<Role, 'id' | 'name' | 'systemManaged'>>
  /** Optional disabled state from the parent (e.g. while saving). */
  disabled?: boolean
}

/**
 * Build a `RoleGrant` payload from form fields. The actor is always a
 * `user` in this UI; team grants land in a follow-up. Global-scope
 * grants normalise `scopeId` to `null`.
 */
export function buildGrantRolePayload(fields: GrantRoleFormFields): RoleGrant {
  const scopeKind = fields.scopeKind
  const scopeId = scopeKind === 'global' ? null : fields.scopeId.trim()
  return {
    roleId: fields.roleId.trim(),
    actorKind: 'user',
    actorId: fields.actorId.trim(),
    scopeKind,
    scopeId: scopeId && scopeId.length > 0 ? scopeId : null,
  }
}

export function GrantRoleForm({ onSubmit, availableRoles, disabled }: GrantRoleFormProps): React.ReactElement {
  const [actorId, setActorId] = React.useState('')
  const [roleId, setRoleId] = React.useState(availableRoles[0]?.id ?? '')
  const [scopeKind, setScopeKind] = React.useState<ScopeKindOption>('workspace')
  const [scopeId, setScopeId] = React.useState('')

  const isGlobal = scopeKind === 'global'
  const canSubmit =
    actorId.trim().length > 0
    && roleId.trim().length > 0
    && (isGlobal || scopeId.trim().length > 0)
    && !disabled

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const grant = buildGrantRolePayload({ actorId, roleId, scopeKind, scopeId })
    void Promise.resolve(onSubmit(grant)).then(() => {
      setActorId('')
      setScopeId('')
    })
  }

  return (
    <form data-rbac-form="grant-role" onSubmit={submit} className="space-y-3">
      <div data-rbac-field="grant-actor-id">
        <SettingsInput
          label="User id"
          value={actorId}
          onChange={setActorId}
          placeholder="user-42"
          inCard
        />
      </div>
      <div data-rbac-field="grant-role-id" className="px-4 py-3.5 space-y-2">
        <label className="text-sm font-medium" htmlFor="grant-role-id-select">
          Role
        </label>
        <select
          id="grant-role-id-select"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
        >
          {availableRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      <div data-rbac-field="grant-scope-kind" className="px-4 py-3.5 space-y-2">
        <label className="text-sm font-medium" htmlFor="grant-scope-kind-select">
          Scope kind
        </label>
        <select
          id="grant-scope-kind-select"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scopeKind}
          onChange={(event) => setScopeKind(event.target.value as ScopeKindOption)}
        >
          {SCOPE_KIND_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div data-rbac-field="grant-scope-id">
        <SettingsInput
          label="Scope id"
          value={isGlobal ? '' : scopeId}
          onChange={setScopeId}
          placeholder={isGlobal ? 'не требуется для global' : 'ws-alpha'}
          disabled={isGlobal}
          inCard
        />
      </div>
      <SettingsRow
        label="Grant role"
        description="Binds the role to the actor on the selected scope. The server gates this with an owner check."
        action={
          <Button type="submit" size="sm" disabled={!canSubmit}>
            Grant role
          </Button>
        }
      />
    </form>
  )
}
