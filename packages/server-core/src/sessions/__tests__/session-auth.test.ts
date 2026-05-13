import { beforeEach, describe, expect, it } from 'bun:test'
import type { Logger } from '@rox-one/server-core/runtime'
import type { AuthRequest, AuthResult } from '@craft-agent/shared/agent'
import { SessionAuth } from '../session-auth'
import { SessionIPC } from '../session-ipc'
import { SessionPersistence } from '../session-persistence'
import { createManagedSession, type ManagedSession } from '../session-manager-helpers'

// Per-helper unit tests for SessionAuth (Slice 3 / 3-of-3). The helper sits
// at the top of the composition graph and depends on SessionIPC,
// SessionPersistence, and a handful of SM coordinator callbacks. These tests
// stub the coordinator callbacks, build real IPC + Persistence siblings, and
// exercise the pure-function surface (description/format), the admin remember
// approval window state machine, and the auth-completion event emission.

function buildSilentLogger(): Logger {
  const noop = () => {}
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    trace: noop,
    fatal: noop,
  } as unknown as Logger
}

interface AuthHarness {
  auth: SessionAuth
  ipc: SessionIPC
  persistence: SessionPersistence
  sessions: Map<string, ManagedSession>
  ipcCalls: Array<{ channel: string; target: unknown; args: unknown[] }>
  sendMessageCalls: Array<{
    sessionId: string
    message: string
    isAuthRetry?: boolean
  }>
  setProcessingCalls: Array<{ sessionId: string; processing: boolean }>
  onProcessingStoppedCalls: Array<{ sessionId: string; reason: string }>
  capturedExceptions: Array<{ error: unknown; context?: unknown }>
}

function buildHarness(): AuthHarness {
  const sessions = new Map<string, ManagedSession>()
  const ipcCalls: AuthHarness['ipcCalls'] = []

  const ipc = new SessionIPC({
    getLogger: () => buildSilentLogger(),
    getUnreadSummary: () => ({
      totalUnreadSessions: 0,
      byWorkspace: {},
      hasUnreadByWorkspace: {},
    }),
    updateBadgeCount: () => {},
  })
  ipc.setEventSink((channel, target, ...args) => {
    ipcCalls.push({ channel, target, args })
  })

  // Persistence is wired but its disk side effects are not under test here —
  // SessionAuth.completeAuthRequest reaches into it via persistSession, so we
  // need a real instance to satisfy the dep contract.
  const persistence = new SessionPersistence({
    getLogger: () => buildSilentLogger(),
    getSessions: () => sessions,
    getAutomationSystem: () => undefined,
    processNextQueuedMessage: () => {},
    ipc,
  })

  let monotonicCounter = 0
  const sendMessageCalls: AuthHarness['sendMessageCalls'] = []
  const setProcessingCalls: AuthHarness['setProcessingCalls'] = []
  const onProcessingStoppedCalls: AuthHarness['onProcessingStoppedCalls'] = []
  const capturedExceptions: AuthHarness['capturedExceptions'] = []

  const auth = new SessionAuth({
    getLogger: () => buildSilentLogger(),
    getSessions: () => sessions,
    ipc,
    persistence,
    sendMessage: async (sessionId, message, _attachments, _stored, _options, _existingId, isAuthRetry) => {
      sendMessageCalls.push({ sessionId, message, isAuthRetry })
      return { accepted: true, messageId: 'fake-id' }
    },
    setProcessing: (managed, processing) => {
      setProcessingCalls.push({ sessionId: managed.id, processing })
    },
    onProcessingStopped: async (sessionId, reason) => {
      onProcessingStoppedCalls.push({ sessionId, reason })
    },
    monotonic: () => ++monotonicCounter,
    captureException: (error, context) => {
      capturedExceptions.push({ error, context })
    },
  })

  return {
    auth,
    ipc,
    persistence,
    sessions,
    ipcCalls,
    sendMessageCalls,
    setProcessingCalls,
    onProcessingStoppedCalls,
    capturedExceptions,
  }
}

function buildWorkspace() {
  return {
    id: 'ws_test',
    name: 'Test Workspace',
    rootPath: '/tmp/sm-auth-test-noop',
    createdAt: Date.now(),
  } as never
}

