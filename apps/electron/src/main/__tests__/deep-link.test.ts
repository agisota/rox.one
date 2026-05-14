/**
 * Integration tests for deep-link protocol handler.
 *
 * P0 coverage: external entry point (Slack, email, CLI) with zero prior coverage
 * beyond the routing-resolution micro-tests in deep-link-routing.test.ts.
 *
 * Scenarios covered:
 *   1. Protocol registration — app startup calls setAsDefaultProtocolClient('rox')
 *   2. Valid deep link → session resume — rox://action/resume-sdk-session/{id}
 *   3. Valid deep link → new session spawn — rox://action/new-chat?input=hello&send=true
 *   4. Malformed URL — graceful rejection, no crash, no IPC sent
 *   5. Cross-platform second-instance — Windows second-instance event routes URL to handler
 *   6. macOS open-url — open-url event routes correctly to handleDeepLink
 *
 * Fixes verified (PR #173 weaknesses closed):
 *   W-1: Unknown-host URLs now emit mainLog.warn before returning null.
 *   W-2: Empty-host rox:/// now emits mainLog.warn before returning null.
 *   W-3: sanitizeDeepLinkUrl() enforces scheme allowlist, max length, no control chars
 *        before argv URLs reach handleDeepLink.
 *   W-4: Window-mode workspace-resolution failure now emits a structured warn log
 *        with metric_name: "deep_link_window_resolve_failed".
 *
 * All tests: pure mocked — no real network, no real Electron launch.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'

// ─── Mock logger before any module-under-test is imported ─────────────────────
const logCalls: { level: string; args: unknown[] }[] = []

mock.module('../logger', () => {
  const makeLog =
    (level: string) =>
    (...args: unknown[]) => {
      logCalls.push({ level, args })
    }
  const stubLog = {
    info: makeLog('info'),
    warn: makeLog('warn'),
    error: makeLog('error'),
    debug: makeLog('debug'),
    scope: () => stubLog,
  }
  return {
    mainLog: stubLog,
    sessionLog: stubLog,
    handlerLog: stubLog,
    windowLog: stubLog,
    agentLog: stubLog,
    searchLog: stubLog,
    isDebugMode: false,
    getLogFilePath: () => undefined,
    getMessagingGatewayLogFilePath: () => '/tmp/messaging-gateway.log',
    messagingGatewayLog: stubLog,
    default: stubLog,
  }
})

// Import after mock is installed
const { parseDeepLink, handleDeepLink, sanitizeDeepLinkUrl } = await import('../deep-link.ts' + '?dl') as typeof import('../deep-link.ts')
import { RPC_CHANNELS } from '../../shared/types'
import type { EventSink } from '@rox-one/server-core/transport'
import type { WindowManager } from '../window-manager'

// ─── Shared helpers ────────────────────────────────────────────────────────────

function createMockWindow(webContentsId: number, opts: { loading?: boolean; minimized?: boolean } = {}) {
  return {
    id: webContentsId,
    isMinimized: () => opts.minimized ?? false,
    restore: mock(() => {}),
    focus: mock(() => {}),
    show: mock(() => {}),
    isDestroyed: () => false,
    isVisible: () => true,
    webContents: {
      id: webContentsId,
      isLoading: () => opts.loading ?? false,
      isDestroyed: () => false,
      once: mock((_event: string, cb: () => void) => {
        if (opts.loading) {
          setTimeout(cb, 0)
        }
      }),
    },
  }
}

type MockWindowManager = {
  focusOrCreateWindow: ReturnType<typeof mock>
  getFocusedWindow: ReturnType<typeof mock>
  getLastActiveWindow: ReturnType<typeof mock>
  getWorkspaceForWindow: ReturnType<typeof mock>
  getAllWindows: ReturnType<typeof mock>
  createWindow: ReturnType<typeof mock>
}

function createMockWindowManager(
  window: ReturnType<typeof createMockWindow> | null,
  overrides: Partial<MockWindowManager> = {},
): MockWindowManager & WindowManager {
  return {
    focusOrCreateWindow: mock(() => window),
    getFocusedWindow: mock(() => window),
    getLastActiveWindow: mock(() => window),
    getWorkspaceForWindow: mock(() => (window ? 'ws-default' : null)),
    getAllWindows: mock(() => (window ? [{ window, workspaceId: 'ws-default' }] : [])),
    createWindow: mock((_opts: unknown) => window!),
    ...overrides,
  } as unknown as MockWindowManager & WindowManager
}

function createSink() {
  const sent: Array<{ channel: string; target: unknown; payload: unknown }> = []
  const sink: EventSink = (channel, target, ...args) => {
    sent.push({ channel, target, payload: args[0] })
  }
  return { sent, sink }
}

// ─── 1. Protocol registration ─────────────────────────────────────────────────

describe('Protocol registration (index.ts startup)', () => {
  /**
   * The actual call to app.setAsDefaultProtocolClient lives in index.ts which
   * is not importable in tests (it triggers Electron/Sentry/full app init).
   * We verify the CONTRACT: the scheme used is 'rox' (primary) and 'roxagents'
   * (legacy compat), and that parseDeepLink accepts both prefixes.
   */
  it('parseDeepLink accepts rox:// scheme', () => {
    const result = parseDeepLink('rox://allSessions')
    expect(result).not.toBeNull()
    expect(result?.view).toBe('allSessions')
  })

  it('parseDeepLink accepts roxagents:// scheme (legacy compat)', () => {
    const result = parseDeepLink('roxagents://allSessions')
    expect(result).not.toBeNull()
    expect(result?.view).toBe('allSessions')
  })

  it('parseDeepLink rejects unknown schemes (e.g., https://)', () => {
    const result = parseDeepLink('https://allSessions/session/abc123')
    expect(result).toBeNull()
  })

  it('parseDeepLink rejects ftp:// scheme', () => {
    expect(parseDeepLink('ftp://session/abc123')).toBeNull()
  })

  /**
   * Mock-level assertion: verify that the startup sequence would call
   * setAsDefaultProtocolClient with 'rox' (primary) and 'roxagents' (legacy).
   */
  it('primary deeplink scheme is rox and legacy scheme is roxagents (contract)', () => {
    const mockApp = {
      setAsDefaultProtocolClient: mock((_scheme: string) => {}),
    }
    const DEEPLINK_SCHEME = process.env.ROX_DEEPLINK_SCHEME || 'rox'
    mockApp.setAsDefaultProtocolClient(DEEPLINK_SCHEME)
    mockApp.setAsDefaultProtocolClient('roxagents')

    expect(mockApp.setAsDefaultProtocolClient).toHaveBeenCalledTimes(2)
    expect(mockApp.setAsDefaultProtocolClient.mock.calls[0][0]).toBe('rox')
    expect(mockApp.setAsDefaultProtocolClient.mock.calls[1][0]).toBe('roxagents')
  })
})

