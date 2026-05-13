/**
 * Persistence helper class extracted from SessionManager (Slice 3 composition refactor, commit 2 of 3).
 * Owns disk I/O, JSONL writes, message hydration, persist queue.
 * Sibling files: session-ipc.ts, session-manager-helpers.ts, SessionManager.ts.
 */
import { DEFAULT_LOCAL_SCOPE, getWorkspaces, type Workspace } from '@craft-agent/shared/config'
import {
  listSessions as listStoredSessions,
  loadSession as loadStoredSession,
  getSessionPath as getSessionStoragePath,
  sessionPersistenceQueue,
  pickSessionFields,
  type StoredSession,
} from '@craft-agent/shared/sessions'
import { resolveSessionConnection } from '@craft-agent/shared/agent/backend'
import { setPermissionMode, hydratePreviousPermissionMode } from '@craft-agent/shared/agent'
import { messageToStored, storedToMessage } from '@rox-one/core/types'
import { loadWorkspaceConfig } from '@craft-agent/shared/workspaces'
import type { Logger } from '@craft-agent/server-core/runtime'
import type { AutomationSystem } from '@craft-agent/shared/automations'
import {
  createManagedSession,
  DEFAULT_TOKEN_USAGE,
  METADATA_WRITE_GUARD_MS,
  type ManagedSession,
} from './session-manager-helpers'
import type { SessionIPC } from './session-ipc'

export interface SessionPersistenceDeps {
  /** Logger used for trace messages. Wired by SessionManager so the helper logs through the same scoped logger. */
  getLogger: () => Logger
  /** Returns the live sessions Map. Helper mutates entries via the returned map. */
  getSessions: () => Map<string, ManagedSession>
  /** AutomationSystem lookup for initial session metadata seeding during disk load. */
  getAutomationSystem: (workspaceRootPath: string) => AutomationSystem | undefined
  /** Triggers queued message processing (recovery path after cold-load/hydrate). */
  processNextQueuedMessage: (sessionId: string) => void
  /** IPC sibling — exposed for any future broadcast needs from persistence operations. */
  ipc: SessionIPC
}

/**
 * Owns the persistence concern: disk loads, message hydration, JSONL writes via
 * the persistence queue, and the lazy-load promise dedup table. Depends on
 * SessionIPC (already extracted) for broadcasts that follow successful writes.
 */
export class SessionPersistence {
  // Promise deduplication for lazy-loading messages (prevents race conditions)
  private messageLoadingPromises: Map<string, Promise<void>> = new Map()

  constructor(private deps: SessionPersistenceDeps) {}

  loadSessionsFromDisk(): void {
    try {
      const workspaces = getWorkspaces(DEFAULT_LOCAL_SCOPE)
      let totalSessions = 0

      // Iterate over each workspace and load its sessions
      for (const workspace of workspaces) {
        const workspaceRootPath = workspace.rootPath
        const sessionMetadata = listStoredSessions(workspaceRootPath)
        // Load workspace config once per workspace for default working directory
        const wsConfig = loadWorkspaceConfig(workspaceRootPath)
        const wsDefaultWorkingDir = wsConfig?.defaults?.workingDirectory

        for (const meta of sessionMetadata) {
          // Create managed session from metadata only (messages lazy-loaded on demand)
          // This dramatically reduces memory usage at startup - messages are loaded
          // when getSession() is called for a specific session
          const managed = createManagedSession(meta, workspace, {
            enabledSourceSlugs: undefined,  // Loaded with messages
            workingDirectory: meta.workingDirectory ?? wsDefaultWorkingDir,
          })

          // Migration: clear orphaned llmConnection references (e.g., after connection was deleted)
          if (managed.llmConnection) {
            const conn = resolveSessionConnection(managed.llmConnection, undefined)
            if (!conn) {
              this.deps.getLogger().warn(`Session ${meta.id} has orphaned llmConnection "${managed.llmConnection}", clearing`)
              managed.llmConnection = undefined
              managed.connectionLocked = false
            }
          }

          // Initialize mode-manager state for restored sessions even before agent creation.
          // This keeps diagnostics/effective mode aligned with persisted session metadata.
          setPermissionMode(meta.id, managed.permissionMode ?? 'ask', { changedBy: 'restore' })
          if (managed.previousPermissionMode) {
            hydratePreviousPermissionMode(meta.id, managed.previousPermissionMode)
          }

          this.deps.getSessions().set(meta.id, managed)

          // Initialize session metadata in AutomationSystem for diffing
          const automationSystem = this.deps.getAutomationSystem(workspaceRootPath)
          if (automationSystem) {
            automationSystem.setInitialSessionMetadata(meta.id, {
              permissionMode: meta.permissionMode,
              labels: meta.labels,
              isFlagged: meta.isFlagged,
              sessionStatus: meta.sessionStatus,
              sessionName: managed.name,
            })
          }

          totalSessions++
        }
      }

      this.deps.getLogger().info(`Loaded ${totalSessions} sessions from disk (metadata only)`)
    } catch (error) {
      this.deps.getLogger().error('Failed to load sessions from disk:', error)
    }
  }

