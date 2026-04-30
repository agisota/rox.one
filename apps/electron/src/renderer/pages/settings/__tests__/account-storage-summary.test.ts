import { describe, expect, it } from 'bun:test'
import {
  formatStorageBytes,
  summarizeAccountStorage,
  type AccountStorageResponse,
} from '../account-storage-summary'

describe('account storage summary', () => {
  it('formats bytes for compact account storage rows', () => {
    expect(formatStorageBytes(0)).toBe('0 B')
    expect(formatStorageBytes(512)).toBe('512 B')
    expect(formatStorageBytes(1024 ** 2)).toBe('1 MB')
    expect(formatStorageBytes(1.5 * 1024 ** 3)).toBe('1.5 GB')
  })

  it('summarizes user and team buckets without exposing endpoint secrets', () => {
    const storage: AccountStorageResponse = {
      endpointStatus: 'healthy',
      activeEndpoint: 'http://s3.max:9000',
      buckets: [
        {
          ownerType: 'user',
          ownerId: 'user-a',
          bucket: 'rox-user-user-a',
          prefix: 'users/user-a/',
          endpoint: 'http://s3.max:9000',
          endpointStatus: 'healthy',
          usedBytes: 512,
          quotaBytes: 1024,
        },
        {
          ownerType: 'team',
          ownerId: 'team-a',
          bucket: 'rox-team-team-a',
          prefix: 'teams/team-a/',
          endpoint: 'http://s3.max:9000',
          endpointStatus: 'healthy',
          usedBytes: 1024 ** 3,
          quotaBytes: 10 * 1024 ** 3,
        },
      ],
    }

    const summary = summarizeAccountStorage(storage)

    expect(summary).toEqual({
      endpointLabel: 'S3: healthy / http://s3.max:9000',
      totalUsedLabel: '1 GB used',
      totalQuotaLabel: '10 GB quota',
      rows: [
        {
          label: 'User bucket',
          description: 'rox-user-user-a / users/user-a/ / 512 B of 1 KB',
        },
        {
          label: 'Team bucket',
          description: 'rox-team-team-a / teams/team-a/ / 1 GB of 10 GB',
        },
      ],
    })
    expect(JSON.stringify(summary)).not.toContain('secret')
    expect(JSON.stringify(summary)).not.toContain('accessKey')
  })

  it('keeps empty and unhealthy storage states explicit', () => {
    expect(summarizeAccountStorage(null)).toEqual({
      endpointLabel: 'S3: unavailable',
      totalUsedLabel: '0 B used',
      totalQuotaLabel: '0 B quota',
      rows: [{ label: 'Storage unavailable', description: 'Backend storage status has not loaded yet.' }],
    })

    expect(summarizeAccountStorage({ endpointStatus: 'unhealthy', activeEndpoint: null, buckets: [] })).toEqual({
      endpointLabel: 'S3: unhealthy',
      totalUsedLabel: '0 B used',
      totalQuotaLabel: '0 B quota',
      rows: [{ label: 'No buckets', description: 'No user or team storage buckets are available.' }],
    })
  })
})
