import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import type { ManagedCloudWorkspace } from '../webui/account-cloud-workspaces'
import {
  EMPTY_SYNC_SNAPSHOT,
  InMemorySyncFileStore,
  LocalCloudSyncConflictError,
  LocalCloudSyncEngine,
  LocalCloudSyncPathError,
  type SyncConflict,
  type SyncOperation,
  type SyncSnapshot,
} from './local-cloud-sync'

export interface WorkspaceSyncFilePayload {
  path: string
  contentBase64: string
}

export interface WorkspaceSyncContext {
  actorUserId: string
  workspace: ManagedCloudWorkspace
}

export interface WorkspaceSyncRunInput extends WorkspaceSyncContext {
  operationId?: string | null
  baseSnapshot?: SyncSnapshot
  files?: WorkspaceSyncFilePayload[]
}

// Fix D: ConflictMetadata and updated WorkspaceSyncStatus
export interface ConflictMetadata {
  path: string
  baseSnapshot: string
  reason: string
}

export interface WorkspaceSyncStatus {
  workspaceId: string
  baseSnapshot: SyncSnapshot
  cloudSnapshot: SyncSnapshot
  operationCount: number
  lastOperationId: string | null
  pendingConflictMetadata?: ConflictMetadata[]
}

export type WorkspaceSyncDirection = 'push' | 'pull'

export interface WorkspaceSyncRunResult {
  workspaceId: string
  direction: WorkspaceSyncDirection
  operationId: string | null
  idempotentReplay: boolean
  operations: SyncOperation[]
  conflicts: SyncConflict[]
  nextBaseSnapshot: SyncSnapshot
  files: WorkspaceSyncFilePayload[]
}

export interface WorkspaceSyncOperationRecord {
  operationId: string
  workspaceId: string
  actorUserId: string
  direction: WorkspaceSyncDirection
  operations: SyncOperation[]
  conflicts: SyncConflict[]
  createdAt: string
}

export interface WorkspaceSyncOperationsResult {
  operations: WorkspaceSyncOperationRecord[]
}

export interface WorkspaceSyncService {
  getStatus(input: WorkspaceSyncContext): Promise<WorkspaceSyncStatus>
  push(input: WorkspaceSyncRunInput): Promise<WorkspaceSyncRunResult>
  pull(input: WorkspaceSyncRunInput): Promise<WorkspaceSyncRunResult>
  listOperations(input: WorkspaceSyncContext): Promise<WorkspaceSyncOperationsResult>
}

export class WorkspaceSyncConflictError extends Error {
  readonly conflicts: SyncConflict[]

  constructor(conflicts: SyncConflict[]) {
    super('Workspace sync conflict')
    this.name = 'WorkspaceSyncConflictError'
    this.conflicts = conflicts
  }
}

export class WorkspaceSyncValidationError extends Error {
  constructor(message = 'Invalid workspace sync request') {
    super(message)
    this.name = 'WorkspaceSyncValidationError'
  }
}

// Fix C: Quota service types
export class WorkspaceQuotaExceededError extends Error {
  constructor(workspaceId: string, bytes: number, limit: number) {
    super(`Quota exceeded for workspace ${workspaceId}: ${bytes} bytes exceeds limit of ${limit} bytes`)
    this.name = 'WorkspaceQuotaExceededError'
  }
}

export interface WorkspaceQuotaService {
  check(workspaceId: string, bytes: number): Promise<void>
  setLimit(workspaceId: string, bytes: number): void
}

export class InMemoryWorkspaceQuotaService implements WorkspaceQuotaService {
  private readonly limits = new Map<string, number>()

  setLimit(workspaceId: string, bytes: number): void {
    this.limits.set(workspaceId, bytes)
  }

  async check(workspaceId: string, bytes: number): Promise<void> {
    const limit = this.limits.get(workspaceId) ?? Infinity
    if (bytes > limit) {
      throw new WorkspaceQuotaExceededError(workspaceId, bytes, limit)
    }
  }
}