  // Suppress fs.watch metadata-revert events for the window in which our own
  // atomic write completes. See onSessionMetadataChange.
  setMetadataWriteGuard(managed: ManagedSession): void {
    managed._metadataWriteGuardUntil = Date.now() + METADATA_WRITE_GUARD_MS
  }

  /**
   * Persist a session to disk (async, with debouncing in the persistence queue).
   *
   * Cold-session path: if messages haven't been lazy-loaded yet, hydrate them
   * synchronously from the JSONL first — otherwise the snapshot we enqueue
   * would write `messages: []` over the real messages on disk. Hydration
   * deliberately does NOT touch persistent metadata fields (name, labels,
   * sessionStatus, llmConnection, ...) because the caller may have just
   * mutated them; the in-memory mutation must win over what's on disk.
   * `loadStoredSession` is synchronous (sync fs reads), so the entire path
   * stays sync — no microtask race window between the load and the enqueue.
   */
  persistSession(managed: ManagedSession): void {
    if (!managed.messagesLoaded) {
      this.hydrateMessagesForColdPersist(managed)
    }
    this.enqueuePersist(managed)
  }

  // Cold-persist hydration. Mirrors the messages/queue-recovery half of
  // loadMessagesFromDisk but skips the metadata field syncs. Sets
  // messagesLoaded=true so subsequent persistSession calls take the fast path.
  // Subsequent ensureMessagesLoaded calls also short-circuit, which is fine —
  // queue recovery has already run here.
  hydrateMessagesForColdPersist(managed: ManagedSession): void {
    this.deps.getLogger().debug(`Cold-load triggered for persistSession on ${managed.id}`)
    const stored = loadStoredSession(managed.workspace.rootPath, managed.id)
    if (stored) {
      managed.messages = (stored.messages || []).map(storedToMessage)
      managed.tokenUsage = stored.tokenUsage
      // Deferred-load fields (intentionally undefined after startup, see
      // loadSessionsFromDisk). Populate from disk only if not already set in
      // memory — a caller may have mutated them via setSessionSources etc.
      if (managed.enabledSourceSlugs === undefined) managed.enabledSourceSlugs = stored.enabledSourceSlugs
      if (managed.lastReadMessageId === undefined) managed.lastReadMessageId = stored.lastReadMessageId
      if (managed.hasUnread === undefined) managed.hasUnread = stored.hasUnread
      if (managed.sharedUrl === undefined) managed.sharedUrl = stored.sharedUrl
      if (managed.sharedId === undefined) managed.sharedId = stored.sharedId
      if (managed.transferredSessionSummary === undefined) managed.transferredSessionSummary = stored.transferredSessionSummary
      if (managed.transferredSessionSummaryApplied === undefined) managed.transferredSessionSummaryApplied = stored.transferredSessionSummaryApplied

      // Queue recovery: find orphaned queued messages from crash/restart and re-queue them.
      const orphanedQueued = managed.messages.filter(m =>
        m.role === 'user' && m.isQueued === true
      )
      if (orphanedQueued.length > 0) {
        this.deps.getLogger().info(`Recovering ${orphanedQueued.length} queued message(s) for session ${managed.id}`)
        for (const msg of orphanedQueued) {
          managed.messageQueue.push({
            message: msg.content,
            messageId: msg.id,
            attachments: undefined,
            storedAttachments: msg.attachments,
            options: undefined,
          })
        }
        if (!managed.isProcessing && managed.messageQueue.length > 0) {
          setImmediate(() => {
            this.deps.processNextQueuedMessage(managed.id)
          })
        }
      }
      this.deps.getLogger().debug(`Cold-hydrated ${managed.messages.length} messages for session ${managed.id}`)
    }
    managed.messagesLoaded = true
  }

