import { createHash } from 'node:crypto'

export interface SyncFileEntry {
  path: string
  sha256: string
  sizeBytes: number
}

export interface SyncSnapshot {
  version: 1
  files: SyncFileEntry[]
}

export type SyncOperationType = 'write' | 'delete'

export interface SyncOperation {
  type: SyncOperationType
  path: string
}

export interface SyncConflict {
  path: string
  reason: string
}

export interface SyncResult {
  operations: SyncOperation[]
  conflicts: SyncConflict[]
  nextBaseSnapshot: SyncSnapshot
}

export interface SyncFileStore {
  listFiles(): Promise<SyncFileEntry[]>
  readFile(path: string): Promise<Uint8Array | null>
  writeFile(path: string, body: Uint8Array): Promise<void>
  deleteFile(path: string): Promise<void>
}

export const EMPTY_SYNC_SNAPSHOT: SyncSnapshot = {
  version: 1,
  files: [],
}

export class LocalCloudSyncPathError extends Error {
  constructor(message = 'Invalid sync file path') {
    super(message)
    this.name = 'LocalCloudSyncPathError'
  }
}

export class LocalCloudSyncConflictError extends Error {
  readonly conflicts: SyncConflict[]

  constructor(conflicts: SyncConflict[]) {
    super('Local-cloud sync conflict')
    this.name = 'LocalCloudSyncConflictError'
    this.conflicts = conflicts
  }
}

interface StoredSyncFile {
  body: Uint8Array
}

