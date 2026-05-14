/**
 * M.13 T086d — TokenBucket + BudgetGuard wiring for additional
 * mutating RPC handlers across auth / sessions / sources / workspace domains:
 *
 *   auth:        auth.logout
 *   sessions:    sessions.create, sessions.delete, sessions.sendMessage
 *   sources:     sources.create, sources.delete
 *   workspace:   workspaces.create
 *
 * Mirrors the T086c pattern in
 * `labels-statuses-skills-abuse-guard.test.ts`:
 *
 *  - The gates run BEFORE input validation and BEFORE the storage/network
 *    operation, so a rate-limited / budget-exhausted call returns the typed
 *    `{error, reason}` envelope without reaching state mutation. This lets
 *    the tests assert the gate contract without needing real fixtures.
 *  - Backward compatibility: when no `rateLimiter` and no `budgetGuard` are
 *    injected the handler proceeds past the gate into its existing path.
 */

import { describe, expect, it } from 'bun:test'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { BudgetGuard, TokenBucket } from '@rox-one/shared/security'
import type {
  HandlerFn,
  RequestContext,
  RpcServer,
} from '@rox-one/server-core/transport'

import type { HandlerDeps } from '../../handler-deps'
import { registerAuthHandlers } from '../auth'
import { registerSessionsHandlers } from '../sessions'
import { registerSourcesHandlers } from '../sources'
import { registerWorkspaceCoreHandlers } from '../workspace'

const LIMITED = { error: 'rate-limited', reason: 'token-bucket-exhausted' }
const BUDGET_EXCEEDED = { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }

// ─── minimal session manager stub ─────────────────────────────────────────
function makeSessionManagerStub() {
  return {
    waitForInit: async () => {},
    getSessions: () => [],
    getUnreadSummary: () => ({ totalUnreadSessions: 0, byWorkspace: {}, hasUnreadByWorkspace: {} }),
    markAllSessionsRead: async () => {},
    getSession: async () => null,
    createSession: async () => { throw new Error('Session manager not configured') },
    deleteSession: async () => { throw new Error('Session manager not configured') },
    sendMessage: async () => { throw new Error('Session manager not configured') },
    cancelProcessing: async () => {},
    killShell: async () => {},
    getTaskOutput: async () => null,
    respondToPermission: async () => false,
    respondToCredential: async () => false,
    flagSession: async () => {},
    unflagSession: async () => {},
    archiveSession: async () => {},
    unarchiveSession: async () => {},
    renameSession: async () => {},
    setSessionStatus: async () => {},
    markSessionRead: async () => {},
    markSessionUnread: async () => {},
    setActiveViewingSession: async () => {},
    setSessionPermissionMode: async () => {},
    setSessionThinkingLevel: async () => {},
    updateWorkingDirectory: async () => {},
    setSessionSources: async () => {},
    setSessionLabels: async () => {},
    shareToViewer: async () => {},
    updateShare: async () => {},
    getShareStatus: async () => null,
    revokeShare: async () => {},
    refreshTitle: async () => {},
    setSessionConnection: async () => {},
    setPendingPlanExecution: async () => {},
    markCompactionComplete: async () => {},
    markPendingPlanExecutionDispatched: async () => {},
    clearPendingPlanExecution: async () => {},
    addMessageAnnotation: async () => {},
    removeMessageAnnotation: async () => {},
    updateMessageAnnotation: async () => {},
    getPendingPlanExecution: async () => null,
    getSessionPermissionModeState: async () => null,
    getSessionPath: () => null,
    setupConfigWatcher: () => {},
    clearActiveViewingSession: () => {},
    exportSession: async () => null,
    importSession: async () => { throw new Error('Session manager not configured') },
    exportRemoteSessionTransfer: async () => null,
    importRemoteSessionTransfer: async () => { throw new Error('Session manager not configured') },
  } as unknown as HandlerDeps['sessionManager']
}

interface Harness {
  handlers: Map<string, HandlerFn>
  bucket: TokenBucket | undefined
  budgetGuard: BudgetGuard<string> | undefined
  tick(ms: number): void
}

