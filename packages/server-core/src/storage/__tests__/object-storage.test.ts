import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_TEAM_STORAGE_QUOTA_BYTES,
  DEFAULT_USER_STORAGE_QUOTA_BYTES,
  InMemoryObjectStorageAdapter,
  ObjectStoragePathError,
  ObjectStorageQuotaExceededError,
  QuotaObjectStorageService,
} from '../object-storage'

const bytes = (value: string) => new TextEncoder().encode(value)

describe('object storage quotas', () => {
  it('defines explicit user and team default quotas', () => {
    expect(DEFAULT_USER_STORAGE_QUOTA_BYTES).toBe(1024 ** 3)
    expect(DEFAULT_TEAM_STORAGE_QUOTA_BYTES).toBe(10 * 1024 ** 3)
  })

  it('checks quota before storing new objects and accounts for overwrites', async () => {
    const adapter = new InMemoryObjectStorageAdapter()
    const service = new QuotaObjectStorageService({
      adapter,
      bucket: 'agent-artifacts',
    })
    const scope = { type: 'user' as const, id: 'user-a', quotaBytes: 5 }

    await service.putObject(scope, 'notes/a.txt', bytes('hello'))

    await expect(service.putObject(scope, 'notes/b.txt', bytes('!'))).rejects.toBeInstanceOf(ObjectStorageQuotaExceededError)
    expect(await adapter.getObject({ bucket: 'agent-artifacts', key: 'users/user-a/notes/b.txt' })).toBeNull()

    await service.putObject(scope, 'notes/a.txt', bytes('hi'))
    await service.putObject(scope, 'notes/b.txt', bytes('hey'))

    expect((await service.getUsage(scope)).usedBytes).toBe(5)
  })

  it('rejects object paths that can escape the tenant prefix', async () => {
    const service = new QuotaObjectStorageService({
      adapter: new InMemoryObjectStorageAdapter(),
      bucket: 'agent-artifacts',
    })
    const scope = { type: 'user' as const, id: 'user-a' }

    for (const objectPath of ['../secret.txt', 'nested/../../secret.txt', '/secret.txt', 'folder\\secret.txt', '', '.']) {
      await expect(service.putObject(scope, objectPath, bytes('x'))).rejects.toBeInstanceOf(ObjectStoragePathError)
    }
  })

  it('isolates same logical object path across user and team tenants', async () => {
    const service = new QuotaObjectStorageService({
      adapter: new InMemoryObjectStorageAdapter(),
      bucket: 'agent-artifacts',
    })
    const userA = { type: 'user' as const, id: 'user-a' }
    const userB = { type: 'user' as const, id: 'user-b' }
    const teamA = { type: 'team' as const, id: 'team-a' }

    await service.putObject(userA, 'notes/shared.txt', bytes('user-a'))
    await service.putObject(userB, 'notes/shared.txt', bytes('user-b'))
    await service.putObject(teamA, 'notes/shared.txt', bytes('team-a'))

    expect(new TextDecoder().decode((await service.getObject(userA, 'notes/shared.txt'))!.body)).toBe('user-a')
    expect(new TextDecoder().decode((await service.getObject(userB, 'notes/shared.txt'))!.body)).toBe('user-b')
    expect(new TextDecoder().decode((await service.getObject(teamA, 'notes/shared.txt'))!.body)).toBe('team-a')

    expect((await service.listObjects(userA)).map(object => object.logicalPath)).toEqual(['notes/shared.txt'])

    await service.deleteObject(userA, 'notes/shared.txt')

    expect(await service.getObject(userA, 'notes/shared.txt')).toBeNull()
    expect(new TextDecoder().decode((await service.getObject(userB, 'notes/shared.txt'))!.body)).toBe('user-b')
  })
})
