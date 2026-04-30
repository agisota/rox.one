import { randomUUID } from 'node:crypto'

export type ManagedCloudWorkspaceStatus = 'active' | 'archived'
export type ManagedCloudWorkspaceVisibility = 'private'

export interface ManagedCloudWorkspaceStorage {
  bucket: string
  prefix: string
}

export interface ManagedCloudWorkspace {
  id: string
  name: string
  slug: string
  ownerUserId: string
  status: ManagedCloudWorkspaceStatus
  visibility: ManagedCloudWorkspaceVisibility
  storage: ManagedCloudWorkspaceStorage
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface CreateManagedCloudWorkspaceInput {
  ownerUserId: string
  name: string
  bucket?: string
}

export interface ManagedCloudWorkspaceStore {
  createWorkspace(input: CreateManagedCloudWorkspaceInput): Promise<ManagedCloudWorkspace>
  listWorkspaces(userId: string): Promise<ManagedCloudWorkspace[]>
  getWorkspaceForUser(userId: string, workspaceId: string): Promise<ManagedCloudWorkspace>
}

export class ManagedCloudWorkspaceAccessError extends Error {
  constructor(message = 'Workspace is not available for this account') {
    super(message)
    this.name = 'ManagedCloudWorkspaceAccessError'
  }
}

function copyWorkspace(workspace: ManagedCloudWorkspace): ManagedCloudWorkspace {
  return {
    ...workspace,
    storage: { ...workspace.storage },
  }
}

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error('Workspace name is required')
  return normalized
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'workspace'
}

export class InMemoryManagedCloudWorkspaceStore implements ManagedCloudWorkspaceStore {
  private readonly workspacesById = new Map<string, ManagedCloudWorkspace>()
  private readonly workspaceIdsByOwnerUserId = new Map<string, Set<string>>()

  async createWorkspace(input: CreateManagedCloudWorkspaceInput): Promise<ManagedCloudWorkspace> {
    const ownerUserId = input.ownerUserId.trim()
    if (!ownerUserId) throw new Error('Workspace owner is required')

    const name = normalizeName(input.name)
    const id = randomUUID()
    const now = new Date().toISOString()
    const workspace: ManagedCloudWorkspace = {
      id,
      name,
      slug: this.createUniqueSlug(slugify(name)),
      ownerUserId,
      status: 'active',
      visibility: 'private',
      storage: {
        bucket: input.bucket?.trim() || 'agent-artifacts',
        prefix: `managed-workspaces/${id}/`,
      },
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }

    this.workspacesById.set(workspace.id, workspace)
    const ownerWorkspaceIds = this.workspaceIdsByOwnerUserId.get(ownerUserId) ?? new Set<string>()
    ownerWorkspaceIds.add(workspace.id)
    this.workspaceIdsByOwnerUserId.set(ownerUserId, ownerWorkspaceIds)

    return copyWorkspace(workspace)
  }

  async listWorkspaces(userId: string): Promise<ManagedCloudWorkspace[]> {
    const workspaceIds = this.workspaceIdsByOwnerUserId.get(userId.trim()) ?? new Set<string>()
    return [...workspaceIds]
      .map(id => this.workspacesById.get(id))
      .filter((workspace): workspace is ManagedCloudWorkspace => Boolean(workspace))
      .filter(workspace => workspace.status === 'active')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(copyWorkspace)
  }

  async getWorkspaceForUser(userId: string, workspaceId: string): Promise<ManagedCloudWorkspace> {
    const workspace = this.workspacesById.get(workspaceId.trim())
    if (!workspace || workspace.ownerUserId !== userId.trim() || workspace.status !== 'active') {
      throw new ManagedCloudWorkspaceAccessError()
    }
    return copyWorkspace(workspace)
  }

  private createUniqueSlug(baseSlug: string): string {
    const existingSlugs = new Set([...this.workspacesById.values()].map(workspace => workspace.slug))
    if (!existingSlugs.has(baseSlug)) return baseSlug

    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${baseSlug}-${suffix}`
      if (!existingSlugs.has(candidate)) return candidate
    }
  }
}
