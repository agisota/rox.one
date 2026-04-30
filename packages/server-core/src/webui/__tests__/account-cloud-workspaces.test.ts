import { describe, expect, it } from 'bun:test'
import {
  InMemoryManagedCloudWorkspaceStore,
  ManagedCloudWorkspaceAccessError,
} from '../account-cloud-workspaces'

describe('managed cloud workspaces', () => {
  it('creates active private cloud workspace metadata with a stable storage prefix', async () => {
    const store = new InMemoryManagedCloudWorkspaceStore()

    const workspace = await store.createWorkspace({
      ownerUserId: 'user-a',
      name: '  Research Ops  ',
    })

    expect(workspace).toMatchObject({
      name: 'Research Ops',
      slug: 'research-ops',
      ownerUserId: 'user-a',
      status: 'active',
      visibility: 'private',
      storage: {
        bucket: 'agent-artifacts',
        prefix: `managed-workspaces/${workspace.id}/`,
      },
    })
    expect(workspace.createdAt).toBe(workspace.updatedAt)
    expect(workspace.archivedAt).toBeNull()
  })

  it('lists and reads only workspaces owned by the actor', async () => {
    const store = new InMemoryManagedCloudWorkspaceStore()
    const first = await store.createWorkspace({ ownerUserId: 'user-a', name: 'First' })
    await store.createWorkspace({ ownerUserId: 'user-b', name: 'Other' })

    expect((await store.listWorkspaces('user-a')).map(workspace => workspace.id)).toEqual([first.id])
    expect(await store.getWorkspaceForUser('user-a', first.id)).toMatchObject({ id: first.id, ownerUserId: 'user-a' })
    await expect(store.getWorkspaceForUser('user-b', first.id)).rejects.toBeInstanceOf(ManagedCloudWorkspaceAccessError)
  })

  it('rejects invalid names before creating workspace metadata', async () => {
    const store = new InMemoryManagedCloudWorkspaceStore()

    await expect(store.createWorkspace({ ownerUserId: 'user-a', name: '   ' })).rejects.toThrow('Workspace name is required')
    expect(await store.listWorkspaces('user-a')).toEqual([])
  })

  it('returns defensive copies of workspace metadata', async () => {
    const store = new InMemoryManagedCloudWorkspaceStore()
    const workspace = await store.createWorkspace({ ownerUserId: 'user-a', name: 'Mutable' })

    workspace.name = 'mutated'
    workspace.storage.prefix = 'mutated/'

    expect(await store.getWorkspaceForUser('user-a', workspace.id)).toMatchObject({
      name: 'Mutable',
      storage: { prefix: `managed-workspaces/${workspace.id}/` },
    })
  })
})