describe('SessionAuth pure-function helpers', () => {
  let h: AuthHarness

  beforeEach(() => {
    h = buildHarness()
  })

  describe('getAuthRequestDescription', () => {
    it('formats credential request', () => {
      const req: AuthRequest = {
        type: 'credential',
        requestId: 'r1',
        sessionId: 's1',
        sourceSlug: 'gmail',
        sourceName: 'Gmail',
        mode: 'bearer',
      } as AuthRequest
      expect(h.auth.getAuthRequestDescription(req)).toBe('Authentication required for Gmail')
    })

    it('formats generic OAuth request', () => {
      const req: AuthRequest = {
        type: 'oauth',
        requestId: 'r2',
        sessionId: 's1',
        sourceSlug: 'mcp-x',
        sourceName: 'McpX',
      } as AuthRequest
      expect(h.auth.getAuthRequestDescription(req)).toBe('OAuth authentication for McpX')
    })

    it('formats Google/Slack/Microsoft OAuth requests', () => {
      const google: AuthRequest = {
        type: 'oauth-google',
        requestId: 'g1',
        sessionId: 's1',
        sourceSlug: 'gmail',
        sourceName: 'Gmail',
      } as AuthRequest
      const slack: AuthRequest = {
        type: 'oauth-slack',
        requestId: 'sl1',
        sessionId: 's1',
        sourceSlug: 'slack',
        sourceName: 'Slack',
      } as AuthRequest
      const ms: AuthRequest = {
        type: 'oauth-microsoft',
        requestId: 'm1',
        sessionId: 's1',
        sourceSlug: 'outlook',
        sourceName: 'Outlook',
      } as AuthRequest

      expect(h.auth.getAuthRequestDescription(google)).toBe('Sign in with Google for Gmail')
      expect(h.auth.getAuthRequestDescription(slack)).toBe('Sign in with Slack for Slack')
      expect(h.auth.getAuthRequestDescription(ms)).toBe('Sign in with Microsoft for Outlook')
    })
  })

  describe('formatAuthResultMessage', () => {
    it('formats a success result with email and workspace', () => {
      const result: AuthResult = {
        requestId: 'r1',
        sourceSlug: 'gmail',
        success: true,
        email: 'user@example.com',
        workspace: 'Acme',
      }
      expect(h.auth.formatAuthResultMessage(result)).toBe(
        'Authentication completed for gmail. Signed in as user@example.com. Connected to workspace: Acme. Credentials have been saved.',
      )
    })

    it('formats a success result with no extras', () => {
      const result: AuthResult = {
        requestId: 'r1',
        sourceSlug: 'minimal',
        success: true,
      }
      expect(h.auth.formatAuthResultMessage(result)).toBe(
        'Authentication completed for minimal. Credentials have been saved.',
      )
    })

    it('formats a cancelled result', () => {
      const result: AuthResult = {
        requestId: 'r1',
        sourceSlug: 'gmail',
        success: false,
        cancelled: true,
      }
      expect(h.auth.formatAuthResultMessage(result)).toBe('Authentication cancelled for gmail.')
    })

    it('formats a failed result with explicit error', () => {
      const result: AuthResult = {
        requestId: 'r1',
        sourceSlug: 'gmail',
        success: false,
        error: 'token revoked',
      }
      expect(h.auth.formatAuthResultMessage(result)).toBe(
        'Authentication failed for gmail: token revoked',
      )
    })

    it('formats a failed result without explicit error message', () => {
      const result: AuthResult = {
        requestId: 'r1',
        sourceSlug: 'gmail',
        success: false,
      }
      expect(h.auth.formatAuthResultMessage(result)).toBe(
        'Authentication failed for gmail: Unknown error',
      )
    })
  })
})

describe('SessionAuth admin remember approvals', () => {
  let h: AuthHarness

  beforeEach(() => {
    h = buildHarness()
  })

  it('returns false until an approval is stored', () => {
    expect(h.auth.hasActiveAdminRememberApproval('s1', 'hash-a')).toBe(false)
  })

  it('stores and returns true within the remember window', () => {
    h.auth.storeAdminRememberApproval('s1', 'hash-a', 'req-1', 5)
    expect(h.auth.hasActiveAdminRememberApproval('s1', 'hash-a')).toBe(true)
  })

  it('does not match a different command hash on the same session', () => {
    h.auth.storeAdminRememberApproval('s1', 'hash-a', 'req-1', 5)
    expect(h.auth.hasActiveAdminRememberApproval('s1', 'hash-b')).toBe(false)
  })

  it('does not match the same hash on a different session', () => {
    h.auth.storeAdminRememberApproval('s1', 'hash-a', 'req-1', 5)
    expect(h.auth.hasActiveAdminRememberApproval('s2', 'hash-a')).toBe(false)
  })

  it('clearAdminRememberApprovalsForSession drops only that session’s entries', () => {
    h.auth.storeAdminRememberApproval('s1', 'hash-a', 'req-1', 5)
    h.auth.storeAdminRememberApproval('s2', 'hash-a', 'req-2', 5)
    h.auth.clearAdminRememberApprovalsForSession('s1')
    expect(h.auth.hasActiveAdminRememberApproval('s1', 'hash-a')).toBe(false)
    expect(h.auth.hasActiveAdminRememberApproval('s2', 'hash-a')).toBe(true)
  })

  it('clamps remember-for to at least 1 minute', () => {
    h.auth.storeAdminRememberApproval('s1', 'hash-a', 'req-1', 0)
    // 0 → clamped to 1 → still active immediately.
    expect(h.auth.hasActiveAdminRememberApproval('s1', 'hash-a')).toBe(true)
  })
})

