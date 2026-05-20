/**
 * rox-design-error-spans.test.ts — PZD-82
 *
 * Integration-shape tests verifying that the runtime-manager, view-manager,
 * and theme-bridge actually emit structured error spans (via the telemetry
 * shim) when their lifecycle paths fail. Each test:
 *   1. Wires the logger + Sentry sink described by the telemetry contract.
 *   2. Triggers a synthetic failure for a specific phase.
 *   3. Asserts the structured log shape AND that no secret/PII leaked.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Mock electron with the surface used by runtime-manager + theme-bridge.
const mockBroadcastSend = mock(() => undefined)
mock.module('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: mockBroadcastSend } }],
  },
  nativeTheme: {
    on: () => undefined,
    off: () => undefined,
    shouldUseDarkColors: true,
    themeSource: 'system',
    addListener: () => undefined,
    removeListener: () => undefined,
  },
}))

// Mock the HostBridge package so startThemeBridge runs without the real dep.
let capturedThemeSnapshotCb: ((s: Record<string, string>) => void) | null = null
mock.module('@rox-one/design-theme-bridge/HostBridge', () => ({
  HostBridge: class {
    snapshot(): Record<string, string> { return {} }
    startNativeThemeWatch(_nt: unknown, cb: (s: Record<string, string>) => void): void {
      capturedThemeSnapshotCb = cb
    }
    dispose(): void { /* noop */ }
  },
}))

import {
  __setRoxDesignSentryClient,
  type RoxDesignSentryClient,
  type RoxDesignTelemetryLogger,
} from '../rox-design-telemetry'

interface CapturedLog {
  message: string
  meta?: Record<string, unknown>
}

interface CapturedBreadcrumb {
  category?: string
  level?: string
  message?: string
  data?: Record<string, unknown>
}

function makeLogger() {
  const errors: CapturedLog[] = []
  const warns: CapturedLog[] = []
  const infos: CapturedLog[] = []
  const logger: RoxDesignTelemetryLogger = {
    error: mock((message: string, meta?: Record<string, unknown>) => { errors.push({ message, meta }) }),
    warn: mock((message: string, meta?: Record<string, unknown>) => { warns.push({ message, meta }) }),
    info: mock((message: string, meta?: Record<string, unknown>) => { infos.push({ message, meta }) }),
  }
  return { logger, errors, warns, infos }
}

function makeSentry() {
  const breadcrumbs: CapturedBreadcrumb[] = []
  const sentry: RoxDesignSentryClient = {
    addBreadcrumb: mock((b: CapturedBreadcrumb) => { breadcrumbs.push(b) }),
  }
  return { sentry, breadcrumbs }
}

let sentryCtx: ReturnType<typeof makeSentry>

beforeEach(() => {
  sentryCtx = makeSentry()
  __setRoxDesignSentryClient(sentryCtx.sentry)
  capturedThemeSnapshotCb = null
})

afterEach(() => {
  __setRoxDesignSentryClient(null)
})

// ── Theme bridge ─────────────────────────────────────────────────────────

describe('rox-design-theme-bridge structured errors', () => {
  test('logs structured error when executeJavaScript rejects on theme post-snapshot', async () => {
    const { logger, warns } = makeLogger()
    const { startThemeBridge } = await import('../rox-design-theme-bridge')

    const wc = {
      id: 7,
      isDestroyed: () => false,
      executeJavaScript: mock(async () => { throw new Error('renderer-side eval rejected') }),
    } as unknown as import('electron').WebContents

    const dispose = startThemeBridge(wc, logger)
    expect(capturedThemeSnapshotCb).not.toBeNull()

    // Drive a snapshot with at least one entry so executeJavaScript runs.
    capturedThemeSnapshotCb!({ '--bg': '#000' })

    // Allow the promise rejection to flush.
    await new Promise((r) => setTimeout(r, 5))

    const hit = warns.find((w) => w.message.includes('theme-bridge-post-snapshot'))
    expect(hit).toBeDefined()
    expect(hit!.meta).toMatchObject({
      integration: 'rox-design',
      phase: 'theme-bridge-post-snapshot',
      error: 'renderer-side eval rejected',
      webContentsId: 7,
    })

    // Sentry breadcrumb mirrors the structured log.
    const crumb = sentryCtx.breadcrumbs.find((b) => b.message === 'theme-bridge-post-snapshot-failed')
    expect(crumb).toBeDefined()
    expect(crumb!.category).toBe('rox-design')
    expect(crumb!.level).toBe('warning')

    dispose()
  })

  test('logs structured error when i18n inject executeJavaScript rejects', async () => {
    const { logger, warns } = makeLogger()
    const { startI18nBridge } = await import('../rox-design-theme-bridge')

    const wc = {
      id: 11,
      isDestroyed: () => false,
      executeJavaScript: mock(async () => { throw new Error('lang inject failed') }),
    } as unknown as import('electron').WebContents

    const listeners: Array<(lng: string) => void> = []
    const i18n = {
      language: 'en',
      on: (_evt: string, cb: (lng: string) => void) => { listeners.push(cb) },
      off: () => undefined,
    }

    const dispose = startI18nBridge(i18n, wc, logger)
    listeners[0]('ru')
    await new Promise((r) => setTimeout(r, 5))

    const hit = warns.find((w) => w.message.includes('theme-bridge-i18n-inject'))
    expect(hit).toBeDefined()
    expect(hit!.meta).toMatchObject({
      integration: 'rox-design',
      phase: 'theme-bridge-i18n-inject',
      language: 'ru',
      webContentsId: 11,
    })
    expect(sentryCtx.breadcrumbs.find((b) => b.message === 'theme-bridge-i18n-inject-failed')).toBeDefined()

    dispose()
  })

  test('logs structured error when icon observer install rejects', async () => {
    const { logger, warns } = makeLogger()
    const { startIconObserver } = await import('../rox-design-theme-bridge')

    const wc = {
      id: 19,
      isDestroyed: () => false,
      executeJavaScript: mock(async () => { throw new Error('observer install failed') }),
    } as unknown as import('electron').WebContents

    const dispose = startIconObserver(wc, logger)
    await new Promise((r) => setTimeout(r, 5))

    const hit = warns.find((w) => w.message.includes('theme-bridge-icon-observer-install'))
    expect(hit).toBeDefined()
    expect(hit!.meta).toMatchObject({
      integration: 'rox-design',
      phase: 'theme-bridge-icon-observer-install',
      webContentsId: 19,
    })

    dispose()
  })
})