export class InMemoryWorkspaceSyncService implements WorkspaceSyncService {
  private readonly cloudStoresByWorkspaceId = new Map<string, InMemorySyncFileStore>()
  private readonly baseSnapshotsByWorkspaceId = new Map<string, SyncSnapshot>()
  private readonly operationsByWorkspaceId = new Map<string, WorkspaceSyncOperationRecord[]>()
  private readonly resultsByWorkspaceOperationId = new Map<string, WorkspaceSyncRunResult>()
  // Fix D: track pending conflict metadata per workspace
  private readonly pendingConflictsByWorkspaceId = new Map<string, ConflictMetadata[]>()
  private readonly quotaService: WorkspaceQuotaService | null

  constructor(options: { quotaService?: WorkspaceQuotaService } = {}) {
    this.quotaService = options.quotaService ?? null
  }

  async getStatus(input: WorkspaceSyncContext): Promise<WorkspaceSyncStatus> {
    const cloudStore = this.getCloudStore(input.workspace.id)
    const cloudSnapshot = await new LocalCloudSyncEngine({
      local: new InMemorySyncFileStore(),
      cloud: cloudStore,
    }).captureSnapshot(cloudStore)
    const operations = this.operationsByWorkspaceId.get(input.workspace.id) ?? []
    // Fix D: include pending conflict metadata
    const pendingConflictMetadata = this.pendingConflictsByWorkspaceId.get(input.workspace.id)

    return {
      workspaceId: input.workspace.id,
      baseSnapshot: copySnapshot(this.getBaseSnapshot(input.workspace.id)),
      cloudSnapshot,
      operationCount: operations.length,
      lastOperationId: operations.at(-1)?.operationId ?? null,
      ...(pendingConflictMetadata !== undefined ? { pendingConflictMetadata } : {}),
    }
  }

  async push(input: WorkspaceSyncRunInput): Promise<WorkspaceSyncRunResult> {
    return this.run('push', input)
  }

  async pull(input: WorkspaceSyncRunInput): Promise<WorkspaceSyncRunResult> {
    return this.run('pull', input)
  }

  async listOperations(input: WorkspaceSyncContext): Promise<WorkspaceSyncOperationsResult> {
    return {
      operations: (this.operationsByWorkspaceId.get(input.workspace.id) ?? []).map(copyOperationRecord),
    }
  }

  private async run(direction: WorkspaceSyncDirection, input: WorkspaceSyncRunInput): Promise<WorkspaceSyncRunResult> {
    // Fix A: assign server-side operationId unconditionally
    const callerOperationId = normalizeOperationId(input.operationId)
    const operationId = callerOperationId ?? randomUUID()

    if (callerOperationId) {
      const replay = this.resultsByWorkspaceOperationId.get(this.operationKey(input.workspace.id, callerOperationId))
      if (replay) return { ...copyRunResult(replay), idempotentReplay: true }
    }

    // Fix B: wrap path validation to surface WorkspaceSyncValidationError
    let localStore: InMemorySyncFileStore
    try {
      localStore = createFileStoreFromPayloads(input.files ?? [])
    } catch (e) {
      if (e instanceof LocalCloudSyncPathError) {
        throw new WorkspaceSyncValidationError(e.message)
      }
      throw e
    }

    const cloudStore = this.getCloudStore(input.workspace.id)
    const baseSnapshot = copySnapshot(input.baseSnapshot ?? this.getBaseSnapshot(input.workspace.id))
    const engine = new LocalCloudSyncEngine({ local: localStore, cloud: cloudStore })

    // Fix C: check quota before touching cloud state on push
    if (direction === 'push' && this.quotaService) {
      const payloadBytes = (input.files ?? []).reduce((sum, f) => {
        const raw = Buffer.from(f.contentBase64, 'base64')
        return sum + raw.byteLength
      }, 0)
      await this.quotaService.check(input.workspace.id, payloadBytes)
    }

    try {
      const syncResult = direction === 'push'
        ? await engine.pushLocalToCloud(baseSnapshot)
        : await engine.pullCloudToLocal(baseSnapshot)
      const files = direction === 'push'
        ? await createPayloadsFromStore(cloudStore)
        : await createPayloadsFromStore(localStore)
      const result: WorkspaceSyncRunResult = {
        workspaceId: input.workspace.id,
        direction,
        operationId,
        idempotentReplay: false,
        operations: syncResult.operations.map(operation => ({ ...operation })),
        conflicts: [],
        nextBaseSnapshot: copySnapshot(syncResult.nextBaseSnapshot),
        files,
      }

      this.baseSnapshotsByWorkspaceId.set(input.workspace.id, copySnapshot(syncResult.nextBaseSnapshot))
      // Fix D: clear pending conflicts on successful commit
      this.pendingConflictsByWorkspaceId.delete(input.workspace.id)
      this.recordOperation({
        operationId,
        workspaceId: input.workspace.id,
        actorUserId: input.actorUserId,
        direction,
        operations: result.operations,
        conflicts: [],
        createdAt: new Date().toISOString(),
      })
      // Fix A: cache result unconditionally (server-assigned or caller-provided)
      this.resultsByWorkspaceOperationId.set(this.operationKey(input.workspace.id, operationId), copyRunResult(result))
      return result
    } catch (error) {
      if (error instanceof LocalCloudSyncConflictError) {
        // Fix D: record pending conflict metadata when conflict is detected
        const baseSnapshotStr = JSON.stringify(baseSnapshot)
        const conflictMetadata: ConflictMetadata[] = error.conflicts.map(c => ({
          path: c.path,
          baseSnapshot: baseSnapshotStr,
          reason: c.reason,
        }))
        this.pendingConflictsByWorkspaceId.set(input.workspace.id, conflictMetadata)
        throw new WorkspaceSyncConflictError(error.conflicts)
      }
      throw error
    }
  }

