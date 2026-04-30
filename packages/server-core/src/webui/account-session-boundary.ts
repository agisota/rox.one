import type { AccountRole, SessionIdentity } from '../accounts'

export interface LocalSessionBoundary {
  mode: 'local'
  cloud: false
  userId: null
  sessionId: null
  email: null
  role: null
  workspaceIds: []
}

export interface CloudSessionBoundary {
  mode: 'cloud'
  cloud: true
  userId: string
  sessionId: string
  email: string
  role: AccountRole
  workspaceIds: string[]
}

export type AccountSessionBoundary = LocalSessionBoundary | CloudSessionBoundary

function normalizeWorkspaceIds(workspaceIds: string[]): string[] {
  return [...new Set(workspaceIds.map(id => id.trim()).filter(Boolean))].sort()
}

export function createLocalSessionBoundary(): LocalSessionBoundary {
  return {
    mode: 'local',
    cloud: false,
    userId: null,
    sessionId: null,
    email: null,
    role: null,
    workspaceIds: [],
  }
}

export function createCloudSessionBoundary(identity: SessionIdentity, workspaceIds: string[]): CloudSessionBoundary {
  return {
    mode: 'cloud',
    cloud: true,
    userId: identity.userId,
    sessionId: identity.sessionId,
    email: identity.email.trim().toLowerCase(),
    role: identity.role,
    workspaceIds: normalizeWorkspaceIds(workspaceIds),
  }
}

export function canAccessCloudWorkspace(boundary: AccountSessionBoundary, workspaceId: string): boolean {
  if (boundary.mode !== 'cloud') return false
  const normalizedWorkspaceId = workspaceId.trim()
  if (!normalizedWorkspaceId) return false
  return boundary.workspaceIds.includes(normalizedWorkspaceId)
}