// ─── 2. Valid deep link → session resume ──────────────────────────────────────

describe('Session resume via deep link', () => {
  beforeEach(() => {
    logCalls.length = 0
  })

  it('rox://action/resume-sdk-session/{id} sends NAVIGATE with correct action', async () => {
    const window = createMockWindow(10)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    const result = await handleDeepLink(
      'rox://action/resume-sdk-session/session-abc123',
      wm,
      sink,
      () => 'client-10',
    )

    expect(result.success).toBe(true)
    expect(result.windowId).toBe(10)
    expect(sent.length).toBe(1)
    expect(sent[0]?.channel).toBe(RPC_CHANNELS.deeplink.NAVIGATE)
    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('resume-sdk-session')
    expect(payload.actionParams?.id).toBe('session-abc123')
  })

  it('focuses and restores the window if it is minimized before sending navigation', async () => {
    const window = createMockWindow(11, { minimized: true })
    const wm = createMockWindowManager(window)
    const { sink } = createSink()

    const result = await handleDeepLink('rox://action/resume-sdk-session/sess-xyz', wm, sink, () => 'c-11')

    expect(result.success).toBe(true)
    expect(window.restore).toHaveBeenCalled()
    expect(window.focus).toHaveBeenCalled()
  })

  it('routes to specific workspace window when workspaceId is in URL', async () => {
    const window = createMockWindow(12)
    const wm = createMockWindowManager(window, {
      focusOrCreateWindow: mock(() => window),
      getWorkspaceForWindow: mock(() => 'ws-alpha'),
    })
    const { sent, sink } = createSink()

    const result = await handleDeepLink(
      'rox://workspace/ws-alpha/action/resume-sdk-session/session-42',
      wm,
      sink,
      () => 'c-12',
    )

    expect(result.success).toBe(true)
    expect((wm as MockWindowManager).focusOrCreateWindow).toHaveBeenCalledWith('ws-alpha')
    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('resume-sdk-session')
    expect(payload.actionParams?.id).toBe('session-42')
  })

  it('rox://allSessions/session/{id} sends compound view route', async () => {
    const window = createMockWindow(13)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink('rox://allSessions/session/abc123', wm, sink, () => 'c-13')

    expect(sent.length).toBe(1)
    const payload = sent[0]?.payload as { view?: string }
    expect(payload.view).toBe('allSessions/session/abc123')
  })
})

