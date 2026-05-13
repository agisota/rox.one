/**
 * CreateRoleForm — owner-only form that submits a custom role definition
 * to the T227 `roles.create` RPC. The component is intentionally
 * static-markup friendly so it can be exercised under `bun:test`
 * (`renderToStaticMarkup`). All interactive state lives in the parent
 * `RolesPanel`, which wires the submit handler.
 */

import * as React from 'react'
import { SettingsInput, SettingsRow } from '@/components/settings'
import { Button } from '@/components/ui/button'
import type { Role } from '@rox-one/shared/auth'

export interface CreateRoleFormFields {
  id: string
  name: string
  description: string
}

export interface CreateRoleFormProps {
  /** Called with a fully built `Role` payload when the user submits. */
  onSubmit: (role: Role) => void | Promise<void>
  /** Optional disabled state from the parent (e.g. while saving). */
  disabled?: boolean
}

/**
 * Build a `Role` payload from form fields. `systemManaged` is always
 * `false` — custom roles cannot pretend to be system-managed. Empty
 * descriptions are dropped to keep the wire payload tidy.
 */
export function buildCreateRolePayload(fields: CreateRoleFormFields): Role {
  const id = fields.id.trim()
  const name = fields.name.trim()
  const description = fields.description.trim()
  const role: Role = {
    id,
    name,
    systemManaged: false,
  }
  if (description.length > 0) role.description = description
  return role
}

export function CreateRoleForm({ onSubmit, disabled }: CreateRoleFormProps): React.ReactElement {
  const [id, setId] = React.useState('')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')

  const canSubmit = id.trim().length > 0 && name.trim().length > 0 && !disabled

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const role = buildCreateRolePayload({ id, name, description })
    void Promise.resolve(onSubmit(role)).then(() => {
      setId('')
      setName('')
      setDescription('')
    })
  }

  return (
    <form data-rbac-form="create-role" onSubmit={submit} className="space-y-3">
      <div data-rbac-field="role-id">
        <SettingsInput
          label="Role id"
          value={id}
          onChange={setId}
          placeholder="release-manager"
          inCard
        />
      </div>
      <div data-rbac-field="role-name">
        <SettingsInput
          label="Role name"
          value={name}
          onChange={setName}
          placeholder="Release manager"
          inCard
        />
      </div>
      <div data-rbac-field="role-description">
        <SettingsInput
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Owns release workflow"
          inCard
        />
      </div>
      <SettingsRow
        label="Create role"
        description="Adds the role to the catalogue. System role ids are rejected by the server."
        action={
          <Button type="submit" size="sm" disabled={!canSubmit}>
            Create role
          </Button>
        }
      />
    </form>
  )
}
