/**
 * Auth helper class extracted from SessionManager (Slice 3 composition refactor, commit 3 of 3).
 * Owns credential resolvers, permission requests, admin remember approvals, OAuth/auth lifecycle.
 * Sibling files: session-ipc.ts, session-persistence.ts, session-manager-helpers.ts, SessionManager.ts.
 */
import { basename } from 'path'
import type { Logger } from '@rox-agent/server-core/runtime'
import { PrivilegedExecutionBroker } from '@rox-agent/server-core/services'
import {
  type AuthRequest,
  type AuthResult,
  type CredentialAuthRequest,
} from '@rox-agent/shared/agent'
import {
  getLlmConnection,
  getDefaultLlmConnection,
  resetManagedAnthropicAuthEnvVars,
  resolveAuthEnvVars,
} from '@rox-agent/shared/config'
import { getValidClaudeOAuthToken } from '@rox-agent/shared/auth'
import { getCredentialManager } from '@rox-agent/shared/credentials'
import {
  loadAllSources,
  isSourceUsable,
} from '@rox-agent/shared/sources'
import {
  getSessionPath as getSessionStoragePath,
} from '@rox-agent/shared/sessions'
import { resetSummarizationClient } from '@rox-agent/shared/utils'
import { generateMessageId } from '@rox-agent/shared/protocol'
import type {
  CredentialResponse,
  PermissionResponseOptions,
  SendMessageOptions,
  FileAttachment,
} from '@rox-agent/shared/protocol'
import type { StoredAttachment, Message } from '@rox-agent/core/types'
import {
  applyBridgeUpdates,
  buildServersFromSources,
  MAX_ADMIN_REMEMBER_MINUTES,
  type ManagedSession,
} from './session-manager-helpers'
import type { SessionIPC } from './session-ipc'
import type { SessionPersistence } from './session-persistence'

export interface SessionAuthDeps {
  /** Logger used for trace messages. Wired by SessionManager so the helper logs through the same scoped logger. */
  getLogger: () => Logger
  /** Returns the live sessions Map. */
  getSessions: () => Map<string, ManagedSession>
  /** IPC sibling — used for sendEvent broadcasts. */
  ipc: SessionIPC
  /** Persistence sibling — used to write session state after auth changes. */
  persistence: SessionPersistence
  /** Coordinator callback: send a message via the SM send-pipeline (resumes after auth). */
  sendMessage: (
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions,
    existingMessageId?: string,
    _isAuthRetry?: boolean,
  ) => Promise<unknown>
  /** Coordinator callback: flip processing state on a managed session (drives runtime hooks). */
  setProcessing: (managed: ManagedSession, processing: boolean) => void
  /** Coordinator callback: invoke onProcessingStopped lifecycle (cleanup + queue drain). */
  onProcessingStopped: (sessionId: string, reason: 'complete' | 'interrupted' | 'error' | 'timeout') => Promise<void>
  /** Returns a strictly-monotonic timestamp (ms). Used for retry/error message timestamps. */
  monotonic: () => number
  /** Captures retry exceptions through the runtime hook (Sentry/log). */
  captureException: (error: unknown, context?: { errorSource?: string; sessionId?: string }) => void
}

/**
 * Owns the auth concern: credential/permission resolvers, admin remember approvals,
 * OAuth/auth lifecycle, and the auth-retry coordinator. Top of the helper graph —
 * depends on SessionIPC (commit 1/3) and SessionPersistence (commit 2/3), plus
 * SessionManager coordinator callbacks injected at construction.
 */
export class SessionAuth {
  // Pending credential request resolvers (keyed by requestId) — legacy callback flow.
  pendingCredentialResolvers: Map<string, (response: CredentialResponse) => void> = new Map()
  // Permission request metadata tracking (keyed by requestId).
  pendingPermissionRequests: Map<string, {
    sessionId: string
    type?: 'bash' | 'file_write' | 'mcp_mutation' | 'api_mutation' | 'admin_approval'
    commandHash?: string
  }> = new Map()
  // Privileged approval binding + audit logger.
  privilegedExecutionBroker: PrivilegedExecutionBroker
  // Session-local admin remember windows (exact command hash binding).
  adminRememberApprovals: Map<string, {
    createdAt: number
    expiresAt: number
    sourceRequestId: string
  }> = new Map()

