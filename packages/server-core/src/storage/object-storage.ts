export const DEFAULT_USER_STORAGE_QUOTA_BYTES = 1024 ** 3
export const DEFAULT_TEAM_STORAGE_QUOTA_BYTES = 10 * 1024 ** 3

export type ObjectStorageTenantType = 'user' | 'team'

export interface ObjectStorageTenantScope {
  type: ObjectStorageTenantType
  id: string
  quotaBytes?: number
}

export interface ObjectStoragePutInput {
  bucket: string
  key: string
  body: Uint8Array
  contentType?: string
  metadata?: Record<string, string>
}

export interface ObjectStorageGetInput {
  bucket: string
  key: string
}

export interface ObjectStorageListInput {
  bucket: string
  prefix: string
}

export interface ObjectStorageDeleteInput {
  bucket: string
  key: string
}

export interface ObjectStorageObject {
  body: Uint8Array
  contentType?: string
  metadata: Record<string, string>
  sizeBytes: number
  updatedAt: string
}

export interface ObjectStorageListEntry {
  key: string
  sizeBytes: number
  updatedAt: string
}

export interface ObjectStorageAdapter {
  putObject(input: ObjectStoragePutInput): Promise<void>
  getObject(input: ObjectStorageGetInput): Promise<ObjectStorageObject | null>
  listObjects(input: ObjectStorageListInput): Promise<ObjectStorageListEntry[]>
  deleteObject(input: ObjectStorageDeleteInput): Promise<void>
}

export interface TenantObjectStorageEntry {
  logicalPath: string
  key: string
  sizeBytes: number
  updatedAt: string
}

export interface TenantObjectStorageUsage {
  usedBytes: number
  quotaBytes: number
}

export class ObjectStoragePathError extends Error {
  constructor(message = 'Invalid object storage path') {
    super(message)
    this.name = 'ObjectStoragePathError'
  }
}

export class ObjectStorageQuotaExceededError extends Error {
  readonly quotaBytes: number
  readonly attemptedBytes: number

  constructor(input: { quotaBytes: number; attemptedBytes: number }) {
    super('Object storage quota exceeded')
    this.name = 'ObjectStorageQuotaExceededError'
    this.quotaBytes = input.quotaBytes
    this.attemptedBytes = input.attemptedBytes
  }
}

interface StoredObject {
  body: Uint8Array
  contentType?: string
  metadata: Record<string, string>
  updatedAt: string
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

function copyObject(object: StoredObject): ObjectStorageObject {
  return {
    body: copyBytes(object.body),
    contentType: object.contentType,
    metadata: { ...object.metadata },
    sizeBytes: object.body.byteLength,
    updatedAt: object.updatedAt,
  }
}

export class InMemoryObjectStorageAdapter implements ObjectStorageAdapter {
  private readonly objectsByStorageKey = new Map<string, StoredObject>()

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    this.objectsByStorageKey.set(this.storageKey(input.bucket, input.key), {
      body: copyBytes(input.body),
      contentType: input.contentType,
      metadata: { ...(input.metadata ?? {}) },
      updatedAt: new Date().toISOString(),
    })
  }

  async getObject(input: ObjectStorageGetInput): Promise<ObjectStorageObject | null> {
    const object = this.objectsByStorageKey.get(this.storageKey(input.bucket, input.key))
    return object ? copyObject(object) : null
  }

  async listObjects(input: ObjectStorageListInput): Promise<ObjectStorageListEntry[]> {
    const bucketPrefix = `${input.bucket}:`
    const results: ObjectStorageListEntry[] = []

    for (const [storageKey, object] of this.objectsByStorageKey) {
      if (!storageKey.startsWith(bucketPrefix)) continue
      const key = storageKey.slice(bucketPrefix.length)
      if (!key.startsWith(input.prefix)) continue
      results.push({
        key,
        sizeBytes: object.body.byteLength,
        updatedAt: object.updatedAt,
      })
    }

    return results.sort((left, right) => left.key.localeCompare(right.key))
  }

  async deleteObject(input: ObjectStorageDeleteInput): Promise<void> {
    this.objectsByStorageKey.delete(this.storageKey(input.bucket, input.key))
  }

  private storageKey(bucket: string, key: string): string {
    return `${bucket}:${key}`
  }
}