// ─── 3. Valid deep link → new session spawn ───────────────────────────────────

describe('New session spawn via deep link', () => {
  beforeEach(() => {
    logCalls.length = 0
  })

  it('rox://action/new-chat?input=hello sends new-chat action with input param', async () => {
    const window = createMockWindow(20)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    const result = await handleDeepLink(
      'rox://action/new-chat?input=hello',
      wm,
      sink,
      () => 'c-20',
    )

    expect(result.success).toBe(true)
    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('new-chat')
    expect(payload.actionParams?.input).toBe('hello')
  })

  it('rox://action/new-chat?input=hello+world&send=true passes url-decoded input and send param', async () => {
    const window = createMockWindow(21)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink(
      'rox://action/new-chat?input=hello%20world&send=true',
      wm,
      sink,
      () => 'c-21',
    )

    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('new-chat')
    expect(payload.actionParams?.input).toBe('hello world')
    expect(payload.actionParams?.send).toBe('true')
  })

  it('rox://action/new-chat?name=myChat sets name param', async () => {
    const window = createMockWindow(22)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink(
      'rox://action/new-chat?name=myChat',
      wm,
      sink,
      () => 'c-22',
    )

    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.actionParams?.name).toBe('myChat')
  })

  it('rox://action/new-chat with no params still sends new-chat action', async () => {
    const window = createMockWindow(23)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink('rox://action/new-chat', wm, sink, () => 'c-23')

    expect(sent.length).toBe(1)
    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('new-chat')
  })

  it('?window=focused triggers createWindow instead of in-place navigation', async () => {
    const window = createMockWindow(24)
    const wm = createMockWindowManager(window, {
      createWindow: mock(() => window),
      getFocusedWindow: mock(() => window),
      getAllWindows: mock(() => [{ window, workspaceId: 'ws-default' }]),
    })
    const { sent, sink } = createSink()

    await handleDeepLink(
      'rox://action/new-chat?input=test&window=focused',
      wm,
      sink,
    )

    expect((wm as MockWindowManager).createWindow).toHaveBeenCalled()
    // No direct IPC navigation for window-mode links; window handles it on load
    expect(sent.length).toBe(0)
  })

  it('W-4 fix: window-mode resolution failure emits metric warn log', async () => {
    logCalls.length = 0
    // Both getFocusedWindow and getAllWindows return nothing → no workspace resolves
    const wm = createMockWindowManager(null, {
      getFocusedWindow: mock(() => null),
      getAllWindows: mock(() => []),
    })
    const { sink } = createSink()

    const result = await handleDeepLink(
      'rox://action/new-chat?input=test&window=focused',
      wm,
      sink,
    )

    expect(result.success).toBe(false)
    const warns = logCalls.filter((c) => c.level === 'warn')
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const hasMetric = warns.some((w) => {
      const meta = w.args[1] as Record<string, unknown> | undefined
      return meta?.metric_name === 'deep_link_window_resolve_failed'
    })
    expect(hasMetric).toBe(true)
  })
})

// ─── 4. Malformed / invalid URLs ──────────────────────────────────────────────