describe('SessionAuth.completeAuthRequest', () => {
  let h: AuthHarness

  beforeEach(() => {
    h = buildHarness()
  })

  it('emits auth_completed and sends the formatted result message', async () => {
    const sessionId = 'auth-1'
    const managed = createManagedSession({ id: sessionId, name: 'auth' }, buildWorkspace(), {
      messagesLoaded: true,
    })
    // Seed a pending auth-request message so the helper can mark it completed.
    managed.messages = [
      {
        id: 'authmsg-1',
        role: 'auth-request',
        content: '',
        timestamp: 1,
        authRequestId: 'req-1',
        authStatus: 'pending',
      },
    ] as ManagedSession['messages']
    h.sessions.set(sessionId, managed)

    const result: AuthResult = {
      requestId: 'req-1',
      sourceSlug: 'gmail',
      success: true,
      email: 'user@example.com',
    }

    await h.auth.completeAuthRequest(sessionId, result)

    // auth_completed event was emitted on the sessions channel for this workspace.
    const authCompleted = h.ipcCalls.find(
      (c) => (c.args[0] as { type?: string }).type === 'auth_completed',
    )
    expect(authCompleted).toBeDefined()
    expect((authCompleted!.args[0] as { requestId?: string }).requestId).toBe('req-1')

    // The pending auth-request message was flipped to completed.
    expect(managed.messages[0].authStatus).toBe('completed')
    expect(managed.pendingAuthRequestId).toBeUndefined()
    expect(managed.pendingAuthRequest).toBeUndefined()

    // Source was auto-enabled.
    expect(managed.enabledSourceSlugs).toContain('gmail')

    // Send-message coordinator was invoked with the formatted result.
    expect(h.sendMessageCalls).toHaveLength(1)
    expect(h.sendMessageCalls[0].sessionId).toBe(sessionId)
    expect(h.sendMessageCalls[0].message).toContain('Authentication completed for gmail')
  })

  it('is a no-op when the session is not registered', async () => {
    const result: AuthResult = {
      requestId: 'req-1',
      sourceSlug: 'gmail',
      success: true,
    }
    await h.auth.completeAuthRequest('missing-session', result)
    expect(h.ipcCalls).toHaveLength(0)
    expect(h.sendMessageCalls).toHaveLength(0)
  })

  it('emits auth_completed with cancelled flag when result is cancelled', async () => {
    const sessionId = 'auth-cancel'
    const managed = createManagedSession({ id: sessionId }, buildWorkspace(), {
      messagesLoaded: true,
    })
    managed.messages = [] as ManagedSession['messages']
    h.sessions.set(sessionId, managed)

    const result: AuthResult = {
      requestId: 'req-c',
      sourceSlug: 'gmail',
      success: false,
      cancelled: true,
    }
    await h.auth.completeAuthRequest(sessionId, result)

    const authCompleted = h.ipcCalls.find(
      (c) => (c.args[0] as { type?: string }).type === 'auth_completed',
    )
    expect(authCompleted).toBeDefined()
    const evt = authCompleted!.args[0] as { cancelled?: boolean; success?: boolean }
    expect(evt.cancelled).toBe(true)
    expect(evt.success).toBe(false)

    // The send-message coordinator still runs to resume the conversation
    // with the cancelled-result message.
    expect(h.sendMessageCalls[0]?.message).toContain('Authentication cancelled for gmail')
  })
})

describe('SessionAuth.handleCredentialInput cancellation', () => {
  it('routes a cancelled response through completeAuthRequest', async () => {
    const h = buildHarness()
    const sessionId = 'cred-cancel'
    const managed = createManagedSession({ id: sessionId }, buildWorkspace(), {
      messagesLoaded: true,
    })
    managed.messages = [] as ManagedSession['messages']
    managed.pendingAuthRequest = {
      type: 'credential',
      requestId: 'req-cred',
      sessionId,
      sourceSlug: 'datadog',
      sourceName: 'Datadog',
      mode: 'bearer',
    } as never
    h.sessions.set(sessionId, managed)

    await h.auth.handleCredentialInput(sessionId, 'req-cred', { cancelled: true } as never)

    // Cancellation path must not store any credentials and must emit an
    // auth_completed event with cancelled=true.
    const authCompleted = h.ipcCalls.find(
      (c) => (c.args[0] as { type?: string }).type === 'auth_completed',
    )
    expect(authCompleted).toBeDefined()
    expect((authCompleted!.args[0] as { cancelled?: boolean }).cancelled).toBe(true)
  })

  it('drops the response if no pending auth request matches', async () => {
    const h = buildHarness()
    const sessionId = 'cred-mismatch'
    const managed = createManagedSession({ id: sessionId }, buildWorkspace(), {
      messagesLoaded: true,
    })
    h.sessions.set(sessionId, managed)

    // No pendingAuthRequest set → handleCredentialInput should warn and return
    // without touching the IPC sink or send-message coordinator.
    await h.auth.handleCredentialInput(sessionId, 'req-anything', { cancelled: true } as never)
    expect(h.ipcCalls).toHaveLength(0)
    expect(h.sendMessageCalls).toHaveLength(0)
  })
})
