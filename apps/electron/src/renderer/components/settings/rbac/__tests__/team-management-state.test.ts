import { describe, expect, test } from 'bun:test'
import type { Role, RoleGrant } from '@rox-one/shared/auth'
import {
  actorRowKey,
  createInitialTeamManagementState,
  grantKey,
  grantsMatch,
  selectActorCount,
  selectActorRows,
  selectIsOwner,
  teamManagementReducer,
  type TeamManagementState,
} from '../team-management-state'

const ownerRole: Role = {
  id: 'owner',
  name: 'Owner',
  description: 'Full control',
  systemManaged: true,
}

const editorRole: Role = {
  id: 'editor',
  name: 'Editor',
  description: 'Read and write',
  systemManaged: true,
}

const viewerRole: Role = {
  id: 'viewer',
  name: 'Viewer',
  description: 'Read only',
  systemManaged: true,
}

const ownerGrantAlpha: RoleGrant = {
  roleId: 'owner',
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind: 'workspace',
  scopeId: 'ws-alpha',
}

const editorGrantAlpha: RoleGrant = {
  roleId: 'editor',
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind: 'workspace',
  scopeId: 'ws-alpha',
}

const viewerGrantBeta: RoleGrant = {
  roleId: 'viewer',
  actorKind: 'user',
  actorId: 'user-2',
  scopeKind: 'workspace',
  scopeId: 'ws-beta',
}

const teamEditorGrant: RoleGrant = {
  roleId: 'editor',
  actorKind: 'team',
  actorId: 'team-builders',
  scopeKind: 'org',
  scopeId: 'org-main',
}

const globalOwnerGrant: RoleGrant = {
  roleId: 'owner',
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind: 'global',
  scopeId: null,
}

describe('createInitialTeamManagementState', () => {
  test('seeds loading status with empty catalogue + grants by default', () => {
    const state = createInitialTeamManagementState({ callerUserId: 'user-1' })
    expect(state).toEqual({
      callerUserId: 'user-1',
      status: 'loading',
      roles: [],
      grants: [],
      error: null,
    } satisfies TeamManagementState)
  })

  test('accepts pre-seeded roles + grants for testing/SSR paths', () => {
    const state = createInitialTeamManagementState({
      callerUserId: 'user-1',
      initialRoles: [ownerRole],
      initialGrants: [ownerGrantAlpha],
    })
    expect(state.roles).toEqual([ownerRole])
    expect(state.grants).toEqual([ownerGrantAlpha])
    expect(state.status).toBe('loading')
  })
})

describe('teamManagementReducer', () => {
  test('refresh resets status to loading and clears any error', () => {
    const seeded: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'error',
      roles: [],
      grants: [],
      error: 'boom',
    }
    const next = teamManagementReducer(seeded, { type: 'refresh' })
    expect(next.status).toBe('loading')
    expect(next.error).toBeNull()
  })

  test('roles-loaded transitions to ready and replaces catalogue', () => {
    const state = createInitialTeamManagementState({ callerUserId: 'user-1' })
    const next = teamManagementReducer(state, {
      type: 'roles-loaded',
      roles: [ownerRole, editorRole, viewerRole],
    })
    expect(next.status).toBe('ready')
    expect(next.roles).toHaveLength(3)
    expect(next.error).toBeNull()
  })

  test('grants-loaded transitions to ready and replaces the grants list', () => {
    const state = createInitialTeamManagementState({ callerUserId: 'user-1' })
    const next = teamManagementReducer(state, {
      type: 'grants-loaded',
      grants: [ownerGrantAlpha, editorGrantAlpha],
    })
    expect(next.status).toBe('ready')
    expect(next.grants).toEqual([ownerGrantAlpha, editorGrantAlpha])
  })

  test('load-failed transitions to error and stashes the message', () => {
    const state = createInitialTeamManagementState({ callerUserId: 'user-1' })
    const next = teamManagementReducer(state, {
      type: 'load-failed',
      error: 'rbac-not-configured',
    })
    expect(next.status).toBe('error')
    expect(next.error).toBe('rbac-not-configured')
  })

  test('grant-revoked removes only the matching grant tuple', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [ownerGrantAlpha, editorGrantAlpha, viewerGrantBeta],
      error: null,
    }
    const next = teamManagementReducer(state, {
      type: 'grant-revoked',
      grant: editorGrantAlpha,
    })
    expect(next.grants).toHaveLength(2)
    expect(next.grants).toContain(ownerGrantAlpha)
    expect(next.grants).toContain(viewerGrantBeta)
    expect(next.grants).not.toContain(editorGrantAlpha)
  })

  test('grant-revoked is a no-op when no grant matches', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [ownerGrantAlpha],
      error: null,
    }
    const next = teamManagementReducer(state, {
      type: 'grant-revoked',
      grant: viewerGrantBeta,
    })
    expect(next.grants).toEqual([ownerGrantAlpha])
  })

  test('unknown action returns the same state reference', () => {
    const state = createInitialTeamManagementState({ callerUserId: 'user-1' })
    const next = teamManagementReducer(
      state,
      // @ts-expect-error — exercising the default branch
      { type: 'nope' },
    )
    expect(next).toBe(state)
  })
})

