/**
 * PZD-84 (audit finding C-H4): CSS sheet accumulation + listener leak fixes.
 *
 * Verifies that RoxDesignViewManager:
 * - Calls removeInsertedCSS(prevKey) before each subsequent insertCSS.
 * - Calls removeAllListeners() on WebContents during destroy.
 * - Survives removeInsertedCSS failure (caught silently) and still inserts new CSS.
 */
import { describe, expect, it, mock, beforeEach } from 'bun:test'

// Module-level state for mock instances (resets per test via beforeEach).
type WebContentsCall = { name: string; args: unknown[] }
const lastWebContents: { current: MockWebContents | null } = { current: null }

let nextWebContentsId = 100

class MockWebContents {
  id: number
  destroyed = false
  insertCSSCallCount = 0
  removeInsertedCSSCallCount = 0
  removeAllListenersCallCount = 0
  closeCallCount = 0
  /** When set, the next removeInsertedCSS call rejects with this error. */
  removeInsertedCSSError: Error | null = null
  /** Sequence of method calls, in order, for ordering assertions. */
  calls: WebContentsCall[] = []
  /** Registered event handlers, keyed by event name. */
  handlers = new Map<string, Array<(...args: unknown[]) => void>>()

  constructor() {
    this.id = nextWebContentsId++
    lastWebContents.current = this
  }

  isDestroyed() { return this.destroyed }
  setWindowOpenHandler(_handler: unknown) {}
  on(event: string, handler: (...args: unknown[]) => void) {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }
  removeAllListeners() {
    this.removeAllListenersCallCount += 1
    this.calls.push({ name: 'removeAllListeners', args: [] })
    this.handlers.clear()
  }
  setBackgroundColor(_color: string) {}
  loadURL(_url: string) { return Promise.resolve() }
  setZoomFactor(_f: number) {}
  getZoomFactor() { return 1 }
  async insertCSS(css: string): Promise<string> {
    this.insertCSSCallCount += 1
    const key = `css-key-${this.insertCSSCallCount}`
    this.calls.push({ name: 'insertCSS', args: [css, key] })
    return key
  }
  async removeInsertedCSS(key: string): Promise<void> {
    this.removeInsertedCSSCallCount += 1
    this.calls.push({ name: 'removeInsertedCSS', args: [key] })
    if (this.removeInsertedCSSError) {
      const err = this.removeInsertedCSSError
      this.removeInsertedCSSError = null
      throw err
    }
  }
  async executeJavaScript(_script: string, _userGesture?: boolean): Promise<unknown> {
    this.calls.push({ name: 'executeJavaScript', args: [] })
    return undefined
  }
  close() {
    this.closeCallCount += 1
    this.calls.push({ name: 'close', args: [] })
    this.destroyed = true
  }
}

mock.module('electron', () => {
  class MockBrowserView {
    webContents = new MockWebContents()
    constructor(_opts: unknown) {}
    setBounds(_b: unknown) {}
    setAutoResize(_opts: unknown) {}
    setBackgroundColor(_color: string) {}
  }

  class MockWebContentsView {
    webContents = new MockWebContents()
    contentView = { addChildView: (_v: unknown) => {} }
    constructor(_opts: unknown) {}
    setBounds(_b: unknown) {}
    setVisible(_v: boolean) {}
    setBackgroundColor(_color: string) {}
  }

  class MockBrowserWindow {
    webContents = new MockWebContents()
    contentView = { addChildView: (_v: unknown) => {} }
    isDestroyed() { return false }
    once(_event: string, _handler: unknown) {}
    addBrowserView(_v: unknown) {}
    setTopBrowserView(_v: unknown) {}
    removeBrowserView(_v: unknown) {}
  }

  return {
    BrowserView: MockBrowserView,
    WebContentsView: MockWebContentsView,
    BrowserWindow: MockBrowserWindow,
    shell: { openExternal: mock(async () => undefined) },
  }
})

// Stub theme bridge so tests don't pull electron-state-dependent code paths.
mock.module('../rox-design-theme-bridge', () => ({
  startDesignThemeBridge: () => () => undefined,
}))

const { RoxDesignViewManager } = await import('../rox-design-view-manager') as typeof import('../rox-design-view-manager')

function buildMockHostWindow(id: number) {
  return {
    webContents: { id, getZoomFactor: () => 1 },
    contentView: { addChildView: (_v: unknown) => {} },
    isDestroyed: () => false,
    once: (_event: string, _handler: unknown) => {},
    addBrowserView: (_v: unknown) => {},
    setTopBrowserView: (_v: unknown) => {},
    removeBrowserView: (_v: unknown) => {},
  }
}

