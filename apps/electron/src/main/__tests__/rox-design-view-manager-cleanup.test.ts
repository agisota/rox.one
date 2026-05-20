/**
 * T550 / PZD-84: Rox Design view cleanup.
 *
 * Verifies that RoxDesignViewManager cycles inserted CSS keys and unregisters
 * WebContents listeners when the embedded view is destroyed.
 */
import { beforeEach, describe, expect, it, mock } from 'bun:test'

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
  removeInsertedCSSError: Error | null = null
  calls: WebContentsCall[] = []
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
  setZoomFactor(_factor: number) {}
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
      const error = this.removeInsertedCSSError
      this.removeInsertedCSSError = null
      throw error
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
    setBounds(_bounds: unknown) {}
    setAutoResize(_opts: unknown) {}
    setBackgroundColor(_color: string) {}
  }

  class MockWebContentsView {
    webContents = new MockWebContents()
    contentView = { addChildView: (_view: unknown) => {} }
    constructor(_opts: unknown) {}
    setBounds(_bounds: unknown) {}
    setVisible(_visible: boolean) {}
    setBackgroundColor(_color: string) {}
  }

  class MockBrowserWindow {
    webContents = new MockWebContents()
    contentView = { addChildView: (_view: unknown) => {} }
    isDestroyed() { return false }
    once(_event: string, _handler: unknown) {}
    addBrowserView(_view: unknown) {}
    setTopBrowserView(_view: unknown) {}
    removeBrowserView(_view: unknown) {}
  }

  return {
    BrowserView: MockBrowserView,
    WebContentsView: MockWebContentsView,
    BrowserWindow: MockBrowserWindow,
    shell: { openExternal: mock(async () => undefined) },
  }
})

mock.module('../rox-design-theme-bridge', () => ({
  startDesignThemeBridge: () => () => undefined,
}))

const { RoxDesignViewManager } = await import('../rox-design-view-manager') as typeof import('../rox-design-view-manager')

function buildHostWindow(id: number) {
  return {
    webContents: { id, getZoomFactor: () => 1 },
    contentView: { addChildView: (_view: unknown) => {} },
    isDestroyed: () => false,
    once: (_event: string, _handler: unknown) => {},
    addBrowserView: (_view: unknown) => {},
    setTopBrowserView: (_view: unknown) => {},
    removeBrowserView: (_view: unknown) => {},
  }
}

function flushSkinApply(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function showDesignView(): Promise<MockWebContents> {
  const hostWindow = buildHostWindow(1)
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

  const webContents = lastWebContents.current
  expect(webContents).not.toBeNull()
  if (!webContents) throw new Error('Expected mock WebContents to be created')

  return webContents
}

describe('RoxDesignViewManager cleanup', () => {
  beforeEach(() => {
    lastWebContents.current = null
    nextWebContentsId = 100
  })

  it('removes the previous inserted CSS key before inserting the next skin sheet', async () => {
    const webContents = await showDesignView()

    webContents.insertCSSCallCount = 0
    webContents.removeInsertedCSSCallCount = 0
    webContents.calls = []

    const domReady = webContents.handlers.get('dom-ready')?.[0]
    expect(domReady).toBeDefined()

    domReady?.()
    await flushSkinApply()
    domReady?.()
    await flushSkinApply()

    expect(webContents.removeInsertedCSSCallCount).toBe(2)
    expect(webContents.insertCSSCallCount).toBe(2)
    expect(
      webContents.calls
        .filter((call) => call.name === 'removeInsertedCSS' || call.name === 'insertCSS')
        .map((call) => call.name),
    ).toEqual([
      'removeInsertedCSS',
      'insertCSS',
      'removeInsertedCSS',
      'insertCSS',
    ])
  })

  it('still inserts a fresh skin sheet when the stale CSS key cannot be removed', async () => {
    const webContents = await showDesignView()

    webContents.insertCSSCallCount = 0
    webContents.removeInsertedCSSCallCount = 0
    webContents.calls = []
    webContents.removeInsertedCSSError = new Error('Invalid CSS key')

    const domReady = webContents.handlers.get('dom-ready')?.[0]
    domReady?.()
    await flushSkinApply()

    expect(webContents.removeInsertedCSSCallCount).toBe(1)
    expect(webContents.insertCSSCallCount).toBe(1)
  })

  it('removes WebContents listeners before closing during destroyAll', async () => {
    const hostWindow = buildHostWindow(1)
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

    const webContents = lastWebContents.current
    expect(webContents).not.toBeNull()
    if (!webContents) return

    expect(webContents.removeAllListenersCallCount).toBe(0)
    expect(webContents.closeCallCount).toBe(0)

    manager.destroyAll()

    expect(webContents.removeAllListenersCallCount).toBe(1)
    expect(webContents.closeCallCount).toBe(1)

    const removeIndex = webContents.calls.findIndex((call) => call.name === 'removeAllListeners')
    const closeIndex = webContents.calls.findIndex((call) => call.name === 'close')
    expect(removeIndex).toBeGreaterThanOrEqual(0)
    expect(closeIndex).toBeGreaterThan(removeIndex)
  })
})
