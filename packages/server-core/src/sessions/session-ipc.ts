/**
 * IPC helper class extracted from SessionManager (Slice 3 composition refactor, commit 1 of 3).
 * Owns eventSink, browserPaneManager, delta queues, broadcast methods.
 * Sibling files: session-manager-helpers.ts, SessionManager.ts.
 */
import type { EventSink } from '@rox-agent/server-core/transport'
import type { IBrowserPaneManager } from '@rox-agent/server-core/handlers'
import type { Logger } from '@rox-agent/server-core/runtime'
import { type SessionEvent, type UnreadSummary, RPC_CHANNELS } from '@rox-agent/shared/protocol'
import type { LoadedSource } from '@rox-agent/shared/sources'
import type { LoadedSkill } from '@rox-agent/shared/skills'
import type { ThemeOverrides } from '@rox-agent/shared/config'
import { DELTA_BATCH_INTERVAL_MS, type PendingDelta } from './session-manager-helpers'

export interface SessionIPCDeps {
  /** Logger used for broadcast trace messages. Wired by SessionManager so the helper logs through the same scoped logger. */
  getLogger: () => Logger
  /** Returns the latest unread summary; called by emitUnreadSummaryChanged. */
  getUnreadSummary: () => UnreadSummary
  /** Updates the host badge count. Mirrors sessionRuntimeHooks.updateBadgeCount. */
  updateBadgeCount: (count: number) => void
}

/**
 * Owns the IPC concern: event sink, browser pane manager handle, batched-delta
 * machinery, and all broadcast helpers. SessionManager composes one instance
 * eagerly. No helper deps — leaf of the composition graph.
 */
export class SessionIPC {
  // Public so TypeScript can narrow `if (this.ipc.browserPaneManager)` checks at the
  // many SessionManager callsites that read it without going through a getter.
  eventSink: EventSink | null = null
  browserPaneManager: IBrowserPaneManager | null = null
  // Delta batching for performance - reduces IPC events from 50+/sec to ~20/sec
  private pendingDeltas: Map<string, PendingDelta> = new Map()
  private deltaFlushTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(private deps: SessionIPCDeps) {}

  setEventSink(sink: EventSink): void {
    this.eventSink = sink
  }

  setBrowserPaneManager(bpm: IBrowserPaneManager): void {
    this.browserPaneManager = bpm
  }