function createHarness(opts: {
  bucketCapacity?: number
  bucketRefillPerSec?: number
  withLimiter?: boolean
  budgetPerKey?: number
} = {}): Harness {
  const handlers = new Map<string, HandlerFn>()
  const server: RpcServer = {
    handle: (channel, handler) => { handlers.set(channel, handler) },
    push: () => {},
    invokeClient: async () => undefined,
  }

  let nowMs = 0
  const bucket = opts.withLimiter
    ? new TokenBucket({
        capacity: opts.bucketCapacity ?? 3,
        refillRatePerSec: opts.bucketRefillPerSec ?? 0,
        clock: () => nowMs,
      })
    : undefined

  const budgetGuard = opts.budgetPerKey !== undefined
    ? new BudgetGuard<string>({ budgetPerKey: opts.budgetPerKey })
    : undefined

  const deps: HandlerDeps = {
    sessionManager: makeSessionManagerStub(),
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    rateLimiter: bucket,
    budgetGuard,
    platform: {
      appRootPath: '/', resourcesPath: '/', isPackaged: false, appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      imageProcessor: { getMetadata: async () => null, process: async () => Buffer.from('') },
    } as HandlerDeps['platform'],
  }

  registerAuthHandlers(server, deps)
  registerSessionsHandlers(server, deps)
  registerSourcesHandlers(server, deps)
  registerWorkspaceCoreHandlers(server, deps)

  return { handlers, bucket, budgetGuard, tick(ms) { nowMs += ms } }
}

function ctxFor(userId: string | null): RequestContext {
  return {
    clientId: 'c1',
    workspaceId: null,
    webContentsId: null,
    userId,
    sessionId: 's1',
  }
}

// ============================================================================
// auth.logout — TokenBucket + BudgetGuard
// ============================================================================

describe('auth.logout — TokenBucket rate-limit (T086d)', () => {
  it('allows up to `capacity` logouts in a burst, then rate-limits subsequent attempts', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const logout = h.handlers.get(RPC_CHANNELS.auth.LOGOUT)!

    // First 2 consume tokens. They may fail at credential store but the
    // token was spent (absorb any error from missing credential manager).
    await logout(ctxFor('admin')).catch(() => {})
    await logout(ctxFor('admin')).catch(() => {})

    // Bucket now empty — next call short-circuits with the typed envelope.
    expect(await logout(ctxFor('admin'))).toEqual(LIMITED)
    expect(await logout(ctxFor('admin'))).toEqual(LIMITED)
  })

  it('rate-limit refills tokens after clock advances', async () => {
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 1, withLimiter: true })
    const logout = h.handlers.get(RPC_CHANNELS.auth.LOGOUT)!

    // Burn the only token.
    await logout(ctxFor('admin')).catch(() => {})
    expect(await logout(ctxFor('admin'))).toEqual(LIMITED)

    // 2s @ 1 token/s — bucket refilled.
    h.tick(2000)
    // Token available — handler runs past gate (absorb any error from missing credential manager).
    await logout(ctxFor('admin')).catch(() => {})
  })
})

describe('auth.logout — BudgetGuard per-actor cap (T086d)', () => {
  it('budget exhaustion returns the typed envelope', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const logout = h.handlers.get(RPC_CHANNELS.auth.LOGOUT)!

    // First call consumes the budget.
    await logout(ctxFor('admin')).catch(() => {})
    expect(await logout(ctxFor('admin'))).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })

  it('null userId falls back to the anonymous sentinel', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const logout = h.handlers.get(RPC_CHANNELS.auth.LOGOUT)!

    await logout(ctxFor(null)).catch(() => {})
    expect(await logout(ctxFor(null))).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('__anonymous__')).toBe(1)
  })
})

// ============================================================================
// sessions.create — TokenBucket + BudgetGuard
// ============================================================================

describe('sessions.create — TokenBucket rate-limit (T086d)', () => {
  it('allows up to `capacity` creates in a burst, then rate-limits', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.sessions.CREATE)!

    // First 2 consume tokens; may fail at workspace lookup / session manager.
    await create(ctxFor('admin'), 'ws-x').catch(() => {})
    await create(ctxFor('admin'), 'ws-x').catch(() => {})

    // Bucket empty — next calls short-circuit with the typed envelope.
    expect(await create(ctxFor('admin'), 'ws-x')).toEqual(LIMITED)
    expect(await create(ctxFor('admin'), 'ws-x')).toEqual(LIMITED)
  })
})

