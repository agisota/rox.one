/**
 * Automation → Telegram topic routing tests (messaging-gateway)
 *
 * Covers the E2E routing from an automation session bind to a Telegram forum
 * topic, including edge cases not previously covered:
 *
 *   - bindAutomationSession: missing supergroup → graceful no-op (no crash)
 *   - bindAutomationSession: topic creation failure → no crash, returns error result
 *   - bindAutomationSession: topic creation failure → second attempt can succeed
 *   - bindAutomationSession: whitespace-only topic name → invalid-name
 *   - bindAutomationSession: exactly 128-char name → success (boundary)
 *   - bindAutomationSession: 129-char name → invalid-name (boundary)
 *   - bindAutomationSession: two sessions sharing same telegramTopic → one createForumTopic call
 *   - bindAutomationSession: different telegramTopics → separate createForumTopic calls
 *   - bindAutomationSession: adapter absent despite paired supergroup → no-adapter (no crash)
 *   - setAutomationBinder: called during construction
 *   - setAutomationBinder: installed binder calls bindAutomationSession correctly
 *   - setAutomationBinder: binder does NOT throw when bindAutomationSession returns ok=false
 *   - removeAutomationTopic: cleared entry causes fresh createForumTopic on next bind
 *   - removeAutomationTopic: no-op for unknown workspace
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { CredentialManager } from '@rox-one/shared/credentials'
import type { ISessionManager } from '@rox-one/server-core/handlers'

import { MessagingGatewayRegistry, type MessagingGatewayRegistryOptions } from '../registry'
import type { TelegramChatInfo } from '../adapters/telegram/index'
import type { PlatformAdapter, PlatformType } from '../types'

// ---------------------------------------------------------------------------
// Directory lifecycle
// ---------------------------------------------------------------------------

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'auto-tg-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Stubs and factories
// ---------------------------------------------------------------------------

function makeStubSessionManager(): ISessionManager {
  return {
    setAutomationBinder: () => {},
  } as unknown as ISessionManager
}

function makeStubCredentialManager(): CredentialManager {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
  } as unknown as CredentialManager
}

interface FakeTelegramAdapterOptions {
  shouldFailCreate?: boolean
  failMessage?: string
  chatInfo?: TelegramChatInfo | null
}

function makeFakeTelegramAdapter(opts: FakeTelegramAdapterOptions = {}): {
  adapter: PlatformAdapter
  createCalls: Array<{ chatId: string; name: string }>
} {
  const createCalls: Array<{ chatId: string; name: string }> = []
  let nextThreadId = 200

  const defaultChatInfo: TelegramChatInfo = {
    type: 'supergroup',
    isForum: true,
    title: 'Test Forum SG',
  }

  const adapter: PlatformAdapter = {
    platform: 'telegram' as PlatformType,
    capabilities: {} as PlatformAdapter['capabilities'],
    initialize: async () => {},
    destroy: async () => {},
    isConnected: () => true,
    onMessage: () => {},
    onButtonPress: () => {},
    sendText: async () => ({ messageId: '1' }),
    editMessage: async () => {},
    sendButtons: async () => ({ messageId: '1' }),
    sendTyping: async () => {},
    sendFile: async () => ({ messageId: '1' }),
    createForumTopic: async (chatId: string, name: string) => {
      createCalls.push({ chatId, name })
      if (opts.shouldFailCreate) {
        throw new Error(opts.failMessage ?? 'permission denied')
      }
      return { threadId: nextThreadId++, name }
    },
    getChatInfo: async () =>
      opts.chatInfo === null ? null : opts.chatInfo ?? defaultChatInfo,
    setAcceptedSupergroupChatId: () => {},
  } as unknown as PlatformAdapter

  return { adapter, createCalls }
}

interface Harness {
  registry: MessagingGatewayRegistry
  workspaceId: string
}

function makeRegistry(overrides: Partial<MessagingGatewayRegistryOptions> = {}): Harness {
  const registry = new MessagingGatewayRegistry({
    sessionManager: makeStubSessionManager(),
    credentialManager: makeStubCredentialManager(),
    getMessagingDir: (workspaceId: string) =>
      join(dir, 'workspaces', workspaceId, 'messaging'),
    whatsapp: { workerEntry: '/dev/null' },
    ...overrides,
  })
  return { registry, workspaceId: 'ws-routing-test' }
}

async function pairSupergroup(
  harness: Harness,
  chatId = '-100456',
  title = 'Routing Test SG',
): Promise<void> {
  await harness.registry.updateConfig(harness.workspaceId, {
    enabled: true,
    platforms: {
      telegram: {
        enabled: true,
        supergroup: { chatId, title, capturedAt: Date.now() },
      },
    } as never,
  })
}

function injectAdapter(harness: Harness, adapter: PlatformAdapter): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (harness.registry as any).workspaces.get(harness.workspaceId)
  if (!state) throw new Error('workspace state missing — call pairSupergroup first')
  state.gateway.registerAdapter(adapter)
}

// ---------------------------------------------------------------------------
// Tests: missing supergroup — graceful handling (no crash)
// ---------------------------------------------------------------------------

describe('bindAutomationSession — missing supergroup (graceful handling)', () => {
  it('returns no-supergroup and does NOT throw when no supergroup is paired', async () => {
    const h = makeRegistry()

    // No pairSupergroup call — workspace has no paired Telegram supergroup.
    let threw = false
    let result: Awaited<ReturnType<typeof h.registry.bindAutomationSession>> | undefined
    try {
      result = await h.registry.bindAutomationSession({
        workspaceId: h.workspaceId,
        sessionId: 'session-no-sg',
        topicName: 'Reports',
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(result).toBeDefined()
    expect(result!.ok).toBe(false)
    if (!result!.ok) {
      expect(result!.reason).toBe('no-supergroup')
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: topic creation failure (no crash, error returned)
// ---------------------------------------------------------------------------

describe('bindAutomationSession — topic creation failure (graceful)', () => {
  it('returns topic-create-failed without throwing when createForumTopic rejects', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100789')
    const { adapter } = makeFakeTelegramAdapter({
      shouldFailCreate: true,
      failMessage: 'Bot lacks Manage Topics permission',
    })
    injectAdapter(h, adapter)

    let threw = false
    let result: Awaited<ReturnType<typeof h.registry.bindAutomationSession>> | undefined
    try {
      result = await h.registry.bindAutomationSession({
        workspaceId: h.workspaceId,
        sessionId: 'session-fail',
        topicName: 'Errors',
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(result).toBeDefined()
    expect(result!.ok).toBe(false)
    if (!result!.ok) {
      expect(result!.reason).toBe('topic-create-failed')
      expect(result!.error).toContain('Manage Topics')
    }
  })

  it('topic creation failure does not prevent a second attempt from succeeding', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100789')

    let failNext = true
    const createCalls: string[] = []
    const adapter: PlatformAdapter = {
      platform: 'telegram' as PlatformType,
      capabilities: {} as PlatformAdapter['capabilities'],
      initialize: async () => {},
      destroy: async () => {},
      isConnected: () => true,
      onMessage: () => {},
      onButtonPress: () => {},
      sendText: async () => ({ messageId: '1' }),
      editMessage: async () => {},
      sendButtons: async () => ({ messageId: '1' }),
      sendTyping: async () => {},
      sendFile: async () => ({ messageId: '1' }),
      createForumTopic: async (_chatId: string, name: string) => {
        createCalls.push(name)
        if (failNext) throw new Error('Transient failure')
        return { threadId: 42, name }
      },
      getChatInfo: async () => ({ type: 'supergroup', isForum: true, title: 'SG' }),
      setAcceptedSupergroupChatId: () => {},
    } as unknown as PlatformAdapter

    injectAdapter(h, adapter)

    // First attempt: fails
    const first = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 's1',
      topicName: 'Recoverable',
    })
    expect(first.ok).toBe(false)
    expect(createCalls.length).toBe(1)

    // Second attempt: succeeds after failure is cleared
    failNext = false
    const second = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 's2',
      topicName: 'Recoverable',
    })
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.threadId).toBe(42)
    }
    expect(createCalls.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Tests: topic name boundary validation
// ---------------------------------------------------------------------------

describe('bindAutomationSession — topic name validation boundaries', () => {
  it('rejects whitespace-only topic name (invalid-name)', async () => {
    const h = makeRegistry()
    await pairSupergroup(h)

    for (const name of ['', '   ', '\t\n', ' ']) {
      const result = await h.registry.bindAutomationSession({
        workspaceId: h.workspaceId,
        sessionId: 's1',
        topicName: name,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid-name')
    }
  })

  it('accepts a topic name of exactly 128 characters (boundary — valid)', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100128')
    const { adapter } = makeFakeTelegramAdapter()
    injectAdapter(h, adapter)

    const name128 = 'A'.repeat(128)
    const result = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 's-128',
      topicName: name128,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.chatId).toBe('-100128')
    }
  })

  it('rejects a topic name of 129 characters (boundary — invalid)', async () => {
    const h = makeRegistry()
    await pairSupergroup(h)

    const name129 = 'B'.repeat(129)
    const result = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 's-129',
      topicName: name129,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid-name')
  })
})

// ---------------------------------------------------------------------------
// Tests: topic reuse across multiple automation sessions
// ---------------------------------------------------------------------------

describe('bindAutomationSession — topic reuse across automation sessions', () => {
  it('calls createForumTopic only once when two sessions share the same telegramTopic', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100shared')
    const { adapter, createCalls } = makeFakeTelegramAdapter()
    injectAdapter(h, adapter)

    const topicName = 'Shared Topic'

    const first = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 'session-A',
      topicName,
    })
    expect(first.ok).toBe(true)
    if (first.ok) expect(first.reused).toBe(false)
    expect(createCalls.length).toBe(1)

    const second = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 'session-B',
      topicName,
    })
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.reused).toBe(true)
      expect(second.threadId).toBe(first.ok ? first.threadId : undefined)
    }

    // Still only one createForumTopic call — topic was reused.
    expect(createCalls.length).toBe(1)
  })

  it('creates separate topics for different telegramTopic values', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100multi')
    const { adapter, createCalls } = makeFakeTelegramAdapter()
    injectAdapter(h, adapter)

    const resultA = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 'session-C',
      topicName: 'Topic Alpha',
    })
    const resultB = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 'session-D',
      topicName: 'Topic Beta',
    })

    expect(resultA.ok).toBe(true)
    expect(resultB.ok).toBe(true)
    expect(createCalls.length).toBe(2)
    expect(createCalls[0]!.name).toBe('Topic Alpha')
    expect(createCalls[1]!.name).toBe('Topic Beta')

    if (resultA.ok && resultB.ok) {
      expect(resultA.threadId).not.toBe(resultB.threadId)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: adapter absent despite paired supergroup
// ---------------------------------------------------------------------------

describe('bindAutomationSession — adapter absent with paired supergroup', () => {
  it('returns no-adapter without crashing when Telegram adapter is not registered', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100noadapter')
    // Intentionally do NOT inject an adapter — simulates a bot that disconnected
    // after the supergroup was paired.

    let threw = false
    let result: Awaited<ReturnType<typeof h.registry.bindAutomationSession>> | undefined
    try {
      result = await h.registry.bindAutomationSession({
        workspaceId: h.workspaceId,
        sessionId: 'session-no-adapter',
        topicName: 'Reports',
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(result!.ok).toBe(false)
    if (!result!.ok) {
      expect(result!.reason).toBe('no-adapter')
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: setAutomationBinder hook integration
// ---------------------------------------------------------------------------

describe('MessagingGatewayRegistry — setAutomationBinder hook', () => {
  it('calls setAutomationBinder on the SessionManager during construction', () => {
    let binderWasSet = false
    const sessionManager: ISessionManager = {
      setAutomationBinder: () => {
        binderWasSet = true
      },
    } as unknown as ISessionManager

    new MessagingGatewayRegistry({
      sessionManager,
      credentialManager: makeStubCredentialManager(),
      getMessagingDir: (workspaceId: string) =>
        join(dir, 'workspaces', workspaceId, 'messaging'),
      whatsapp: { workerEntry: '/dev/null' },
    })

    expect(binderWasSet).toBe(true)
  })

  it('installed binder calls bindAutomationSession with correct args', async () => {
    let installedBinder:
      | ((input: { workspaceId: string; sessionId: string; topicName: string }) => Promise<void>)
      | undefined

    const sessionManager: ISessionManager = {
      setAutomationBinder: (fn) => {
        installedBinder = fn
      },
    } as unknown as ISessionManager

    const registry = new MessagingGatewayRegistry({
      sessionManager,
      credentialManager: makeStubCredentialManager(),
      getMessagingDir: (workspaceId: string) =>
        join(dir, 'workspaces', workspaceId, 'messaging'),
      whatsapp: { workerEntry: '/dev/null' },
    })

    expect(installedBinder).toBeDefined()

    // Pair a supergroup and inject adapter so the binder can succeed
    const workspaceId = 'ws-binder-test'
    await registry.updateConfig(workspaceId, {
      enabled: true,
      platforms: {
        telegram: {
          enabled: true,
          supergroup: { chatId: '-100binder', title: 'Binder SG', capturedAt: Date.now() },
        },
      } as never,
    })

    const { adapter } = makeFakeTelegramAdapter()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (registry as any).workspaces.get(workspaceId)
    state.gateway.registerAdapter(adapter)

    // Invoke the binder as SessionManager would after spawning a session
    await installedBinder!({
      workspaceId,
      sessionId: 'session-binder',
      topicName: 'CI Failures',
    })

    // The binder's underlying bindAutomationSession should have created a binding
    const bindings = registry.getBindings(workspaceId)
    expect(bindings.length).toBe(1)
    expect(bindings[0]!.sessionId).toBe('session-binder')
    expect(bindings[0]!.channelId).toBe('-100binder')
  })

  it('installed binder does not crash when bindAutomationSession returns ok=false', async () => {
    let installedBinder:
      | ((input: { workspaceId: string; sessionId: string; topicName: string }) => Promise<void>)
      | undefined

    const sessionManager: ISessionManager = {
      setAutomationBinder: (fn) => {
        installedBinder = fn
      },
    } as unknown as ISessionManager

    new MessagingGatewayRegistry({
      sessionManager,
      credentialManager: makeStubCredentialManager(),
      getMessagingDir: (workspaceId: string) =>
        join(dir, 'workspaces', workspaceId, 'messaging'),
      whatsapp: { workerEntry: '/dev/null' },
    })

    // No supergroup paired → binder will get ok=false with reason='no-supergroup'
    // It must not throw — the SessionManager must continue spawning the session.
    let threw = false
    try {
      await installedBinder!({
        workspaceId: 'ws-no-sg',
        sessionId: 'session-resilient',
        topicName: 'Reports',
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests: removeAutomationTopic
// ---------------------------------------------------------------------------

describe('MessagingGatewayRegistry.removeAutomationTopic', () => {
  it('removes a cached topic entry so next bind creates a fresh one', async () => {
    const h = makeRegistry()
    await pairSupergroup(h, '-100remove')
    const { adapter, createCalls } = makeFakeTelegramAdapter()
    injectAdapter(h, adapter)

    // Create entry
    const first = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 's1',
      topicName: 'Temp Topic',
    })
    expect(first.ok).toBe(true)
    expect(createCalls.length).toBe(1)

    // Remove from registry
    await h.registry.removeAutomationTopic(h.workspaceId, 'Temp Topic')

    // Next bind must call createForumTopic again (new topic)
    const second = await h.registry.bindAutomationSession({
      workspaceId: h.workspaceId,
      sessionId: 's2',
      topicName: 'Temp Topic',
    })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.reused).toBe(false)
    expect(createCalls.length).toBe(2)
  })

  it('is a no-op for unknown workspace (no crash)', async () => {
    const h = makeRegistry()
    let threw = false
    try {
      await h.registry.removeAutomationTopic('ws-unknown', 'Any Topic')
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})