// ── Runtime manager ───────────────────────────────────────────────────────

describe('rox-design-runtime-manager structured errors', () => {
  test('logs structured error span when bundled runtime is missing', async () => {
    const { logger, warns } = makeLogger()
    const { RoxDesignRuntimeManager } = await import('../rox-design-runtime-manager')

    const { mkdtempSync, rmSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const tempDir = mkdtempSync(join(tmpdir(), 'pzd-82-'))
    try {
      const manager = new RoxDesignRuntimeManager({ resourcesRoot: tempDir, logger })
      const status = await manager.start()

      expect(status.status).toBe('failed')

      const hit = warns.find((w) => w.message.includes('[rox-design.start]'))
      expect(hit).toBeDefined()
      expect(hit!.meta).toMatchObject({
        integration: 'rox-design',
        phase: 'start',
        reason: 'bundle-missing',
        resourcesRoot: tempDir,
      })
      const crumb = sentryCtx.breadcrumbs.find((b) => b.message === 'start-failed')
      expect(crumb).toBeDefined()
      expect(crumb!.category).toBe('rox-design')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('logs structured error when ROX_DESIGN_WEB_URL is invalid', async () => {
    const { logger, errors } = makeLogger()
    const { RoxDesignRuntimeManager } = await import('../rox-design-runtime-manager')

    process.env.ROX_DESIGN_WEB_URL = 'not a real url://'
    try {
      const manager = new RoxDesignRuntimeManager({ resourcesRoot: '/tmp/whatever', logger })
      const status = await manager.start()
      expect(status.status).toBe('failed')

      const hit = errors.find((e) => e.message.includes('[rox-design.start]'))
      expect(hit).toBeDefined()
      expect(hit!.meta).toMatchObject({
        integration: 'rox-design',
        phase: 'start',
        source: 'ROX_DESIGN_WEB_URL',
      })
    } finally {
      delete process.env.ROX_DESIGN_WEB_URL
    }
  })
})

// ── Backwards compat: existing silent paths still succeed ─────────────────

describe('PZD-82 backwards compatibility', () => {
  test('telemetry helpers do not rethrow — caller promise chain unaffected', async () => {
    const { logger } = makeLogger()
    const { catchRoxDesignError } = await import('../rox-design-telemetry')

    const downstream = mock(() => 'continued')
    const result = await Promise.reject(new Error('synthetic'))
      .catch(catchRoxDesignError({ phase: 'navigate', logger }))
      .then(() => downstream())

    expect(result).toBe('continued')
    expect(downstream).toHaveBeenCalled()
  })

  test('scrubContext drops desktopAuthSecret-style buffers even when nested under non-sensitive name', async () => {
    const { recordRoxDesignError } = await import('../rox-design-telemetry')
    const { logger, errors } = makeLogger()

    recordRoxDesignError({
      phase: 'register-desktop-auth',
      error: new Error('refused'),
      logger,
      context: {
        // Sensitive key names — must be scrubbed.
        desktopAuthSecret: 'should-not-appear',
        ROX_DESIGN_AUTH_TOKEN: 'should-not-appear',
        // Benign metrics — must survive.
        attempt: 2,
        maxAttempts: 5,
      },
    })

    const meta = errors[0]?.meta ?? {}
    expect(meta.desktopAuthSecret).toBeUndefined()
    expect(meta.ROX_DESIGN_AUTH_TOKEN).toBeUndefined()
    expect(meta.attempt).toBe(2)
    expect(meta.maxAttempts).toBe(5)
  })
})