  private getCloudStore(workspaceId: string): InMemorySyncFileStore {
    const existing = this.cloudStoresByWorkspaceId.get(workspaceId)
    if (existing) return existing
    const store = new InMemorySyncFileStore()
    this.cloudStoresByWorkspaceId.set(workspaceId, store)
    return store
  }

  private getBaseSnapshot(workspaceId: string): SyncSnapshot {
    return this.baseSnapshotsByWorkspaceId.get(workspaceId) ?? EMPTY_SYNC_SNAPSHOT
  }

  private recordOperation(record: WorkspaceSyncOperationRecord): void {
    const records = this.operationsByWorkspaceId.get(record.workspaceId) ?? []
    records.push(copyOperationRecord(record))
    this.operationsByWorkspaceId.set(record.workspaceId, records)
  }

  private operationKey(workspaceId: string, operationId: string): string {
    return `${workspaceId}:${operationId}`
  }
}

function normalizeOperationId(operationId: string | null | undefined): string | null {
  const trimmed = operationId?.trim()
  return trimmed || null
}

function createFileStoreFromPayloads(files: WorkspaceSyncFilePayload[]): InMemorySyncFileStore {
  const store = new InMemorySyncFileStore()
  for (const file of files) {
    if (typeof file?.path !== 'string' || typeof file?.contentBase64 !== 'string') {
      throw new WorkspaceSyncValidationError('Sync files must include path and contentBase64')
    }
    store.setInitialFile(file.path, decodeBase64(file.contentBase64))
  }
  return store
}

async function createPayloadsFromStore(store: InMemorySyncFileStore): Promise<WorkspaceSyncFilePayload[]> {
  const entries = await store.listFiles()
  const payloads: WorkspaceSyncFilePayload[] = []
  for (const entry of entries) {
    const body = await store.readFile(entry.path)
    if (!body) continue
    payloads.push({
      path: entry.path,
      contentBase64: Buffer.from(body).toString('base64'),
    })
  }
  return payloads
}

function decodeBase64(value: string): Uint8Array {
  try {
    return new Uint8Array(Buffer.from(value, 'base64'))
  } catch {
    throw new WorkspaceSyncValidationError('Invalid file contentBase64')
  }
}

function copySnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  return {
    version: 1,
    files: snapshot.files
      .map(file => ({ ...file }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function copyRunResult(result: WorkspaceSyncRunResult): WorkspaceSyncRunResult {
  return {
    ...result,
    operations: result.operations.map(operation => ({ ...operation })),
    conflicts: result.conflicts.map(conflict => ({ ...conflict })),
    nextBaseSnapshot: copySnapshot(result.nextBaseSnapshot),
    files: result.files.map(file => ({ ...file })),
  }
}

function copyOperationRecord(record: WorkspaceSyncOperationRecord): WorkspaceSyncOperationRecord {
  return {
    ...record,
    operations: record.operations.map(operation => ({ ...operation })),
    conflicts: record.conflicts.map(conflict => ({ ...conflict })),
  }
}
