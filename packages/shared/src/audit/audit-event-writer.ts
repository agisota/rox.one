import {
  FileAuditEventStore,
  InMemoryAuditEventStore,
  type AuditEventInput,
  type AuditEventSeverity,
  type AuditEventStorageBackend,
} from './audit-event-store.ts'

export type AuditBackendName = 'memory' | 'file' | 'sqlite' | 's3'
export type StructuredAuditLevel = 'trace' | 'warn' | 'error'

interface AuditEventWriterState {
  backendName: AuditBackendName | null
  store: AuditEventStorageBackend | null
  pending: Set<Promise<unknown>>
  reportedBackendErrors: Set<string>
}

const AUDIT_EVENT_WRITER_STATE = Symbol.for('rox.audit.eventWriterState')

function getState(): AuditEventWriterState {
  const root = globalThis as typeof globalThis & {
    [AUDIT_EVENT_WRITER_STATE]?: AuditEventWriterState
  }

  if (!root[AUDIT_EVENT_WRITER_STATE]) {
    root[AUDIT_EVENT_WRITER_STATE] = {
      backendName: null,
      store: null,
      pending: new Set(),
      reportedBackendErrors: new Set(),
    }
  }

  return root[AUDIT_EVENT_WRITER_STATE]
}

export class UnsupportedAuditBackendError extends Error {
  constructor(readonly backendName: string) {
    super(`ROX_AUDIT_BACKEND=${backendName} is reserved but not implemented yet.`)
    this.name = 'UnsupportedAuditBackendError'
  }
}

export function getConfiguredAuditEventStore(): AuditEventStorageBackend | null {
  const backendName = getAuditBackendName()
  const state = getState()

  if (backendName === null) {
    state.backendName = null
    state.store = null
    return null
  }

  if (state.backendName === backendName && state.store) {
    return state.store
  }

  state.backendName = backendName
  if (backendName === 'memory') {
    state.store = new InMemoryAuditEventStore()
    return state.store
  }
  if (backendName === 'file') {
    state.store = new FileAuditEventStore()
    return state.store
  }

  state.store = null
  throw new UnsupportedAuditBackendError(backendName)
}

export function appendAuditEvent(input: AuditEventInput): void {
  let store: AuditEventStorageBackend | null
  try {
    store = getConfiguredAuditEventStore()
  } catch (error) {
    reportAuditBackendError(error)
    return
  }

  if (!store) return

  const write = Promise.resolve(store.append(input)).catch(reportAuditBackendError)
  const state = getState()
  state.pending.add(write)
  void write.finally(() => {
    state.pending.delete(write)
  })
}

export function appendStructuredAuditEvent(
  level: StructuredAuditLevel,
  eventType: string,
  payload: Record<string, unknown>,
): void {
  const input: AuditEventInput = {
    actor: inferActor(payload),
    eventType,
    severity: toAuditSeverity(level),
    payload,
  }
  const tenantId = inferTenantId(payload)
  const requestId = getString(payload, 'reqId') ?? getString(payload, 'requestId')

  if (tenantId) input.tenantId = tenantId
  if (requestId) input.requestId = requestId
  appendAuditEvent(input)
}

export async function flushAuditEventsForTests(): Promise<void> {
  while (getState().pending.size > 0) {
    await Promise.allSettled([...getState().pending])
  }
}

export function __getAuditEventStoreForTests(): AuditEventStorageBackend | null {
  return getConfiguredAuditEventStore()
}

export function __resetAuditEventWriterForTests(): void {
  const state = getState()
  state.backendName = null
  state.store = null
  state.pending.clear()
  state.reportedBackendErrors.clear()
}

function getAuditBackendName(): AuditBackendName | null {
  if (typeof process === 'undefined') return null
  const raw = process.env?.ROX_AUDIT_BACKEND?.trim().toLowerCase()
  if (!raw) return null
  if (raw === 'memory' || raw === 'file' || raw === 'sqlite' || raw === 's3') return raw
  throw new UnsupportedAuditBackendError(raw)
}

function toAuditSeverity(level: StructuredAuditLevel): AuditEventSeverity {
  if (level === 'trace') return 'trace'
  if (level === 'warn') return 'warn'
  return 'error'
}

function inferActor(payload: Record<string, unknown>): AuditEventInput['actor'] {
  const userId = getString(payload, 'userId')
  if (userId) return { type: 'user', id: userId }
  return { type: 'system' }
}

function inferTenantId(payload: Record<string, unknown>): string | undefined {
  return getString(payload, 'tenantId')
    ?? getString(payload, 'workspaceId')
    ?? getString(payload, 'requestedWorkspaceId')
    ?? getNestedString(payload, 'scopeShape', 'workspaceId')
}

function getString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getNestedString(payload: Record<string, unknown>, key: string, nestedKey: string): string | undefined {
  const nested = payload[key]
  if (nested === null || typeof nested !== 'object') return undefined
  return getString(nested as Record<string, unknown>, nestedKey)
}

function reportAuditBackendError(error: unknown): void {
  const state = getState()
  const message = error instanceof Error ? error.message : String(error)
  if (state.reportedBackendErrors.has(message)) return
  state.reportedBackendErrors.add(message)

  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write(`[audit] ${message}\n`)
  }
}