export interface QuotaObjectStorageServiceOptions {
  adapter: ObjectStorageAdapter
  bucket: string
}

export class QuotaObjectStorageService {
  private readonly adapter: ObjectStorageAdapter
  private readonly bucket: string

  constructor(options: QuotaObjectStorageServiceOptions) {
    this.adapter = options.adapter
    this.bucket = options.bucket
  }

  async putObject(scope: ObjectStorageTenantScope, objectPath: string, body: Uint8Array, options: {
    contentType?: string
    metadata?: Record<string, string>
  } = {}): Promise<TenantObjectStorageEntry> {
    const key = this.createObjectKey(scope, objectPath)
    const usage = await this.getUsage(scope)
    const existing = await this.adapter.getObject({ bucket: this.bucket, key })
    const attemptedBytes = usage.usedBytes - (existing?.sizeBytes ?? 0) + body.byteLength

    if (attemptedBytes > usage.quotaBytes) {
      throw new ObjectStorageQuotaExceededError({
        quotaBytes: usage.quotaBytes,
        attemptedBytes,
      })
    }

    await this.adapter.putObject({
      bucket: this.bucket,
      key,
      body,
      contentType: options.contentType,
      metadata: options.metadata,
    })

    const stored = await this.adapter.getObject({ bucket: this.bucket, key })
    return {
      logicalPath: normalizeObjectPath(objectPath),
      key,
      sizeBytes: stored?.sizeBytes ?? body.byteLength,
      updatedAt: stored?.updatedAt ?? new Date().toISOString(),
    }
  }

  async getObject(scope: ObjectStorageTenantScope, objectPath: string): Promise<ObjectStorageObject | null> {
    return this.adapter.getObject({
      bucket: this.bucket,
      key: this.createObjectKey(scope, objectPath),
    })
  }

  async deleteObject(scope: ObjectStorageTenantScope, objectPath: string): Promise<void> {
    await this.adapter.deleteObject({
      bucket: this.bucket,
      key: this.createObjectKey(scope, objectPath),
    })
  }

  async listObjects(scope: ObjectStorageTenantScope): Promise<TenantObjectStorageEntry[]> {
    const prefix = createTenantPrefix(scope)
    const entries = await this.adapter.listObjects({ bucket: this.bucket, prefix })
    return entries.map(entry => ({
      logicalPath: entry.key.slice(prefix.length),
      key: entry.key,
      sizeBytes: entry.sizeBytes,
      updatedAt: entry.updatedAt,
    }))
  }

  async getUsage(scope: ObjectStorageTenantScope): Promise<TenantObjectStorageUsage> {
    const entries = await this.listObjects(scope)
    return {
      usedBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
      quotaBytes: resolveQuotaBytes(scope),
    }
  }

  private createObjectKey(scope: ObjectStorageTenantScope, objectPath: string): string {
    return `${createTenantPrefix(scope)}${normalizeObjectPath(objectPath)}`
  }
}

export function createTenantPrefix(scope: ObjectStorageTenantScope): string {
  const tenantId = normalizeTenantId(scope.id)
  return scope.type === 'user' ? `users/${tenantId}/` : `teams/${tenantId}/`
}

function resolveQuotaBytes(scope: ObjectStorageTenantScope): number {
  if (scope.quotaBytes !== undefined) {
    if (!Number.isSafeInteger(scope.quotaBytes) || scope.quotaBytes < 0) {
      throw new Error('Storage quota must be a non-negative safe integer')
    }
    return scope.quotaBytes
  }

  return scope.type === 'user' ? DEFAULT_USER_STORAGE_QUOTA_BYTES : DEFAULT_TEAM_STORAGE_QUOTA_BYTES
}

function normalizeTenantId(id: string): string {
  const trimmed = id.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
    throw new ObjectStoragePathError('Invalid object storage tenant id')
  }
  return trimmed
}

function normalizeObjectPath(objectPath: string): string {
  if (objectPath.length === 0 || objectPath === '.') {
    throw new ObjectStoragePathError()
  }
  if (objectPath.startsWith('/') || objectPath.includes('\\')) {
    throw new ObjectStoragePathError()
  }

  const segments = objectPath.split('/')
  if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new ObjectStoragePathError()
  }

  return segments.join('/')
}