describe('grantKey + grantsMatch + actorRowKey', () => {
  test('grantKey is stable and unique across grant tuples', () => {
    expect(grantKey(ownerGrantAlpha)).toBe('owner:user:user-1:workspace:ws-alpha')
    expect(grantKey(globalOwnerGrant)).toBe('owner:user:user-1:global:*')
    expect(grantKey(ownerGrantAlpha)).not.toBe(grantKey(editorGrantAlpha))
  })

  test('grantsMatch ignores object identity and compares fields', () => {
    expect(grantsMatch(ownerGrantAlpha, { ...ownerGrantAlpha })).toBe(true)
    expect(grantsMatch(ownerGrantAlpha, editorGrantAlpha)).toBe(false)
    expect(grantsMatch(globalOwnerGrant, { ...globalOwnerGrant, scopeId: null })).toBe(true)
  })

  test('actorRowKey combines actorKind and actorId', () => {
    expect(actorRowKey('user', 'user-1')).toBe('user:user-1')
    expect(actorRowKey('team', 'team-builders')).toBe('team:team-builders')
  })
})

describe('selectActorRows', () => {
  test('groups grants by actor and exposes a stable display name', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [ownerRole, editorRole, viewerRole],
      grants: [ownerGrantAlpha, editorGrantAlpha, viewerGrantBeta, teamEditorGrant],
      error: null,
    }
    const rows = selectActorRows(state)
    expect(rows).toHaveLength(3)
    // users before teams, then ascending actorId
    expect(rows[0].actorKind).toBe('user')
    expect(rows[0].actorId).toBe('user-1')
    expect(rows[1].actorKind).toBe('user')
    expect(rows[1].actorId).toBe('user-2')
    expect(rows[2].actorKind).toBe('team')
    expect(rows[2].actorId).toBe('team-builders')
  })

  test('within an actor, grants are ordered by roleId then scope', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [ownerRole, editorRole],
      grants: [editorGrantAlpha, ownerGrantAlpha],
      error: null,
    }
    const [row] = selectActorRows(state)
    expect(row.grants).toHaveLength(2)
    // 'editor' < 'owner' alphabetically
    expect(row.grants[0].roleId).toBe('editor')
    expect(row.grants[1].roleId).toBe('owner')
  })

  test('uses the role catalogue to resolve roleName when present', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [editorRole],
      grants: [editorGrantAlpha],
      error: null,
    }
    const [row] = selectActorRows(state)
    expect(row.grants[0].roleName).toBe('Editor')
  })

  test('falls back to roleId when the catalogue is empty', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [editorGrantAlpha],
      error: null,
    }
    const [row] = selectActorRows(state)
    expect(row.grants[0].roleName).toBe('editor')
  })

  test('grant entries expose a composite React key', () => {
    const state: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [globalOwnerGrant],
      error: null,
    }
    const [row] = selectActorRows(state)
    expect(row.grants[0].key).toBe('owner:user:user-1:global:*')
  })
})

describe('selectActorCount + selectIsOwner', () => {
  test('selectActorCount counts distinct (actorKind, actorId) pairs', () => {
    const state: TeamManagementState = {
      callerUserId: null,
      status: 'ready',
      roles: [],
      grants: [ownerGrantAlpha, editorGrantAlpha, viewerGrantBeta, teamEditorGrant],
      error: null,
    }
    expect(selectActorCount(state)).toBe(3)
  })

  test('selectIsOwner mirrors RolesPanel semantics', () => {
    const baseState: TeamManagementState = {
      callerUserId: 'user-1',
      status: 'ready',
      roles: [],
      grants: [ownerGrantAlpha],
      error: null,
    }
    expect(selectIsOwner(baseState)).toBe(true)
    expect(selectIsOwner({ ...baseState, callerUserId: null })).toBe(false)
    expect(selectIsOwner({ ...baseState, grants: [editorGrantAlpha] })).toBe(false)
    expect(
      selectIsOwner({
        ...baseState,
        grants: [{ ...ownerGrantAlpha, actorId: 'someone-else' }],
      }),
    ).toBe(false)
  })
})