/** Flush pending microtasks/timers so floating `void applyEmbedSkin(...)` promises settle. */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('RoxDesignViewManager cleanup (PZD-84 / C-H4)', () => {
  beforeEach(() => {
    lastWebContents.current = null
    nextWebContentsId = 100
  })

  it('removes previous inserted CSS key before inserting the next one', async () => {
    const hostWindow = buildMockHostWindow(1)
    const manager = new RoxDesignViewManager({
      windowManager: {
        getWindowByWebContentsId: (_id: number) => hostWindow as unknown as import('electron').BrowserWindow,
      } as unknown as import('../window-manager').WindowManager,
      preloadPath: '/fake/preload.cjs',
    })

    await manager.show({
      senderWebContentsId: 1,
      url: 'http://localhost:3000',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    const wc = lastWebContents.current
    expect(wc).not.toBeNull()
    if (!wc) return

    // show() may have triggered initial insertCSS via the setEntryBounds /
    // zoom-factor path. Reset counters and call history so the test isolates
    // the dom-ready re-entry behaviour we actually care about.
    wc.insertCSSCallCount = 0
    wc.removeInsertedCSSCallCount = 0
    wc.calls = []

    // Trigger first applyEmbedSkin via dom-ready handler — but skinCssKey is
    // ALREADY set from the show() path, so we expect removeInsertedCSS first.
    // The handler fires `void applyEmbedSkin(...)` (floating promise), so flush
    // microtasks/timers afterwards to let the async chain settle.
    const domReady = wc.handlers.get('dom-ready')?.[0]
    expect(domReady).toBeDefined()
    domReady?.()
    await flushPromises()
    expect(wc.removeInsertedCSSCallCount).toBe(1)
    expect(wc.insertCSSCallCount).toBe(1)

    // Trigger second applyEmbedSkin — once more must cycle remove → insert.
    domReady?.()
    await flushPromises()
    expect(wc.removeInsertedCSSCallCount).toBe(2)
    expect(wc.insertCSSCallCount).toBe(2)

    // Verify ordering: each removeInsertedCSS precedes the matching insertCSS.
    const sequence = wc.calls
      .filter((c) => c.name === 'removeInsertedCSS' || c.name === 'insertCSS')
      .map((c) => c.name)
    expect(sequence).toEqual([
      'removeInsertedCSS',
      'insertCSS',
      'removeInsertedCSS',
      'insertCSS',
    ])
  })

  it('removeInsertedCSS failure does not block the new insertCSS path', async () => {
    const hostWindow = buildMockHostWindow(1)
    const manager = new RoxDesignViewManager({
      windowManager: {
        getWindowByWebContentsId: (_id: number) => hostWindow as unknown as import('electron').BrowserWindow,
      } as unknown as import('../window-manager').WindowManager,
      preloadPath: '/fake/preload.cjs',
    })

    await manager.show({
      senderWebContentsId: 1,
      url: 'http://localhost:3000',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    const wc = lastWebContents.current
    expect(wc).not.toBeNull()
    if (!wc) return

    // Reset counters after show() — see test 1 for why.
    wc.insertCSSCallCount = 0
    wc.removeInsertedCSSCallCount = 0
    wc.calls = []

    // Arm removeInsertedCSS to throw on the next call (simulates a key
    // invalidated by an in-flight navigation).
    wc.removeInsertedCSSError = new Error('Invalid CSS key')
    const domReady = wc.handlers.get('dom-ready')?.[0]
    domReady?.()
    await flushPromises()

    expect(wc.removeInsertedCSSCallCount).toBe(1)
    // Critical: the new insertCSS still ran despite the throw.
    expect(wc.insertCSSCallCount).toBe(1)
  })

  it('destroyAll calls removeAllListeners on the WebContents before close', async () => {
    const hostWindow = buildMockHostWindow(1)
    const manager = new RoxDesignViewManager({
      windowManager: {
        getWindowByWebContentsId: (_id: number) => hostWindow as unknown as import('electron').BrowserWindow,
      } as unknown as import('../window-manager').WindowManager,
      preloadPath: '/fake/preload.cjs',
    })

    await manager.show({
      senderWebContentsId: 1,
      url: 'http://localhost:3000',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    const wc = lastWebContents.current
    expect(wc).not.toBeNull()
    if (!wc) return

    expect(wc.removeAllListenersCallCount).toBe(0)
    expect(wc.closeCallCount).toBe(0)

    manager.destroyAll()

    expect(wc.removeAllListenersCallCount).toBe(1)
    expect(wc.closeCallCount).toBe(1)
    // Order: removeAllListeners must come before close.
    const rmIdx = wc.calls.findIndex((c) => c.name === 'removeAllListeners')
    const closeIdx = wc.calls.findIndex((c) => c.name === 'close')
    expect(rmIdx).toBeGreaterThanOrEqual(0)
    expect(closeIdx).toBeGreaterThan(rmIdx)
  })
})
