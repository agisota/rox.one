export type AccountStorageEndpointStatus = 'healthy' | 'unhealthy'

export interface AccountStorageBucket {
  ownerType: 'user' | 'team'
  ownerId: string
  bucket: string
  prefix: string
  endpoint: string | null
  endpointStatus: AccountStorageEndpointStatus
  usedBytes: number
  quotaBytes: number
}

export interface AccountStorageResponse {
  endpointStatus: AccountStorageEndpointStatus
  activeEndpoint: string | null
  buckets: AccountStorageBucket[]
}

export interface AccountStorageSummaryRow {
  label: string
  description: string
}

export interface AccountStorageSummary {
  endpointLabel: string
  totalUsedLabel: string
  totalQuotaLabel: string
  rows: AccountStorageSummaryRow[]
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const roundedValue = Math.round(value * 10) / 10
  const rounded = Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : roundedValue.toFixed(1)
  return `${rounded} ${units[unitIndex]}`
}

export function summarizeAccountStorage(storage: AccountStorageResponse | null): AccountStorageSummary {
  if (!storage) {
    return {
      endpointLabel: 'S3: unavailable',
      totalUsedLabel: '0 B used',
      totalQuotaLabel: '0 B quota',
      rows: [{ label: 'Storage unavailable', description: 'Backend storage status has not loaded yet.' }],
    }
  }

  const usedBytes = storage.buckets.reduce((sum, bucket) => sum + bucket.usedBytes, 0)
  const quotaBytes = storage.buckets.reduce((sum, bucket) => sum + bucket.quotaBytes, 0)

  return {
    endpointLabel: storage.activeEndpoint
      ? `S3: ${storage.endpointStatus} / ${storage.activeEndpoint}`
      : `S3: ${storage.endpointStatus}`,
    totalUsedLabel: `${formatStorageBytes(usedBytes)} used`,
    totalQuotaLabel: `${formatStorageBytes(quotaBytes)} quota`,
    rows: storage.buckets.length
      ? storage.buckets.map(bucket => ({
        label: bucket.ownerType === 'user' ? 'User bucket' : 'Team bucket',
        description: `${bucket.bucket} / ${bucket.prefix} / ${formatStorageBytes(bucket.usedBytes)} of ${formatStorageBytes(bucket.quotaBytes)}`,
      }))
      : [{ label: 'No buckets', description: 'No user or team storage buckets are available.' }],
  }
}
