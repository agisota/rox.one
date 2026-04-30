import { describe, expect, it } from 'bun:test'
import {
  canAccessCloudWorkspace,
  createCloudSessionBoundary,
  createLocalSessionBoundary,
} from '../account-session-boundary'

describe('account session boundary', () => {
  it('keeps legacy local sessions outside the cloud boundary', () => {
    const boundary = createLocalSessionBoundary()

    expect(boundary).toEqual({
      mode: 'local',
      cloud: false,
      userId: null,
      sessionId: null,
      email: null,
      role: null,
      workspaceIds: [],
    })
    expect(canAccessCloudWorkspace(boundary, 'workspace-a')).toBe(false)
  })

  it('creates a defensive cloud session model scoped to explicit workspaces', () => {
    const boundary = createCloudSessionBoundary(
      {
        userId: 'user-a',
        sessionId: 'session-a',
        email: 'User@Example.com',
        displayName: 'User',
        role: 'admin',
      },
      ['workspace-b', 'workspace-a', 'workspace-a'],
    )

    expect(boundary).toEqual({
      mode: 'cloud',
      cloud: true,
      userId: 'user-a',
      sessionId: 'session-a',
      email: 'user@example.com',
      role: 'admin',
      workspaceIds: ['workspace-a', 'workspace-b'],
    })
    expect(canAccessCloudWorkspace(boundary, 'workspace-a')).toBe(true)
    expect(canAccessCloudWorkspace(boundary, 'workspace-missing')).toBe(false)

    boundary.workspaceIds.push('mutated')
    expect(canAccessCloudWorkspace(createCloudSessionBoundary({
      userId: 'user-a',
      sessionId: 'session-a',
      email: 'user@example.com',
      displayName: null,
      role: 'admin',
    }, ['workspace-a']), 'mutated')).toBe(false)
  })

  it('does not grant implicit workspace access from account role alone', () => {
    const boundary = createCloudSessionBoundary(
      {
        userId: 'admin-user',
        sessionId: 'session-admin',
        email: 'admin@example.com',
        displayName: null,
        role: 'admin',
      },
      [],
    )

    expect(canAccessCloudWorkspace(boundary, 'workspace-a')).toBe(false)
  })
})