  // Build the StoredSession snapshot and hand it to the persistence queue.
  // Caller must ensure `managed.messagesLoaded` is true.
  enqueuePersist(managed: ManagedSession): void {
    try {
      // Filter out transient status messages (progress indicators like "Compacting...")
      // Error messages are now persisted with rich fields for diagnostics
      const persistableMessages = managed.messages.filter(m =>
        m.role !== 'status'
      )

      const storedSession: StoredSession = {
        ...pickSessionFields(managed),
        workspaceRootPath: managed.workspace.rootPath,
        createdAt: managed.createdAt ?? Date.now(),
        lastUsedAt: Date.now(),
        messages: persistableMessages.map(messageToStored),
        tokenUsage: managed.tokenUsage ?? DEFAULT_TOKEN_USAGE,
      } as StoredSession

      // Queue for async persistence with debouncing
      sessionPersistenceQueue.enqueue(storedSession)
    } catch (error) {
      this.deps.getLogger().error(`Failed to queue session ${managed.id} for persistence:`, error)
    }
  }

  // Flush a specific session immediately (call on session close/switch).
  // Cold-persist hydration is synchronous, so by the time we reach here the
  // queue already has an entry whenever persistSession was just called.
  async flushSession(sessionId: string): Promise<void> {
    await sessionPersistenceQueue.flush(sessionId)
  }

  // Flush all pending sessions (call on app quit).
  async flushAllSessions(): Promise<void> {
    await sessionPersistenceQueue.flushAll()
  }

  /**
   * Reload all sessions from disk.
   * Used after importing sessions to refresh the in-memory session list.
   */
  reloadSessions(): void {
    this.loadSessionsFromDisk()
  }

  /**
   * Ensure messages are loaded for a managed session.
   * Uses promise deduplication to prevent race conditions when multiple
   * concurrent calls (e.g., rapid session switches + message send) try
   * to load messages simultaneously.
   */
  async ensureMessagesLoaded(managed: ManagedSession): Promise<void> {
    if (managed.messagesLoaded) return

    // Deduplicate concurrent loads - return existing promise if already loading
    const existingPromise = this.messageLoadingPromises.get(managed.id)
    if (existingPromise) {
      return existingPromise
    }

    const loadPromise = this.loadMessagesFromDisk(managed)
    this.messageLoadingPromises.set(managed.id, loadPromise)

    try {
      await loadPromise
    } finally {
      this.messageLoadingPromises.delete(managed.id)
    }
  }

  /**
   * Internal: Load messages from disk storage into the managed session.
   */
  async loadMessagesFromDisk(managed: ManagedSession): Promise<void> {
    const storedSession = loadStoredSession(managed.workspace.rootPath, managed.id)
    if (storedSession) {
      managed.messages = (storedSession.messages || []).map(storedToMessage)
      managed.tokenUsage = storedSession.tokenUsage
      managed.lastReadMessageId = storedSession.lastReadMessageId
      managed.hasUnread = storedSession.hasUnread  // Explicit unread flag for NEW badge state machine
      managed.enabledSourceSlugs = storedSession.enabledSourceSlugs
      managed.sharedUrl = storedSession.sharedUrl
      managed.sharedId = storedSession.sharedId
      // Sync name from disk - ensures title persistence across lazy loading
      managed.name = storedSession.name
      // Restore LLM connection state - ensures correct provider on resume
      if (storedSession.llmConnection) {
        managed.llmConnection = storedSession.llmConnection
      }
      if (storedSession.connectionLocked) {
        managed.connectionLocked = storedSession.connectionLocked
      }
      // Sync transferred session summary state from disk
      managed.transferredSessionSummary = storedSession.transferredSessionSummary
      managed.transferredSessionSummaryApplied = storedSession.transferredSessionSummaryApplied
      this.deps.getLogger().debug(`Lazy-loaded ${managed.messages.length} messages for session ${managed.id}`)

      // Queue recovery: find orphaned queued messages from crash/restart and re-queue them
      const orphanedQueued = managed.messages.filter(m =>
        m.role === 'user' && m.isQueued === true
      )
      if (orphanedQueued.length > 0) {
        this.deps.getLogger().info(`Recovering ${orphanedQueued.length} queued message(s) for session ${managed.id}`)
        for (const msg of orphanedQueued) {
          managed.messageQueue.push({
            message: msg.content,
            messageId: msg.id,
            attachments: undefined,  // Attachments already stored on disk
            storedAttachments: msg.attachments,
            options: undefined,
          })
        }
        // Process queue when session becomes active (will be triggered by first message or interaction)
        // Use setImmediate to avoid blocking the load and allow session state to settle
        if (!managed.isProcessing && managed.messageQueue.length > 0) {
          setImmediate(() => {
            this.deps.processNextQueuedMessage(managed.id)
          })
        }
      }
    }
    managed.messagesLoaded = true
  }

  /**
   * Get the filesystem path to a session's folder
   */
  getSessionPath(sessionId: string): string | null {
    const managed = this.deps.getSessions().get(sessionId)
    if (!managed) return null
    return getSessionStoragePath(managed.workspace.rootPath, sessionId)
  }
}
