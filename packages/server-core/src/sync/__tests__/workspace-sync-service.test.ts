import { describe, expect, it } from 'bun:test'
import { EMPTY_SYNC_SNAPSHOT } from '../local-cloud-sync'
import {
  InMemoryWorkspaceSyncService,
  WorkspaceSyncConflictError,
} from '../workspace-sync-service'
import type { ManagedCloudWorkspace } from '../../webui/account-cloud-workspaces'

const bytes = (value: string) => new TextEncoder().encode(value)
const decode = (value: string) => new TextDecoder().decode(Uint8Array.fromBase64(value))
const file = (path: string, value: string) => ({ path, contentBase64: bytes(value).toBase64() })

function workspace(id = 'workspace-a'): ManagedCloudWorkspace {
  return {
    id,
    name: 'Workspace A',
    slug: 'workspace-a',
    ownerUserId: 'user-a',
    teamId: null,
    status: 'active',
    visibility: 'private',
    storage: {
      bucket: 'agent-artifacts',
      prefix: `managed-workspaces/${id}/`,
    },
    createdAt: '2026-05-05T00:00:00.000Z',
    updatedAt: '2026-05-05T00:00:00.000Z',
    archivedAt: null,
  }
}

describe('workspace sync service', () => {
  it('pushes local files into a workspace cloud store and records idempotent operations', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const target = workspace()

    const first = await service.push({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'op-1',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('notes/a.md', 'alpha'),
      ],
    })

    expect(first.idempotentReplay).toBe(false)
    expect(first.operations).toEqual([{ type: 'write', path: 'notes/a.md' }])
    expect(first.files.map(entry => ({ path: entry.path, text: decode(entry.contentBase64) }))).toEqual([
      { path: 'notes/a.md', text: 'alpha' },
    ])

    const replay = await service.push({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'op-1',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('notes/a.md', 'alpha changed but ignored by idempotency'),
      ],
    })

    expect(replay.idempotentReplay).toBe(true)
    expect(replay.files.map(entry => ({ path: entry.path, text: decode(entry.contentBase64) }))).toEqual([
      { path: 'notes/a.md', text: 'alpha' },
    ])

    const operations = await service.listOperations({ actorUserId: 'user-a', workspace: target })
    expect(operations.operations.map(operation => operation.operationId)).toEqual(['op-1'])
  })

  it('pulls cloud files back into the provided local file set', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const target = workspace('workspace-pull')

    const push = await service.push({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'push-1',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('notes/a.md', 'cloud'),
      ],
    })

    const pull = await service.pull({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'pull-1',
      baseSnapshot: push.nextBaseSnapshot,
      files: [
        file('notes/a.md', 'cloud'),
      ],
    })

    expect(pull.operations).toEqual([])
    expect(pull.files.map(entry => ({ path: entry.path, text: decode(entry.contentBase64) }))).toEqual([
      { path: 'notes/a.md', text: 'cloud' },
    ])
  })

  it('raises conflicts instead of overwriting divergent workspace cloud files', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const target = workspace('workspace-conflict')

    const basePush = await service.push({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('notes/a.md', 'base'),
      ],
    })

    await service.push({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'cloud-edit',
      baseSnapshot: basePush.nextBaseSnapshot,
      files: [
        file('notes/a.md', 'cloud edit'),
      ],
    })

    await expect(service.push({
      actorUserId: 'user-a',
      workspace: target,
      operationId: 'local-edit',
      baseSnapshot: basePush.nextBaseSnapshot,
      files: [
        file('notes/a.md', 'local edit'),
      ],
    })).rejects.toBeInstanceOf(WorkspaceSyncConflictError)
  })
})