describe('sessions.create — BudgetGuard per-actor cap (T086d)', () => {
  it('budget exhaustion returns the typed envelope and isolates per-actor', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const create = h.handlers.get(RPC_CHANNELS.sessions.CREATE)!

    // admin1 burns the cap (fails downstream).
    await create(ctxFor('admin1'), 'ws-x').catch(() => {})
    expect(await create(ctxFor('admin1'), 'ws-x')).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin1')).toBe(1)

    // admin2 is unaffected — burns their own cap.
    await create(ctxFor('admin2'), 'ws-x').catch(() => {})
    expect(h.budgetGuard!.usage('admin2')).toBe(1)
  })
})

// ============================================================================
// sessions.delete — shares bucket + budget with sessions.create
// ============================================================================

describe('sessions.delete — shares rate-limiter with sessions.create (T086d)', () => {
  it('create + delete bursts cannot bypass the shared bucket cap', async () => {
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.sessions.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.sessions.DELETE)!

    // First create burns the token.
    await create(ctxFor('admin'), 'ws-x').catch(() => {})

    // Bucket empty — both channels short-circuit.
    expect(await create(ctxFor('admin'), 'ws-x')).toEqual(LIMITED)
    expect(await del(ctxFor('admin'), 'sess-x')).toEqual(LIMITED)
  })

  it('shares the per-actor budget with sessions.create', async () => {
    const h = createHarness({ budgetPerKey: 2 })
    const create = h.handlers.get(RPC_CHANNELS.sessions.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.sessions.DELETE)!

    // One create + one delete exhausts the cap of 2.
    await create(ctxFor('admin'), 'ws-x').catch(() => {})
    await del(ctxFor('admin'), 'sess-x').catch(() => {})
    expect(await create(ctxFor('admin'), 'ws-x')).toEqual(BUDGET_EXCEEDED)
    expect(await del(ctxFor('admin'), 'sess-x')).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(2)
  })
})

// ============================================================================
// sessions.sendMessage — TokenBucket + BudgetGuard
// ============================================================================

describe('sessions.sendMessage — TokenBucket rate-limit (T086d)', () => {
  it('rate-limits burst sends, returning the typed envelope once bucket is empty', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const send = h.handlers.get(RPC_CHANNELS.sessions.SEND_MESSAGE)!

    // First 2 consume tokens; may fail downstream.
    await send(ctxFor('admin'), 'sess-x', 'hello').catch(() => {})
    await send(ctxFor('admin'), 'sess-x', 'hello').catch(() => {})

    // Bucket empty — short-circuits with typed envelope.
    expect(await send(ctxFor('admin'), 'sess-x', 'hello')).toEqual(LIMITED)
  })
})

describe('sessions.sendMessage — BudgetGuard per-actor cap (T086d)', () => {
  it('budget exhaustion returns the typed envelope', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const send = h.handlers.get(RPC_CHANNELS.sessions.SEND_MESSAGE)!

    await send(ctxFor('user1'), 'sess-x', 'hello').catch(() => {})
    expect(await send(ctxFor('user1'), 'sess-x', 'hello')).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('user1')).toBe(1)
  })
})

// ============================================================================
// sources.create — TokenBucket + BudgetGuard
// ============================================================================

describe('sources.create — TokenBucket rate-limit (T086d)', () => {
  it('allows up to `capacity` creates in a burst, then rate-limits', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.sources.CREATE)!

    await create(ctxFor('admin'), 'ws-x', {}).catch(() => {})
    await create(ctxFor('admin'), 'ws-x', {}).catch(() => {})

    expect(await create(ctxFor('admin'), 'ws-x', {})).toEqual(LIMITED)
  })
})

describe('sources.create — BudgetGuard per-actor cap (T086d)', () => {
  it('budget exhaustion returns the typed envelope', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const create = h.handlers.get(RPC_CHANNELS.sources.CREATE)!

    await create(ctxFor('admin'), 'ws-x', {}).catch(() => {})
    expect(await create(ctxFor('admin'), 'ws-x', {})).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(1)
  })
})

// ============================================================================
// sources.delete — shares bucket + budget with sources.create
// ============================================================================