  constructor(private deps: SessionAuthDeps) {
    this.privilegedExecutionBroker = new PrivilegedExecutionBroker(deps.getLogger())
  }

  getAdminRememberKey(sessionId: string, commandHash: string): string {
    return `${sessionId}:${commandHash}`
  }

  hasActiveAdminRememberApproval(sessionId: string, commandHash: string): boolean {
    const key = this.getAdminRememberKey(sessionId, commandHash)
    const entry = this.adminRememberApprovals.get(key)
    if (!entry) {
      return false
    }

    if (Date.now() > entry.expiresAt) {
      this.adminRememberApprovals.delete(key)
      this.privilegedExecutionBroker.auditEvent('privileged_remember_window_expired', {
        sessionId,
        commandHash,
        sourceRequestId: entry.sourceRequestId,
        expiresAt: entry.expiresAt,
      })
      return false
    }

    return true
  }

  storeAdminRememberApproval(sessionId: string, commandHash: string, sourceRequestId: string, rememberForMinutes: number): void {
    const boundedMinutes = Math.min(Math.max(Math.floor(rememberForMinutes), 1), MAX_ADMIN_REMEMBER_MINUTES)
    const now = Date.now()
    const expiresAt = now + boundedMinutes * 60 * 1000

    this.adminRememberApprovals.set(this.getAdminRememberKey(sessionId, commandHash), {
      createdAt: now,
      expiresAt,
      sourceRequestId,
    })

    this.privilegedExecutionBroker.auditEvent('privileged_remember_window_stored', {
      sessionId,
      commandHash,
      sourceRequestId,
      rememberForMinutes: boundedMinutes,
      createdAt: now,
      expiresAt,
    })
  }

  clearAdminRememberApprovalsForSession(sessionId: string): void {
    const prefix = `${sessionId}:`
    for (const key of this.adminRememberApprovals.keys()) {
      if (key.startsWith(prefix)) {
        this.adminRememberApprovals.delete(key)
      }
    }
  }

  clearPendingPermissionRequestsForSession(sessionId: string): void {
    for (const [requestId, metadata] of this.pendingPermissionRequests.entries()) {
      if (metadata.sessionId === sessionId) {
        this.pendingPermissionRequests.delete(requestId)
      }
    }
  }

  /**
   * Get human-readable description for auth request
   */
  getAuthRequestDescription(request: AuthRequest): string {
    switch (request.type) {
      case 'credential':
        return `Authentication required for ${request.sourceName}`
      case 'oauth':
        return `OAuth authentication for ${request.sourceName}`
      case 'oauth-google':
        return `Sign in with Google for ${request.sourceName}`
      case 'oauth-slack':
        return `Sign in with Slack for ${request.sourceName}`
      case 'oauth-microsoft':
        return `Sign in with Microsoft for ${request.sourceName}`
    }
  }

  /**
   * Format auth result message to send back to agent
   */
  formatAuthResultMessage(result: AuthResult): string {
    if (result.success) {
      let msg = `Authentication completed for ${result.sourceSlug}.`
      if (result.email) msg += ` Signed in as ${result.email}.`
      if (result.workspace) msg += ` Connected to workspace: ${result.workspace}.`
      msg += ' Credentials have been saved.'
      return msg
    }
    if (result.cancelled) {
      return `Authentication cancelled for ${result.sourceSlug}.`
    }
    return `Authentication failed for ${result.sourceSlug}: ${result.error || 'Unknown error'}`
  }