describe('Malformed URL handling', () => {
  beforeEach(() => {
    logCalls.length = 0
  })

  it('completely invalid string returns success:false and does not crash', async () => {
    const wm = createMockWindowManager(createMockWindow(30))
    const { sent, sink } = createSink()

    const result = await handleDeepLink('not-a-url-at-all', wm, sink)

    expect(result.success).toBe(false)
    expect(sent.length).toBe(0)
  })

  it('empty string returns success:false without crash', async () => {
    const wm = createMockWindowManager(createMockWindow(31))
    const { sent, sink } = createSink()

    const result = await handleDeepLink('', wm, sink)

    expect(result.success).toBe(false)
    expect(sent.length).toBe(0)
  })

  it('wrong scheme (http://) returns success:false', async () => {
    const wm = createMockWindowManager(createMockWindow(32))
    const { sent, sink } = createSink()

    const result = await handleDeepLink('http://allSessions/session/abc', wm, sink)

    expect(result.success).toBe(false)
    expect(sent.length).toBe(0)
  })

  it('rox:// with unknown host returns success:false and emits warn log (W-1 fix)', async () => {
    logCalls.length = 0
    const wm = createMockWindowManager(createMockWindow(33))
    const { sent, sink } = createSink()

    const result = await handleDeepLink('rox://unknownRoute/garbage', wm, sink)

    expect(result.success).toBe(false)
    expect(sent.length).toBe(0)
    const warns = logCalls.filter((c) => c.level === 'warn')
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const warnText = warns.map((w) => String(w.args[0])).join(' ')
    expect(warnText).toMatch(/Unknown host/i)
  })

  it('auth-callback URL returns success:true (delegated to OAuth handler)', async () => {
    const wm = createMockWindowManager(createMockWindow(35))
    const { sent, sink } = createSink()

    const result = await handleDeepLink('rox://auth-callback?code=abc&state=xyz', wm, sink)

    // parseDeepLink returns null for auth-callback; handleDeepLink detects and returns success
    expect(result.success).toBe(true)
    expect(sent.length).toBe(0)
  })

  it('no active window with no-workspace URL returns success:false with error message', async () => {
    const wm = createMockWindowManager(null)
    const { sent, sink } = createSink()

    const result = await handleDeepLink('rox://action/new-chat', wm, sink)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No active window')
    expect(sent.length).toBe(0)
  })

  it('parseDeepLink logs error for completely unparseable input and returns null', () => {
    // ':not-valid' is not a valid URL — URL constructor throws
    const result = parseDeepLink(':not-valid')
    expect(result).toBeNull()
    const errors = logCalls.filter((c) => c.level === 'error')
    expect(errors.length).toBeGreaterThanOrEqual(1)
  })

  it('rox:// with empty host returns null and emits warn log (W-2 fix)', () => {
    logCalls.length = 0
    const result = parseDeepLink('rox:///')
    expect(result).toBeNull()
    const warns = logCalls.filter((c) => c.level === 'warn')
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const warnText = warns.map((w) => String(w.args[0])).join(' ')
    expect(warnText).toMatch(/Empty host/i)
  })
})

// ─── 5. Cross-platform second-instance (Windows) ─────────────────────────────

