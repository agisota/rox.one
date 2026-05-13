import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  GrantRoleForm,
  buildGrantRolePayload,
  type GrantRoleFormFields,
} from '../GrantRoleForm'
import type { RoleGrant } from '@rox-one/shared/auth'

describe('GrantRoleForm', () => {
  test('renders actorId + roleId + scopeKind + scopeId fields', () => {
    const markup = renderToStaticMarkup(
      <GrantRoleForm
        onSubmit={() => undefined}
        availableRoles={[
          { id: 'owner', name: 'Owner', systemManaged: true },
          { id: 'editor', name: 'Editor', systemManaged: true },
        ]}
      />,
    )
    expect(markup).toContain('data-rbac-form="grant-role"')
    expect(markup).toContain('data-rbac-field="grant-actor-id"')
    expect(markup).toContain('data-rbac-field="grant-role-id"')
    expect(markup).toContain('data-rbac-field="grant-scope-kind"')
    expect(markup).toContain('data-rbac-field="grant-scope-id"')
  })

  test('renders an option for every available role', () => {
    const markup = renderToStaticMarkup(
      <GrantRoleForm
        onSubmit={() => undefined}
        availableRoles={[
          { id: 'owner', name: 'Owner', systemManaged: true },
          { id: 'editor', name: 'Editor', systemManaged: true },
          { id: 'viewer', name: 'Viewer', systemManaged: true },
        ]}
      />,
    )
    expect(markup).toContain('Owner')
    expect(markup).toContain('Editor')
    expect(markup).toContain('Viewer')
  })

  test('buildGrantRolePayload constructs a workspace-scoped user grant by default', () => {
    const fields: GrantRoleFormFields = {
      actorId: 'user-42',
      roleId: 'editor',
      scopeKind: 'workspace',
      scopeId: 'ws-alpha',
    }
    const grant: RoleGrant = buildGrantRolePayload(fields)
    expect(grant).toEqual({
      roleId: 'editor',
      actorKind: 'user',
      actorId: 'user-42',
      scopeKind: 'workspace',
      scopeId: 'ws-alpha',
    })
  })

  test('buildGrantRolePayload normalises scopeId to null for global scope', () => {
    const fields: GrantRoleFormFields = {
      actorId: 'user-42',
      roleId: 'owner',
      scopeKind: 'global',
      scopeId: '',
    }
    const grant: RoleGrant = buildGrantRolePayload(fields)
    expect(grant.scopeKind).toBe('global')
    expect(grant.scopeId).toBeNull()
  })
})
