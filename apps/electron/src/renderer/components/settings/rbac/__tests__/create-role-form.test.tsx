import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CreateRoleForm,
  buildCreateRolePayload,
  type CreateRoleFormFields,
} from '../CreateRoleForm'
import type { Role } from '@rox-one/shared/auth'

describe('CreateRoleForm', () => {
  test('renders id + name + description fields', () => {
    const markup = renderToStaticMarkup(
      <CreateRoleForm onSubmit={() => undefined} />,
    )
    expect(markup).toContain('data-rbac-form="create-role"')
    expect(markup).toContain('data-rbac-field="role-id"')
    expect(markup).toContain('data-rbac-field="role-name"')
    expect(markup).toContain('data-rbac-field="role-description"')
  })

  test('buildCreateRolePayload constructs a Role with systemManaged=false', () => {
    const fields: CreateRoleFormFields = {
      id: 'release-manager',
      name: 'Release manager',
      description: 'Owns release workflow',
    }
    const role: Role = buildCreateRolePayload(fields)
    expect(role).toEqual({
      id: 'release-manager',
      name: 'Release manager',
      description: 'Owns release workflow',
      systemManaged: false,
    })
  })

  test('buildCreateRolePayload trims whitespace and drops empty description', () => {
    const fields: CreateRoleFormFields = {
      id: '  release-manager  ',
      name: '  Release manager  ',
      description: '   ',
    }
    const role: Role = buildCreateRolePayload(fields)
    expect(role.id).toBe('release-manager')
    expect(role.name).toBe('Release manager')
    expect(role.description).toBeUndefined()
    expect(role.systemManaged).toBe(false)
  })
})