interface SnapshotChange {
  type: SyncOperationType
  path: string
  entry: SyncFileEntry | null
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function copySnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  return {
    version: 1,
    files: snapshot.files
      .map(file => ({ ...file }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function entriesByPath(snapshot: SyncSnapshot): Map<string, SyncFileEntry> {
  return new Map(snapshot.files.map(file => [normalizeSyncPath(file.path), { ...file, path: normalizeSyncPath(file.path) }]))
}

function diffSnapshots(base: SyncSnapshot, current: SyncSnapshot): SnapshotChange[] {
  const baseByPath = entriesByPath(base)
  const currentByPath = entriesByPath(current)
  const paths = [...new Set([...baseByPath.keys(), ...currentByPath.keys()])].sort()
  const changes: SnapshotChange[] = []

  for (const path of paths) {
    const baseEntry = baseByPath.get(path)
    const currentEntry = currentByPath.get(path)
    if (!currentEntry && baseEntry) {
      changes.push({ type: 'delete', path, entry: null })
      continue
    }
    if (currentEntry && (!baseEntry || currentEntry.sha256 !== baseEntry.sha256 || currentEntry.sizeBytes !== baseEntry.sizeBytes)) {
      changes.push({ type: 'write', path, entry: currentEntry })
    }
  }

  return changes
}

function changedFromBase(baseByPath: Map<string, SyncFileEntry>, currentByPath: Map<string, SyncFileEntry>, path: string): boolean {
  const baseEntry = baseByPath.get(path)
  const currentEntry = currentByPath.get(path)
  if (!baseEntry && !currentEntry) return false
  if (!baseEntry || !currentEntry) return true
  return baseEntry.sha256 !== currentEntry.sha256 || baseEntry.sizeBytes !== currentEntry.sizeBytes
}

function sameEntry(left: SyncFileEntry | undefined, right: SyncFileEntry | undefined): boolean {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.sha256 === right.sha256 && left.sizeBytes === right.sizeBytes
}

function detectConflicts(input: {
  sourceChanges: SnapshotChange[]
  base: SyncSnapshot
  source: SyncSnapshot
  target: SyncSnapshot
  sourceLabel: string
  targetLabel: string
}): SyncConflict[] {
  const baseByPath = entriesByPath(input.base)
  const sourceByPath = entriesByPath(input.source)
  const targetByPath = entriesByPath(input.target)
  const conflicts: SyncConflict[] = []

  for (const change of input.sourceChanges) {
    if (!changedFromBase(baseByPath, targetByPath, change.path)) continue
    if (sameEntry(sourceByPath.get(change.path), targetByPath.get(change.path))) continue
    conflicts.push({
      path: change.path,
      reason: `${input.sourceLabel} and ${input.targetLabel} both changed since the base snapshot`,
    })
  }

  return conflicts
}

async function applyChanges(source: SyncFileStore, target: SyncFileStore, changes: SnapshotChange[]): Promise<SyncOperation[]> {
  const operations: SyncOperation[] = []
  for (const change of changes) {
    if (change.type === 'delete') {
      await target.deleteFile(change.path)
      operations.push({ type: 'delete', path: change.path })
      continue
    }

    const body = await source.readFile(change.path)
    if (!body) {
      throw new Error(`Source file disappeared during sync: ${change.path}`)
    }
    await target.writeFile(change.path, body)
    operations.push({ type: 'write', path: change.path })
  }
  return operations
}

export class InMemorySyncFileStore implements SyncFileStore {
  private readonly files = new Map<string, StoredSyncFile>()

  constructor(initialFiles: Record<string, Uint8Array> = {}) {
    for (const [path, body] of Object.entries(initialFiles)) {
      this.setInitialFile(path, body)
    }
  }

  setInitialFile(path: string, body: Uint8Array): void {
    this.files.set(normalizeSyncPath(path), { body: copyBytes(body) })
  }

  async listFiles(): Promise<SyncFileEntry[]> {
    return [...this.files.entries()]
      .map(([path, file]) => ({
        path,
        sha256: hashBytes(file.body),
        sizeBytes: file.body.byteLength,
      }))
      .sort((left, right) => left.path.localeCompare(right.path))
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    const file = this.files.get(normalizeSyncPath(path))
    return file ? copyBytes(file.body) : null
  }

  async writeFile(path: string, body: Uint8Array): Promise<void> {
    this.files.set(normalizeSyncPath(path), { body: copyBytes(body) })
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(normalizeSyncPath(path))
  }
}

export class LocalCloudSyncEngine {
  private readonly local: SyncFileStore
  private readonly cloud: SyncFileStore

  constructor(options: { local: SyncFileStore; cloud: SyncFileStore }) {
    this.local = options.local
    this.cloud = options.cloud
  }

  async captureSnapshot(store: SyncFileStore): Promise<SyncSnapshot> {
    const files = await store.listFiles()
    return copySnapshot({
      version: 1,
      files: files.map(file => ({
        path: normalizeSyncPath(file.path),
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
      })),
    })
  }

  async pushLocalToCloud(baseSnapshot: SyncSnapshot): Promise<SyncResult> {
    return this.sync({
      baseSnapshot,
      source: this.local,
      target: this.cloud,
      sourceLabel: 'local',
      targetLabel: 'cloud',
    })
  }

  async pullCloudToLocal(baseSnapshot: SyncSnapshot): Promise<SyncResult> {
    return this.sync({
      baseSnapshot,
      source: this.cloud,
      target: this.local,
      sourceLabel: 'cloud',
      targetLabel: 'local',
    })
  }

  private async sync(input: {
    baseSnapshot: SyncSnapshot
    source: SyncFileStore
    target: SyncFileStore
    sourceLabel: string
    targetLabel: string
  }): Promise<SyncResult> {
    const base = copySnapshot(input.baseSnapshot)
    const sourceSnapshot = await this.captureSnapshot(input.source)
    const targetSnapshot = await this.captureSnapshot(input.target)
    const sourceChanges = diffSnapshots(base, sourceSnapshot)
    const conflicts = detectConflicts({
      sourceChanges,
      base,
      source: sourceSnapshot,
      target: targetSnapshot,
      sourceLabel: input.sourceLabel,
      targetLabel: input.targetLabel,
    })

    if (conflicts.length > 0) {
      throw new LocalCloudSyncConflictError(conflicts)
    }

    const operations = await applyChanges(input.source, input.target, sourceChanges)
    const nextBaseSnapshot = await this.captureSnapshot(input.source)

    return {
      operations,
      conflicts: [],
      nextBaseSnapshot,
    }
  }
}

export function normalizeSyncPath(path: string): string {
  if (path.length === 0 || path === '.') {
    throw new LocalCloudSyncPathError()
  }
  if (path.startsWith('/') || path.includes('\\')) {
    throw new LocalCloudSyncPathError()
  }

  const segments = path.split('/')
  if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new LocalCloudSyncPathError()
  }

  return segments.join('/')
}