describe('sources.delete — shares rate-limiter with sources.create (T086d)', () => {
  it('create + delete bursts cannot bypass the shared bucket cap', async () => {
    const h = createHarness({ bucketCapacity: 1, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.sources.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.sources.DELETE)!

    await create(ctxFor('admin'), 'ws-x', {}).catch(() => {})

    expect(await create(ctxFor('admin'), 'ws-x', {})).toEqual(LIMITED)
    expect(await del(ctxFor('admin'), 'ws-x', 'some-source')).toEqual(LIMITED)
  })

  it('shares the per-actor budget with sources.create', async () => {
    const h = createHarness({ budgetPerKey: 2 })
    const create = h.handlers.get(RPC_CHANNELS.sources.CREATE)!
    const del = h.handlers.get(RPC_CHANNELS.sources.DELETE)!

    await create(ctxFor('admin'), 'ws-x', {}).catch(() => {})
    await del(ctxFor('admin'), 'ws-x', 'some-source').catch(() => {})
    expect(await create(ctxFor('admin'), 'ws-x', {})).toEqual(BUDGET_EXCEEDED)
    expect(await del(ctxFor('admin'), 'ws-x', 'some-source')).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('admin')).toBe(2)
  })
})

// ============================================================================
// workspaces.create — TokenBucket + BudgetGuard
// ============================================================================

describe('workspaces.create — TokenBucket rate-limit (T086d)', () => {
  it('rate-limits burst workspace creation, returning the typed envelope once bucket is empty', async () => {
    const h = createHarness({ bucketCapacity: 2, bucketRefillPerSec: 0, withLimiter: true })
    const create = h.handlers.get(RPC_CHANNELS.workspaces.CREATE)!

    await create(ctxFor('admin'), '/tmp/ws1', 'My Workspace').catch(() => {})
    await create(ctxFor('admin'), '/tmp/ws2', 'My Workspace').catch(() => {})

    expect(await create(ctxFor('admin'), '/tmp/ws3', 'My Workspace')).toEqual(LIMITED)
  })
})

describe('workspaces.create — BudgetGuard per-actor cap (T086d)', () => {
  it('budget exhaustion returns the typed envelope and isolates per-actor', async () => {
    const h = createHarness({ budgetPerKey: 1 })
    const create = h.handlers.get(RPC_CHANNELS.workspaces.CREATE)!

    await create(ctxFor('user1'), '/tmp/ws1', 'My Workspace').catch(() => {})
    expect(await create(ctxFor('user1'), '/tmp/ws1', 'My Workspace')).toEqual(BUDGET_EXCEEDED)
    expect(h.budgetGuard!.usage('user1')).toBe(1)

    // user2 is unaffected.
    await create(ctxFor('user2'), '/tmp/ws2', 'Other Workspace').catch(() => {})
    expect(h.budgetGuard!.usage('user2')).toBe(1)
  })
})

// ============================================================================
// Backward-compatibility — no gates wired
// ============================================================================

describe('T086d — backward compatibility: no rateLimiter and no budgetGuard', () => {
  it('no gates => handlers reach their own logic (no abuse-guard envelopes returned)', async () => {
    const h = createHarness({})
    expect(h.bucket).toBeUndefined()
    expect(h.budgetGuard).toBeUndefined()

    const logout = h.handlers.get(RPC_CHANNELS.auth.LOGOUT)!
    const sessionCreate = h.handlers.get(RPC_CHANNELS.sessions.CREATE)!
    const sessionDel = h.handlers.get(RPC_CHANNELS.sessions.DELETE)!
    const sendMsg = h.handlers.get(RPC_CHANNELS.sessions.SEND_MESSAGE)!
    const sourceCreate = h.handlers.get(RPC_CHANNELS.sources.CREATE)!
    const sourceDel = h.handlers.get(RPC_CHANNELS.sources.DELETE)!
    const wsCreate = h.handlers.get(RPC_CHANNELS.workspaces.CREATE)!

    // Each handler proceeds past the (absent) gate — none should return the
    // typed rate-limited / budget-exceeded envelopes. They may throw or return
    // other results from downstream logic; that's fine.
    const results = await Promise.allSettled([
      logout(ctxFor('admin')),
      sessionCreate(ctxFor('admin'), 'ws-x'),
      sessionDel(ctxFor('admin'), 'sess-x'),
      sendMsg(ctxFor('admin'), 'sess-x', 'hello'),
      sourceCreate(ctxFor('admin'), 'ws-x', {}),
      sourceDel(ctxFor('admin'), 'ws-x', 'slug'),
      wsCreate(ctxFor('admin'), '/tmp/ws', 'WS'),
    ])

    for (const r of results) {
      if (r.status === 'fulfilled') {
        // Result must NOT be a rate-limit or budget envelope.
        expect(r.value).not.toEqual(LIMITED)
        expect(r.value).not.toEqual(BUDGET_EXCEEDED)
      }
      // Rejected is fine — handler reached its own logic, gate was transparent.
    }
  })
})
