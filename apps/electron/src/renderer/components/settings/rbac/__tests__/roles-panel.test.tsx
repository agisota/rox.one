import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RolesPanel } from '../RolesPanel'
import { RolesPanelContext } from '../RolesPanelContext'
import type { RolesPanelState } from '../roles-panel-state'
import type { Role, RoleGrant } from '@rox-one/shared/auth'

const SYSTEM_ROLES_FIXTURE: Role[] = [
  { id: 'owner', name: 'Owner', description: 'Full control over the scope', systemManaged: true },
  { id: 'editor', name: 'Editor', description: 'Read and write access', systemManaged: true },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access', systemManaged: true },
]

const customRole: Role = {
  id: 'release-manager',
  name: 'Release manager',
  description: 'Owns release workflow',
  systemManaged: false,
}

const ownerGrant: RoleGrant = {
  roleId: 'owner',
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind: 'workspace',
  scopeId: 'ws-alpha',
}

function makeFakeRpc(invokeImpl: (channel: string, ...args: unknown[]) => Promise<unknown>) {
  return {
    invoke: (channel: string, ...args: unknown[]) => invokeImpl(channel, ...args),
  }
}

function renderWithContext(node: React.ReactElement, options: {
  invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
  initialState?: Partial<RolesPanelState>
  callerUserId?: string
}): string {
  const rpcClient = makeFakeRpc(
    options.invoke ?? (() => Promise.resolve(undefined)),
  )
  return renderToStaticMarkup(
    <RolesPanelContext.Provider
      value={{
        rpcClient,
        callerUserId: options.callerUserId ?? 'user-1',
        initialState: options.initialState,
      }}
    >
      {node}
    </RolesPanelContext.Provider>,
  )
}

describe('RolesPanel', () => {
  test('renders a table of roles when roles.list resolves with SYSTEM_ROLES plus custom', () => {
    const markup = renderWithContext(<RolesPanel />, {
      initialState: {
        status: 'ready',
        roles: [...SYSTEM_ROLES_FIXTURE, customRole],
        grants: [ownerGrant],
      },
    })
    expect(markup).toContain('Owner')
    expect(markup).toContain('Editor')
    expect(markup).toContain('Viewer')
    expect(markup).toContain('Release manager')
  })

  test('shows loading skeleton while roles.list is in flight', () => {
    const markup = renderWithContext(<RolesPanel />, {
      initialState: { status: 'loading' },
    })
    expect(markup).toContain('data-rbac-state="loading"')
  })

  test('shows error message when roles.list rejects', () => {
    const markup = renderWithContext(<RolesPanel />, {
      initialState: { status: 'error', error: 'rbac-not-configured' },
    })
    expect(markup).toContain('data-rbac-state="error"')
    expect(markup).toContain('rbac-not-configured')
  })

  test('shows permission-denied banner and hides mutation forms when caller is not owner', () => {
    const markup = renderWithContext(<RolesPanel />, {
      initialState: {
        status: 'ready',
        roles: [...SYSTEM_ROLES_FIXTURE],
        grants: [],
      },
    })
    expect(markup).toContain('data-rbac-owner="false"')
    expect(markup).toContain('You need owner role')
    expect(markup).not.toContain('data-rbac-form="create-role"')
    expect(markup).not.toContain('data-rbac-form="grant-role"')
  })

  test('empty state renders only SYSTEM_ROLES with (system) badges and disabled delete', () => {
    const markup = renderWithContext(<RolesPanel />, {
      initialState: {
        status: 'ready',
        roles: [...SYSTEM_ROLES_FIXTURE],
        grants: [ownerGrant],
      },
    })
    expect(markup).toContain('Owner')
    expect(markup).toContain('Editor')
    expect(markup).toContain('Viewer')
    // Three system roles each get a system badge.
    const badgeCount = (markup.match(/\(system\)/g) || []).length
    expect(badgeCount).toBe(3)
    // Delete buttons for system roles must be disabled.
    expect(markup).toContain('data-rbac-delete-system="disabled"')
  })

  test('mutation forms render when caller is owner', () => {
    const markup = renderWithContext(<RolesPanel />, {
      initialState: {
        status: 'ready',
        roles: [...SYSTEM_ROLES_FIXTURE],
        grants: [ownerGrant],
      },
    })
    expect(markup).toContain('data-rbac-owner="true"')
    expect(markup).toContain('data-rbac-form="create-role"')
    expect(markup).toContain('data-rbac-form="grant-role"')
  })
})
