import { describe, expect, test } from 'bun:test'
import {
  createInitialRolesPanelState,
  rolesPanelReducer,
  selectIsOwner,
  type RolesPanelState,
} from '../roles-panel-state'
import type { Role, RoleGrant } from '@rox-one/shared/auth'

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

const editorGrant: RoleGrant = {
  roleId: 'editor',
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind: 'workspace',
  scopeId: 'ws-alpha',
}

describe('rolesPanelReducer', () => {
  test('initial state is loading with empty roles and grants', () => {
    const state = createInitialRolesPanelState({ callerUserId: 'user-1' })
    expect(state).toEqual({
      callerUserId: 'user-1',
      status: 'loading',
      roles: [],
      grants: [],
      error: null,
    } satisfies RolesPanelState)
  })

  test('roles-loaded transitions to ready with returned roles', () => {
    const state = createInitialRolesPanelState({ callerUserId: 'user-1' })
    const next = rolesPanelReducer(state, {
      type: 'roles-loaded',
      roles: [customRole],
    })
    expect(next.status).toBe('ready')
    expect(next.roles).toEqual([customRole])
    expect(next.error).toBeNull()
  })

  test('roles-failed transitions to error with message', () => {
    const state = createInitialRolesPanelState({ callerUserId: 'user-1' })
    const next = rolesPanelReducer(state, {
      type: 'roles-failed',
      error: 'rbac-not-configured',
    })
    expect(next.status).toBe('error')
    expect(next.error).toBe('rbac-not-configured')
  })

  test('grants-loaded merges grants list', () => {
    const state = createInitialRolesPanelState({ callerUserId: 'user-1' })
    const next = rolesPanelReducer(state, {
      type: 'grants-loaded',
      grants: [ownerGrant],
    })
    expect(next.grants).toEqual([ownerGrant])
  })

  test('refresh resets status to loading and clears error', () => {
    const seeded: RolesPanelState = {
      callerUserId: 'user-1',
      status: 'error',
      roles: [],
      grants: [],
      error: 'boom',
    }
    const next = rolesPanelReducer(seeded, { type: 'refresh' })
    expect(next.status).toBe('loading')
    expect(next.error).toBeNull()
  })
})

describe('selectIsOwner', () => {
  test('returns true when caller has any owner grant', () => {
    const state: RolesPanelState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [ownerGrant],
      error: null,
    }
    expect(selectIsOwner(state)).toBe(true)
  })

  test('returns false when caller has only non-owner grants', () => {
    const state: RolesPanelState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [editorGrant],
      error: null,
    }
    expect(selectIsOwner(state)).toBe(false)
  })

  test('returns false when caller has no grants', () => {
    const state: RolesPanelState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [],
      error: null,
    }
    expect(selectIsOwner(state)).toBe(false)
  })

  test('ignores grants whose actorId does not match the caller', () => {
    const state: RolesPanelState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [{ ...ownerGrant, actorId: 'someone-else' }],
      error: null,
    }
    expect(selectIsOwner(state)).toBe(false)
  })
})
