import { describe, expect, it } from 'bun:test'
import {
  InMemorySyncFileStore,
  LocalCloudSyncConflictError,
  LocalCloudSyncEngine,
  LocalCloudSyncPathError,
  EMPTY_SYNC_SNAPSHOT,
} from '../local-cloud-sync'

const bytes = (value: string) => new TextEncoder().encode(value)
const text = (value: Uint8Array | null) => value ? new TextDecoder().decode(value) : null

describe('local-cloud sync MVP', () => {
  it('pushes local files to cloud explicitly and becomes idempotent after base snapshot update', async () => {
    const local = new InMemorySyncFileStore({
      'notes/a.md': bytes('alpha'),
      'notes/b.md': bytes('beta'),
    })
    const cloud = new InMemorySyncFileStore()
    const engine = new LocalCloudSyncEngine({ local, cloud })

    const first = await engine.pushLocalToCloud(EMPTY_SYNC_SNAPSHOT)

    expect(first.conflicts).toEqual([])
    expect(first.operations.map(operation => `${operation.type}:${operation.path}`)).toEqual([
      'write:notes/a.md',
      'write:notes/b.md',
    ])
    expect(text(await cloud.readFile('notes/a.md'))).toBe('alpha')
    expect(text(await cloud.readFile('notes/b.md'))).toBe('beta')

    const second = await engine.pushLocalToCloud(first.nextBaseSnapshot)

    expect(second.operations).toEqual([])
    expect(second.conflicts).toEqual([])
  })

  it('does not silently overwrite cloud edits when local changed from the same base', async () => {
    const local = new InMemorySyncFileStore({ 'notes/a.md': bytes('base') })
    const cloud = new InMemorySyncFileStore({ 'notes/a.md': bytes('base') })
    const engine = new LocalCloudSyncEngine({ local, cloud })
    const base = await engine.captureSnapshot(local)

    await local.writeFile('notes/a.md', bytes('local edit'))
    await cloud.writeFile('notes/a.md', bytes('cloud edit'))

    await expect(engine.pushLocalToCloud(base)).rejects.toBeInstanceOf(LocalCloudSyncConflictError)
    expect(text(await cloud.readFile('notes/a.md'))).toBe('cloud edit')
  })

  it('pulls cloud deletions only when local has not changed from base', async () => {
    const local = new InMemorySyncFileStore({ 'notes/a.md': bytes('base'), 'notes/b.md': bytes('keep') })
    const cloud = new InMemorySyncFileStore({ 'notes/a.md': bytes('base'), 'notes/b.md': bytes('keep') })
    const engine = new LocalCloudSyncEngine({ local, cloud })
    const base = await engine.captureSnapshot(local)

    await cloud.deleteFile('notes/a.md')

    const result = await engine.pullCloudToLocal(base)

    expect(result.conflicts).toEqual([])
    expect(result.operations).toEqual([
      { type: 'delete', path: 'notes/a.md' },
    ])
    expect(await local.readFile('notes/a.md')).toBeNull()
    expect(text(await local.readFile('notes/b.md'))).toBe('keep')
  })

  it('reports conflicts instead of deleting divergent local files during pull', async () => {
    const local = new InMemorySyncFileStore({ 'notes/a.md': bytes('base') })
    const cloud = new InMemorySyncFileStore({ 'notes/a.md': bytes('base') })
    const engine = new LocalCloudSyncEngine({ local, cloud })
    const base = await engine.captureSnapshot(local)

    await local.writeFile('notes/a.md', bytes('local edit'))
    await cloud.deleteFile('notes/a.md')

    await expect(engine.pullCloudToLocal(base)).rejects.toBeInstanceOf(LocalCloudSyncConflictError)
    expect(text(await local.readFile('notes/a.md'))).toBe('local edit')
  })

  it('rejects unsafe paths before they can enter snapshots or stores', async () => {
    const store = new InMemorySyncFileStore()

    for (const path of ['../secret.txt', '/secret.txt', 'nested/../../secret.txt', 'folder\\secret.txt', '', '.']) {
      expect(() => store.setInitialFile(path, bytes('x'))).toThrow(LocalCloudSyncPathError)
      await expect(store.writeFile(path, bytes('x'))).rejects.toBeInstanceOf(LocalCloudSyncPathError)
    }
  })
})