  /**
   * Reinitialize authentication environment variables.
   *
   * Uses the default LLM connection to determine which credentials to set.
   *
   * @param connectionSlug - Optional connection slug to use (overrides default)
   */
  async reinitializeAuth(connectionSlug?: string): Promise<void> {
    const log = this.deps.getLogger()
    try {
      const manager = getCredentialManager()

      // Get the connection to use (explicit parameter or default)
      const slug = connectionSlug || getDefaultLlmConnection()

      // Restore managed auth env vars to their baseline before applying this connection.
      resetManagedAnthropicAuthEnvVars()

      if (!slug) {
        log.info('Skipping auth reinitialization: no LLM connection configured yet')
        resetSummarizationClient()
        return
      }

      const connection = getLlmConnection(slug)

      if (!connection) {
        log.error(`No LLM connection found for slug: ${slug}`)
        resetSummarizationClient()
        return
      }

      log.info(`Reinitializing auth for connection: ${slug} (${connection.authType})`)

      // Resolve auth env vars via shared utility (provider-agnostic)
      const result = await resolveAuthEnvVars(connection, slug!, manager, getValidClaudeOAuthToken)

      if (!result.success) {
        log.error(`Auth resolution failed for ${slug}: ${result.warning}`)
      } else {
        // Apply resolved env vars to process.env
        for (const [key, value] of Object.entries(result.envVars)) {
          process.env[key] = value
        }
        log.info(`Auth env vars set for connection: ${slug}`)
      }

      // Reset cached summarization client so it picks up new credentials/base URL
      resetSummarizationClient()
    } catch (error) {
      log.error('Failed to reinitialize auth:', error)
      throw error
    }
  }

  /**
   * Complete an auth request and send result back to agent
   * This updates the auth message status and sends a faked user message
   */
  async completeAuthRequest(sessionId: string, result: AuthResult): Promise<void> {
    const log = this.deps.getLogger()
    const managed = this.deps.getSessions().get(sessionId)
    if (!managed) {
      log.warn(`Cannot complete auth request - session ${sessionId} not found`)
      return
    }

    // Find and update the pending auth-request message
    const authMessage = managed.messages.find(m =>
      m.role === 'auth-request' &&
      m.authRequestId === result.requestId &&
      m.authStatus === 'pending'
    )

    if (authMessage) {
      authMessage.authStatus = result.success ? 'completed' :
                               result.cancelled ? 'cancelled' : 'failed'
      authMessage.authError = result.error
      authMessage.authEmail = result.email
      authMessage.authWorkspace = result.workspace
    }

    // Emit auth_completed event to update UI
    this.deps.ipc.sendEvent({
      type: 'auth_completed',
      sessionId,
      requestId: result.requestId,
      success: result.success,
      cancelled: result.cancelled,
      error: result.error,
    }, managed.workspace.id)

    // Create faked user message with result
    const resultContent = this.formatAuthResultMessage(result)

    // Clear pending auth state
    managed.pendingAuthRequestId = undefined
    managed.pendingAuthRequest = undefined

    // Auto-enable the source in the session after successful auth
    if (result.success && result.sourceSlug) {
      const slugSet = new Set(managed.enabledSourceSlugs || [])
      if (!slugSet.has(result.sourceSlug)) {
        slugSet.add(result.sourceSlug)
        managed.enabledSourceSlugs = Array.from(slugSet)
        log.info(`Auto-enabled source ${result.sourceSlug} in session ${sessionId} after auth`)
      }

      // Clear any refresh cooldown so the source is immediately usable
      managed.tokenRefreshManager.clearCooldown(result.sourceSlug)
    }

    // Persist session with updated auth message and enabled sources
    this.deps.persistence.persistSession(managed)

    // Update bridge-mcp-server config/credentials for backends that need it
    if (result.success && result.sourceSlug && managed.agent) {
      const workspaceRootPath = managed.workspace.rootPath
      const sessionPath = getSessionStoragePath(workspaceRootPath, managed.id)
      const enabledSlugs = managed.enabledSourceSlugs || []
      const allSources = loadAllSources(workspaceRootPath)
      const enabledSources = allSources.filter(s =>
        enabledSlugs.includes(s.config.slug) && isSourceUsable(s)
      )
      const { mcpServers } = await buildServersFromSources(
        enabledSources, sessionPath, managed.tokenRefreshManager
      )
      await applyBridgeUpdates(managed.agent, sessionPath, enabledSources, mcpServers, managed.id, workspaceRootPath, 'source auth', managed.poolServer?.url)
    }

    // Send the result as a new message to resume conversation
    // Use empty arrays for attachments since this is a system-generated message
    await this.deps.sendMessage(sessionId, resultContent, [], [], {})

    log.info(`Auth request completed for ${result.sourceSlug}: ${result.success ? 'success' : 'failed'}`)
  }