  /**
   * Drop any in-flight delta state for a session (e.g., on session delete).
   * Mirrors the old inline cleanup in SessionManager.deleteSession.
   */
  clearDeltaState(sessionId: string): void {
    const timer = this.deltaFlushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.deltaFlushTimers.delete(sessionId)
    }
    this.pendingDeltas.delete(sessionId)
  }

  /**
   * Drop all delta state (on full SessionManager.cleanup).
   */
  clearAllDeltaState(): void {
    for (const [, timer] of this.deltaFlushTimers) {
      clearTimeout(timer)
    }
    this.deltaFlushTimers.clear()
    this.pendingDeltas.clear()
  }

  broadcastSourcesChanged(workspaceId: string, sources: LoadedSource[]): void {
    if (!this.eventSink) return
    this.eventSink(RPC_CHANNELS.sources.CHANGED, { to: 'workspace', workspaceId }, workspaceId, sources)
  }

  broadcastStatusesChanged(workspaceId: string): void {
    if (!this.eventSink) return
    this.deps.getLogger().info(`Broadcasting statuses changed for ${workspaceId}`)
    this.eventSink(RPC_CHANNELS.statuses.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
  }

  broadcastLabelsChanged(workspaceId: string): void {
    if (!this.eventSink) return
    this.deps.getLogger().info(`Broadcasting labels changed for ${workspaceId}`)
    this.eventSink(RPC_CHANNELS.labels.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
  }

  broadcastAutomationsChanged(workspaceId: string): void {
    if (!this.eventSink) return
    this.deps.getLogger().info(`Broadcasting automations changed for ${workspaceId}`)
    this.eventSink(RPC_CHANNELS.automations.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
  }

  broadcastAppThemeChanged(theme: ThemeOverrides | null): void {
    if (!this.eventSink) return
    this.deps.getLogger().info(`Broadcasting app theme changed`)
    this.eventSink(RPC_CHANNELS.theme.APP_CHANGED, { to: 'all' }, theme)
  }

  broadcastLlmConnectionsChanged(): void {
    if (!this.eventSink) return
    this.deps.getLogger().info('Broadcasting LLM connections changed')
    this.eventSink(RPC_CHANNELS.llmConnections.CHANGED, { to: 'all' })
  }

  broadcastSkillsChanged(workspaceId: string, skills: LoadedSkill[]): void {
    if (!this.eventSink) return
    this.deps.getLogger().info(`Broadcasting skills changed (${skills.length} skills)`)
    this.eventSink(RPC_CHANNELS.skills.CHANGED, { to: 'workspace', workspaceId }, workspaceId, skills)
  }

  broadcastDefaultPermissionsChanged(): void {
    if (!this.eventSink) return
    this.deps.getLogger().info('Broadcasting default permissions changed')
    this.eventSink(RPC_CHANNELS.permissions.DEFAULTS_CHANGED, { to: 'all' }, null)
  }

  /**
   * Broadcast global unread summary to all workspace windows.
   */
  emitUnreadSummaryChanged(): void {
    const summary = this.deps.getUnreadSummary()

    // Update badge via runtime hook — host decides whether/how to render badges
    this.deps.updateBadgeCount(summary.totalUnreadSessions)

    if (!this.eventSink) return

    // Broadcast to renderers for UI updates (session list dots, etc.)
    this.eventSink(RPC_CHANNELS.sessions.UNREAD_SUMMARY_CHANGED, { to: 'all' }, summary)
  }

  sendEvent(event: SessionEvent, workspaceId?: string): void {
    if (!this.eventSink) {
      this.deps.getLogger().warn('Cannot send event - no event sink')
      return
    }

    if (!workspaceId) {
      this.deps.getLogger().warn(`Cannot send ${event.type} event - no workspaceId`)
      return
    }

    this.eventSink(RPC_CHANNELS.sessions.EVENT, { to: 'workspace', workspaceId }, event)
  }

  /**
   * Queue a text delta for batched sending (performance optimization)
   * Instead of sending 50+ IPC events per second, batches deltas and flushes every 50ms
   */
  queueDelta(sessionId: string, workspaceId: string, delta: string, turnId?: string): void {
    const existing = this.pendingDeltas.get(sessionId)
    if (existing) {
      // Append to existing batch
      existing.delta += delta
      // Keep the latest turnId (should be the same, but just in case)
      if (turnId) existing.turnId = turnId
    } else {
      // Start new batch
      this.pendingDeltas.set(sessionId, { delta, turnId })
    }

    // Schedule flush if not already scheduled
    if (!this.deltaFlushTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.flushDelta(sessionId, workspaceId)
      }, DELTA_BATCH_INTERVAL_MS)
      this.deltaFlushTimers.set(sessionId, timer)
    }
  }

  /**
   * Flush any pending deltas for a session (sends batched IPC event)
   * Called on timer or when streaming ends (text_complete)
   */
  flushDelta(sessionId: string, workspaceId: string): void {
    // Clear the timer
    const timer = this.deltaFlushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.deltaFlushTimers.delete(sessionId)
    }

    // Send batched delta if any
    const pending = this.pendingDeltas.get(sessionId)
    if (pending && pending.delta) {
      this.sendEvent({
        type: 'text_delta',
        sessionId,
        delta: pending.delta,
        turnId: pending.turnId,
      }, workspaceId)
      this.pendingDeltas.delete(sessionId)
    }
  }
}
