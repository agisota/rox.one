import { describe, expect, it } from 'bun:test'
import {
  createStorageBucketRecord,
  createTeamSpaceStoragePrefix,
  DEFAULT_TEAM_STORAGE_QUOTA_BYTES,
  DEFAULT_S3_ENDPOINT_CANDIDATES,
  DEFAULT_USER_STORAGE_QUOTA_BYTES,
  InMemoryObjectStorageAdapter,
  ObjectStoragePathError,
  ObjectStorageQuotaExceededError,
  QuotaObjectStorageService,
  resolveS3EndpointPreference,
  toStorageStatusDto,
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

describe('s3-compatible storage boundary', () => {
  it('prefers s3.max before falling back to s3.rox through a fake health probe', async () => {
    expect(DEFAULT_S3_ENDPOINT_CANDIDATES).toEqual(['http://s3.max:9000', 'http://s3.rox:9000'])

    const preference = await resolveS3EndpointPreference({
      probe: async endpoint => endpoint === 'http://s3.rox:9000',
    })

    expect(preference.activeEndpoint).toBe('http://s3.rox:9000')
    expect(preference.status).toBe('healthy')
    expect(preference.candidates).toEqual([
      { endpoint: 'http://s3.max:9000', healthy: false, selected: false },
      { endpoint: 'http://s3.rox:9000', healthy: true, selected: true },
    ])
  })

  it('reports an unhealthy backend without leaking renderer credentials', async () => {
    const preference = await resolveS3EndpointPreference({
      probe: async () => false,
    })
    const record = createStorageBucketRecord({
      ownerType: 'team',
      ownerId: 'Team_A',
      endpoint: preference.activeEndpoint,
    })
    const dto = toStorageStatusDto({
      record,
      endpointPreference: preference,
      usedBytes: 512,
    })

    expect(preference.status).toBe('unhealthy')
    expect(dto).toMatchObject({
      ownerType: 'team',
      ownerId: 'Team_A',
      bucket: 'rox-team-team-a',
      prefix: 'teams/Team_A/',
      endpoint: null,
      endpointStatus: 'unhealthy',
      usedBytes: 512,
      quotaBytes: DEFAULT_TEAM_STORAGE_QUOTA_BYTES,
    })
    expect(JSON.stringify(dto)).not.toContain('secret')
    expect(JSON.stringify(dto)).not.toContain('accessKey')
    expect(JSON.stringify(dto)).not.toContain('credential')
  })

  it('creates user and team bucket records with scoped prefixes and default quotas', () => {
    expect(createStorageBucketRecord({ ownerType: 'user', ownerId: 'user-a' })).toMatchObject({
      ownerType: 'user',
      ownerId: 'user-a',
      bucket: 'rox-user-user-a',
      prefix: 'users/user-a/',
      quotaBytes: DEFAULT_USER_STORAGE_QUOTA_BYTES,
    })
    expect(createStorageBucketRecord({ ownerType: 'team', ownerId: 'team-a' })).toMatchObject({
      ownerType: 'team',
      ownerId: 'team-a',
      bucket: 'rox-team-team-a',
      prefix: 'teams/team-a/',
      quotaBytes: DEFAULT_TEAM_STORAGE_QUOTA_BYTES,
    })
  })

  it('maps team spaces to validated prefixes inside the team bucket', () => {
    expect(createTeamSpaceStoragePrefix('team-a', 'release-1')).toBe('teams/team-a/spaces/release-1/')

    for (const unsafeSpaceId of ['../other', '/other', 'nested/other', '', '.']) {
      expect(() => createTeamSpaceStoragePrefix('team-a', unsafeSpaceId)).toThrow(ObjectStoragePathError)
    }
  })
})