  /**
   * Handle credential input from the UI (for non-OAuth auth)
   * Called when user submits credentials via the inline form
   */
  async handleCredentialInput(
    sessionId: string,
    requestId: string,
    response: CredentialResponse,
  ): Promise<void> {
    const log = this.deps.getLogger()
    const managed = this.deps.getSessions().get(sessionId)
    if (!managed?.pendingAuthRequest) {
      log.warn(`Cannot handle credential input - no pending auth request for session ${sessionId}`)
      return
    }

    const request = managed.pendingAuthRequest as CredentialAuthRequest
    if (request.requestId !== requestId) {
      log.warn(`Credential request ID mismatch: expected ${request.requestId}, got ${requestId}`)
      return
    }

    if (response.cancelled) {
      await this.completeAuthRequest(sessionId, {
        requestId,
        sourceSlug: request.sourceSlug,
        success: false,
        cancelled: true,
      })
      return
    }

    try {
      // Store credentials using existing workspace ID extraction pattern
      const credManager = getCredentialManager()
      // Extract workspace ID from root path (last segment of path)
      const wsId = basename(managed.workspace.rootPath) || managed.workspace.id

      if (request.mode === 'basic') {
        // Store value as JSON string {username, password} - credential-manager.ts parses it for basic auth
        await credManager.set(
          { type: 'source_basic', workspaceId: wsId, sourceId: request.sourceSlug },
          { value: JSON.stringify({ username: response.username, password: response.password }) }
        )
      } else if (request.mode === 'bearer') {
        await credManager.set(
          { type: 'source_bearer', workspaceId: wsId, sourceId: request.sourceSlug },
          { value: response.value! }
        )
      } else if (request.mode === 'multi-header') {
        // Store multi-header credentials as JSON { "DD-API-KEY": "...", "DD-APPLICATION-KEY": "..." }
        await credManager.set(
          { type: 'source_apikey', workspaceId: wsId, sourceId: request.sourceSlug },
          { value: JSON.stringify(response.headers) }
        )
      } else {
        // header or query - both use API key storage
        await credManager.set(
          { type: 'source_apikey', workspaceId: wsId, sourceId: request.sourceSlug },
          { value: response.value! }
        )
      }

      // Update source config to mark as authenticated
      const { markSourceAuthenticated } = await import('@rox-agent/shared/sources')
      markSourceAuthenticated(managed.workspace.rootPath, request.sourceSlug)

      // Mark source as unseen so fresh guide is injected on next message
      if (managed.agent) {
        managed.agent.markSourceUnseen(request.sourceSlug)
      }

      await this.completeAuthRequest(sessionId, {
        requestId,
        sourceSlug: request.sourceSlug,
        success: true,
      })
    } catch (error) {
      log.error(`Failed to save credentials for ${request.sourceSlug}:`, error)
      await this.completeAuthRequest(sessionId, {
        requestId,
        sourceSlug: request.sourceSlug,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save credentials',
      })
    }
  }