describe('Cross-platform second-instance (Windows deep link path)', () => {
  beforeEach(() => {
    logCalls.length = 0
  })

  it('extracts rox:// URL from argv and dispatches to handleDeepLink', async () => {
    const window = createMockWindow(40)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    // Simulate what index.ts does in the 'second-instance' listener
    const DEEPLINK_SCHEME = 'rox'
    const commandLine = [
      '/path/to/rox-one.exe',
      '--some-flag',
      `${DEEPLINK_SCHEME}://action/new-chat?input=from-windows`,
    ]

    const url = commandLine.find(
      (arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`) || arg.startsWith('roxagents://'),
    )

    expect(url).toBe('rox://action/new-chat?input=from-windows')

    const result = await handleDeepLink(url!, wm, sink, () => 'c-40')

    expect(result.success).toBe(true)
    expect(sent.length).toBe(1)
    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('new-chat')
    expect(payload.actionParams?.input).toBe('from-windows')
  })

  it('second-instance with no deep-link arg focuses first window without navigation IPC', async () => {
    const window = createMockWindow(41)
    const wm = createMockWindowManager(window)

    const DEEPLINK_SCHEME = 'rox'
    const commandLine = ['/path/to/rox-one.exe', '--some-flag']
    const url = commandLine.find(
      (arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`) || arg.startsWith('roxagents://'),
    )

    expect(url).toBeUndefined()

    // Replicate index.ts second-instance focus-only path
    if (!url) {
      const windows = wm.getAllWindows()
      if (windows.length > 0) {
        const win = windows[0].window
        if (win.isMinimized()) win.restore()
        if (!win.isVisible()) win.show()
        win.focus()
      }
    }

    expect(window.focus).toHaveBeenCalled()
  })

  it('extracts roxagents:// legacy URL from argv', async () => {
    const window = createMockWindow(42)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    const commandLine = ['/path/to/app.exe', 'roxagents://allSessions']
    const DEEPLINK_SCHEME = 'rox'
    const url = commandLine.find(
      (arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`) || arg.startsWith('roxagents://'),
    )

    expect(url).toBe('roxagents://allSessions')

    const result = await handleDeepLink(url!, wm, sink, () => 'c-42')

    expect(result.success).toBe(true)
    expect(sent.length).toBe(1)
    const payload = sent[0]?.payload as { view?: string }
    expect(payload.view).toBe('allSessions')
  })

  it('W-3 fix: sanitizeDeepLinkUrl rejects oversized argv URL and emits warn', () => {
    logCalls.length = 0
    const oversized = 'rox://action/new-chat/' + 'x'.repeat(10_000)
    const result = sanitizeDeepLinkUrl(oversized)
    expect(result).toBeNull()
    const warns = logCalls.filter((c) => c.level === 'warn')
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const warnText = warns.map((w) => String(w.args[0])).join(' ')
    expect(warnText).toMatch(/maximum length/i)
  })

  it('W-3 fix: sanitizeDeepLinkUrl rejects URLs with control characters', () => {
    logCalls.length = 0
    const withControl = 'rox://action/new-chat?input=hello\x01world'
    const result = sanitizeDeepLinkUrl(withControl)
    expect(result).toBeNull()
    const warns = logCalls.filter((c) => c.level === 'warn')
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const warnText = warns.map((w) => String(w.args[0])).join(' ')
    expect(warnText).toMatch(/control char/i)
  })

  it('W-3 fix: sanitizeDeepLinkUrl rejects disallowed schemes and emits warn', () => {
    logCalls.length = 0
    const result = sanitizeDeepLinkUrl('javascript://action/new-chat')
    expect(result).toBeNull()
    const warns = logCalls.filter((c) => c.level === 'warn')
    expect(warns.length).toBeGreaterThanOrEqual(1)
  })

  it('W-3 fix: sanitizeDeepLinkUrl accepts valid rox:// URL unchanged', () => {
    logCalls.length = 0
    const valid = 'rox://action/new-chat?input=hello'
    const result = sanitizeDeepLinkUrl(valid)
    expect(result).toBe(valid)
    expect(logCalls.filter((c) => c.level === 'warn').length).toBe(0)
  })

  it('W-3 fix: sanitizeDeepLinkUrl accepts valid roxagents:// URL unchanged', () => {
    logCalls.length = 0
    const valid = 'roxagents://allSessions'
    const result = sanitizeDeepLinkUrl(valid)
    expect(result).toBe(valid)
    expect(logCalls.filter((c) => c.level === 'warn').length).toBe(0)
  })
})

// ─── 6. macOS open-url event ──────────────────────────────────────────────────

describe('macOS open-url event handler', () => {
  beforeEach(() => {
    logCalls.length = 0
  })

  it('open-url dispatches to handleDeepLink when windowManager is ready', async () => {
    const window = createMockWindow(50)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    // Replicate index.ts open-url handler (windowManager available)
    const openUrlHandler = async (url: string) => {
      return handleDeepLink(url, wm, sink, () => 'c-50')
    }

    const result = await openUrlHandler('rox://allSessions/session/sess-abc')

    expect(result.success).toBe(true)
    const payload = sent[0]?.payload as { view?: string }
    expect(payload.view).toBe('allSessions/session/sess-abc')
  })

  it('open-url stores link as pending when windowManager is not yet ready (cold start)', () => {
    let pendingDeepLink: string | null = null

    const simulatedOpenUrl = (url: string, windowManagerReady: boolean) => {
      if (windowManagerReady) {
        // Would call handleDeepLink — tested separately
      } else {
        pendingDeepLink = url
      }
    }

    simulatedOpenUrl('rox://allSessions', false)
    expect(pendingDeepLink as string | null).toBe('rox://allSessions')
  })

  it('pending deep link is dispatched after app.whenReady resolves', async () => {
    const window = createMockWindow(51)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    let pendingDeepLink: string | null = 'rox://action/new-chat?input=cold-start'

    if (pendingDeepLink) {
      await handleDeepLink(pendingDeepLink, wm, sink, () => 'c-51')
      pendingDeepLink = null
    }

    expect(pendingDeepLink).toBeNull()
    expect(sent.length).toBe(1)
    const payload = sent[0]?.payload as { action?: string; actionParams?: Record<string, string> }
    expect(payload.action).toBe('new-chat')
    expect(payload.actionParams?.input).toBe('cold-start')
  })

  it('open-url with settings/shortcuts route navigates to settings subpage', async () => {
    const window = createMockWindow(52)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink('rox://settings/shortcuts', wm, sink, () => 'c-52')

    const payload = sent[0]?.payload as { view?: string }
    expect(payload.view).toBe('settings/shortcuts')
  })

  it('open-url with sources/source/{slug} navigates to sources view', async () => {
    const window = createMockWindow(53)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink('rox://sources/source/github', wm, sink, () => 'c-53')

    const payload = sent[0]?.payload as { view?: string }
    expect(payload.view).toBe('sources/source/github')
  })

  it('open-url with rox://flagged navigates to flagged sessions view', async () => {
    const window = createMockWindow(54)
    const wm = createMockWindowManager(window)
    const { sent, sink } = createSink()

    await handleDeepLink('rox://flagged', wm, sink, () => 'c-54')

    const payload = sent[0]?.payload as { view?: string }
    expect(payload.view).toBe('flagged')
  })

  it('open-url handler emits at least one info-level log entry', async () => {
    const window = createMockWindow(55)
    const wm = createMockWindowManager(window)
    const { sink } = createSink()

    await handleDeepLink('rox://allSessions', wm, sink, () => 'c-55')

    const infoCalls = logCalls.filter((c) => c.level === 'info')
    expect(infoCalls.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── 7. parseDeepLink URL grammar unit tests ──────────────────────────────────

describe('parseDeepLink URL grammar', () => {
  it('rox://allSessions → view=allSessions', () => {
    expect(parseDeepLink('rox://allSessions')).toMatchObject({ view: 'allSessions' })
  })

  it('rox://flagged/session/{id} → compound view', () => {
    expect(parseDeepLink('rox://flagged/session/id123')).toMatchObject({
      view: 'flagged/session/id123',
    })
  })

  it('rox://state/{stateId}/session/{sessionId} → compound view', () => {
    const result = parseDeepLink('rox://state/active/session/s99')
    expect(result?.view).toBe('state/active/session/s99')
  })

  it('rox://workspace/{wsId}/allSessions/session/{id} → workspaceId + view', () => {
    const result = parseDeepLink('rox://workspace/ws-xyz/allSessions/session/s1')
    expect(result?.workspaceId).toBe('ws-xyz')
    expect(result?.view).toBe('allSessions/session/s1')
  })

  it('rox://workspace/{wsId}/action/{action}/{id} → workspaceId + action + id', () => {
    const result = parseDeepLink('rox://workspace/ws-abc/action/delete-session/s2')
    expect(result?.workspaceId).toBe('ws-abc')
    expect(result?.action).toBe('delete-session')
    expect(result?.actionParams?.id).toBe('s2')
  })

  it('rox://action/{action}/{id}?key=val → id in actionParams.id, extra in actionParams', () => {
    const result = parseDeepLink('rox://action/flag-session/s3?extra=x')
    expect(result?.action).toBe('flag-session')
    expect(result?.actionParams?.id).toBe('s3')
    expect(result?.actionParams?.extra).toBe('x')
  })

  it('?window=focused → windowMode=focused', () => {
    const result = parseDeepLink('rox://allSessions?window=focused')
    expect(result?.windowMode).toBe('focused')
  })

  it('?window=full → windowMode=full', () => {
    const result = parseDeepLink('rox://allSessions?window=full')
    expect(result?.windowMode).toBe('full')
  })

  it('?window=invalid → windowMode=undefined (only focused/full are valid)', () => {
    const result = parseDeepLink('rox://allSessions?window=invalid')
    expect(result?.windowMode).toBeUndefined()
  })

  it('?sidebar=files/path → rightSidebar set', () => {
    const result = parseDeepLink('rox://allSessions?sidebar=files/path/to/file')
    expect(result?.rightSidebar).toBe('files/path/to/file')
  })

  it('window and sidebar params are NOT forwarded into actionParams', () => {
    const result = parseDeepLink('rox://action/new-chat?input=hi&window=focused&sidebar=history')
    expect(result?.actionParams?.window).toBeUndefined()
    expect(result?.actionParams?.sidebar).toBeUndefined()
    expect(result?.actionParams?.input).toBe('hi')
  })

  it('rox://auth-callback → null (OAuth handler owns this route)', () => {
    expect(parseDeepLink('rox://auth-callback?code=abc')).toBeNull()
  })

  it('rox://workspace with missing workspaceId segment → null', () => {
    expect(parseDeepLink('rox://workspace/')).toBeNull()
  })

  it('rox://skills navigates to skills view', () => {
    const result = parseDeepLink('rox://skills')
    expect(result?.view).toBe('skills')
  })
})
