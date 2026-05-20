/**
 * PZD-79 G.2.2.1.C — sandbox baseline primitive.
 *
 * `createSecureWebContentsView` returns a WebContentsView whose webPreferences
 * cannot be weakened by callers: the unsafe webPreferences keys (nodeIntegration,
 * sandbox, contextIsolation, webviewTag, webSecurity, allowRunningInsecureContent)
 * are NOT exposed via the helper's parameters at all.
 *
 * In packaged builds DevTools cannot be opened on the returned view: the helper
 * intercepts the `devtools-opened` event and immediately closes DevTools.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Capture every webPreferences object passed to WebContentsView.
const capturedWebPreferences: unknown[] = []
type WcListener = (...args: unknown[]) => void
const webContentsListeners = new Map<string, WcListener[]>()
const closeDevToolsCalls: number[] = []
let nextWebContentsId = 1
let isPackagedValue = false

mock.module('electron', () => {
  class MockWebContents {
    id: number
    isDestroyed() { return false }
    constructor() {
      this.id = nextWebContentsId++
    }
    closeDevTools() {
      closeDevToolsCalls.push(this.id)
    }
    on(event: string, handler: WcListener) {
      const list = webContentsListeners.get(event) ?? []
      list.push(handler)
      webContentsListeners.set(event, list)
    }
  }

  class MockWebContentsView {
    webContents = new MockWebContents()
    constructor(opts: unknown) {
      capturedWebPreferences.push(opts)
    }
  }

  return {
    WebContentsView: MockWebContentsView,
    app: {
      get isPackaged() {
        return isPackagedValue
      },
    },
  }
})

const { createSecureWebContentsView } = await import('../sandbox-baseline') as typeof import('../sandbox-baseline')

beforeEach(() => {
  capturedWebPreferences.length = 0
  webContentsListeners.clear()
  closeDevToolsCalls.length = 0
})

afterEach(() => {
  isPackagedValue = false
})

describe('createSecureWebContentsView — sandbox baseline', () => {
  test('forces sandbox:true, contextIsolation:true, nodeIntegration:false on the underlying webPreferences', () => {
    createSecureWebContentsView({ preloadPath: '/fake/preload.cjs' })

    expect(capturedWebPreferences.length).toBe(1)
    const wp = (capturedWebPreferences[0] as { webPreferences: Record<string, unknown> }).webPreferences

    expect(wp['sandbox']).toBe(true)
    expect(wp['contextIsolation']).toBe(true)
    expect(wp['nodeIntegration']).toBe(false)
    expect(wp['webviewTag']).toBe(false)
    expect(wp['webSecurity']).toBe(true)
    expect(wp['allowRunningInsecureContent']).toBe(false)
  })

  test('threads the preload path through to webPreferences.preload', () => {
    createSecureWebContentsView({ preloadPath: '/abs/preload.cjs' })
    const wp = (capturedWebPreferences[0] as { webPreferences: Record<string, unknown> }).webPreferences
    expect(wp['preload']).toBe('/abs/preload.cjs')
  })

  test('threads a custom partition through to webPreferences.partition when provided', () => {
    createSecureWebContentsView({ preloadPath: '/p.cjs', partition: 'persist:rox-foo' })
    const wp = (capturedWebPreferences[0] as { webPreferences: Record<string, unknown> }).webPreferences
    expect(wp['partition']).toBe('persist:rox-foo')
  })

  test('omits partition when not provided (Electron default session)', () => {
    createSecureWebContentsView({ preloadPath: '/p.cjs' })
    const wp = (capturedWebPreferences[0] as { webPreferences: Record<string, unknown> }).webPreferences
    expect(wp['partition']).toBeUndefined()
  })

  test('blocks DevTools on the returned view in packaged builds (closes immediately on open)', () => {
    isPackagedValue = true
    const view = createSecureWebContentsView({ preloadPath: '/p.cjs' })

    // Helper should have wired a `devtools-opened` interceptor.
    const handlers = webContentsListeners.get('devtools-opened')
    expect(handlers).toBeDefined()
    expect(handlers!.length).toBeGreaterThan(0)

    // Simulate Electron firing the event; closeDevTools must be called.
    for (const handler of handlers!) handler()
    expect(closeDevToolsCalls).toEqual([view.webContents.id])
  })

  test('does NOT block DevTools in development (no devtools-opened listener wired)', () => {
    isPackagedValue = false
    createSecureWebContentsView({ preloadPath: '/p.cjs' })

    const handlers = webContentsListeners.get('devtools-opened')
    expect(handlers ?? []).toEqual([])
  })

  test('type-level: unsafe webPreferences keys are NOT in the helper parameter type', () => {
    // This test guards the *signature*: the helper accepts only { preloadPath, partition? }.
    // If a future refactor exposes any of these keys via the params, this block
    // will fail typecheck and the test will not compile.
    type Opts = Parameters<typeof createSecureWebContentsView>[0]
    type Banned =
      | 'sandbox'
      | 'contextIsolation'
      | 'nodeIntegration'
      | 'nodeIntegrationInWorker'
      | 'nodeIntegrationInSubFrames'
      | 'webviewTag'
      | 'webSecurity'
      | 'allowRunningInsecureContent'
      | 'experimentalFeatures'

    // If any banned key appears in Opts, `keyof Opts & Banned` is non-`never`;
    // the conditional below assigns `true` to a `false`-typed variable, which
    // is a TS compile error.
    const _typeCheck: [keyof Opts & Banned] extends [never] ? true : false = true
    expect(_typeCheck).toBe(true)
  })
})