  /**
   * Respond to a pending permission request
   * Returns true if the response was delivered, false if agent/session is gone
   */
  respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean,
    options?: PermissionResponseOptions,
  ): boolean {
    const log = this.deps.getLogger()
    const managed = this.deps.getSessions().get(sessionId)
    if (managed?.agent) {
      const requestMeta = this.pendingPermissionRequests.get(requestId)
      this.pendingPermissionRequests.delete(requestId)

      if (requestMeta?.type === 'admin_approval') {
        const brokerResult = this.privilegedExecutionBroker.resolveApproval(requestId, allowed, {
          expectedCommandHash: requestMeta.commandHash,
        })
        if (!brokerResult.ok) {
          log.warn(`Admin approval rejected by broker for ${requestId}: ${brokerResult.reason}`)
          // Broker rejection should fail closed.
          managed.agent.respondToPermission(requestId, false, false)
          return false
        }

        if (allowed && requestMeta.commandHash && options?.rememberForMinutes) {
          this.storeAdminRememberApproval(sessionId, requestMeta.commandHash, requestId, options.rememberForMinutes)
        }
      }

      log.info(`Permission response for ${requestId}: allowed=${allowed}, alwaysAllow=${alwaysAllow}`)
      managed.agent.respondToPermission(requestId, allowed, alwaysAllow)
      return true
    } else {
      log.warn(`Cannot respond to permission - no agent for session ${sessionId}`)
      return false
    }
  }

  /**
   * Respond to a pending credential request
   * Returns true if the response was delivered, false if no pending request found
   *
   * Supports both:
   * - New unified auth flow (via handleCredentialInput)
   * - Legacy callback flow (via pendingCredentialResolvers)
   */
  async respondToCredential(sessionId: string, requestId: string, response: CredentialResponse): Promise<boolean> {
    const log = this.deps.getLogger()
    // First, check if this is a new unified auth flow request
    const managed = this.deps.getSessions().get(sessionId)
    if (managed?.pendingAuthRequest && managed.pendingAuthRequest.requestId === requestId) {
      log.info(`Credential response (unified flow) for ${requestId}: cancelled=${response.cancelled}`)
      await this.handleCredentialInput(sessionId, requestId, response)
      return true
    }

    // Fall back to legacy callback flow
    const resolver = this.pendingCredentialResolvers.get(requestId)
    if (resolver) {
      log.info(`Credential response (legacy flow) for ${requestId}: cancelled=${response.cancelled}`)
      resolver(response)
      this.pendingCredentialResolvers.delete(requestId)
      return true
    } else {
      log.warn(`Cannot respond to credential - no pending request for ${requestId}`)
      return false
    }
  }

  /**
   * Attempt auth retry: refresh token, destroy agent, resend last message.
   * Shared by both typed_error and plain error auth-retry paths.
   * Returns true if retry was initiated, false if conditions not met.
   */
  attemptAuthRetry(
    sessionId: string,
    managed: ManagedSession,
    workspaceId: string,
    failureErrorCode?: string,
  ): boolean {
    const log = this.deps.getLogger()
    if (managed.authRetryAttempted || !managed.lastSentMessage) return false

    log.info(`Auth error detected, attempting token refresh and retry for session ${sessionId}`)
    managed.authRetryAttempted = true
    managed.authRetryInProgress = true

    // Emit lightweight info so the user sees progress instead of a scary red error
    this.deps.ipc.sendEvent({
      type: 'info',
      sessionId,
      message: 'Token expired, refreshing session…',
      timestamp: this.deps.monotonic(),
    }, workspaceId)

    setImmediate(async () => {
      try {
        // 1. Reset summarization client so it picks up fresh credentials
        log.info(`[auth-retry] Resetting summarization client for session ${sessionId}`)
        resetSummarizationClient()

        // 2. Destroy the agent — the new agent's postInit() will refresh auth
        log.info(`[auth-retry] Destroying agent for session ${sessionId}`)
        managed.agent = null

        // 3. Retry the message
        const retryMessage = managed.lastSentMessage
        const retryAttachments = managed.lastSentAttachments
        const retryStoredAttachments = managed.lastSentStoredAttachments
        const retryOptions = managed.lastSentOptions

        if (retryMessage) {
          log.info(`[auth-retry] Retrying message for session ${sessionId}`)
          this.deps.setProcessing(managed, false)

          // Remove the user message that was added for this failed attempt
          // so we don't get duplicate messages when retrying
          const lastUserMsgIndex = managed.messages.findLastIndex(m => m.role === 'user')
          if (lastUserMsgIndex !== -1) {
            managed.messages.splice(lastUserMsgIndex, 1)
          }

          managed.authRetryInProgress = false

          await this.deps.sendMessage(
            sessionId,
            retryMessage,
            retryAttachments,
            retryStoredAttachments,
            retryOptions,
            undefined,  // existingMessageId
            true        // _isAuthRetry - prevents infinite retry loop
          )
          log.info(`[auth-retry] Retry completed for session ${sessionId}`)
        } else {
          managed.authRetryInProgress = false
        }
      } catch (retryError) {
        managed.authRetryInProgress = false
        log.error(`[auth-retry] Failed to retry after auth refresh for session ${sessionId}:`, retryError)
        this.deps.captureException(retryError, { errorSource: 'auth-retry', sessionId })
        const failedMessage: Message = {
          id: generateMessageId(),
          role: 'error',
          content: 'Authentication failed. Please check your credentials.',
          timestamp: this.deps.monotonic(),
          errorCode: failureErrorCode,
        }
        managed.messages.push(failedMessage)
        this.deps.ipc.sendEvent({
          type: 'error',
          sessionId,
          error: 'Authentication failed. Please check your credentials.',
          timestamp: failedMessage.timestamp,
        }, workspaceId)
        void this.deps.onProcessingStopped(sessionId, 'error')
      }
    })

    return true
  }
}
