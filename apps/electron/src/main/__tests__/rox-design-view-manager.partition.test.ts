/**
 * T537 PR #5b: TDD cycles 5-6 — Design BrowserView uses separate partition.
 *
 * Verifies that RoxDesignViewManager creates BrowserView/WebContentsView with
 * partition: 'persist:rox-design' to isolate storage and cookies from the host.
 */
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import type { WindowManager } from '../window-manager'

// Capture webPreferences passed to BrowserView / WebContentsView constructors.
const capturedWebPreferences: unknown[] = []

mock.module('electron', () => {
  class MockWebContents {
    id = 1
    isDestroyed() { return false }
    setWindowOpenHandler(_handler: unknown) {}
    on(_event: string, _handler: unknown) {}
    setBackgroundColor(_color: string) {}
    loadURL(_url: string) { return Promise.resolve() }
    setZoomFactor(_f: number) {}
    getZoomFactor() { return 1 }
  }

  class MockBrowserView {
    webContents = new MockWebContents()
    constructor(opts: unknown) {
      capturedWebPreferences.push(opts)
    }
    setBounds(_b: unknown) {}
    setAutoResize(_opts: unknown) {}
    setBackgroundColor(_color: string) {}
  }

  class MockWebContentsView {
    webContents = new MockWebContents()
    contentView = { addChildView: (_v: unknown) => {} }
    constructor(opts: unknown) {
      capturedWebPreferences.push(opts)
    }
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

const { RoxDesignViewManager } = await import('../rox-design-view-manager') as typeof import('../rox-design-view-manager')

function windowManagerFor(mockWindow: unknown): WindowManager {
  return {
    getWindowByWebContentsId: (_id: number) => mockWindow as import('electron').BrowserWindow,
  } as unknown as WindowManager
}

describe('RoxDesignViewManager partition isolation', () => {
  beforeEach(() => {
    capturedWebPreferences.length = 0
  })

  it("creates Design view with partition 'persist:rox-design'", async () => {
    const mockWindow = {
      webContents: { id: 42, getZoomFactor: () => 1 },
      contentView: { addChildView: (_v: unknown) => {} },
      isDestroyed: () => false,
      once: (_event: string, _handler: unknown) => {},
      addBrowserView: (_v: unknown) => {},
      setTopBrowserView: (_v: unknown) => {},
    }

    const manager = new RoxDesignViewManager({
      windowManager: windowManagerFor(mockWindow),
      preloadPath: '/fake/preload.cjs',
    })

    await manager.show({
      senderWebContentsId: 1,
      url: 'http://localhost:3000',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    expect(capturedWebPreferences.length).toBeGreaterThan(0)
    const opts = capturedWebPreferences[0] as { webPreferences?: Record<string, unknown> }
    const wp = opts?.webPreferences ?? {}
    expect(wp['partition']).toBe('persist:rox-design')
  })

  it('keeps contextIsolation and sandbox enabled alongside partition', async () => {
    const mockWindow = {
      webContents: { id: 43, getZoomFactor: () => 1 },
      contentView: { addChildView: (_v: unknown) => {} },
      isDestroyed: () => false,
      once: (_event: string, _handler: unknown) => {},
      addBrowserView: (_v: unknown) => {},
      setTopBrowserView: (_v: unknown) => {},
    }

    const manager = new RoxDesignViewManager({
      windowManager: windowManagerFor(mockWindow),
      preloadPath: '/fake/preload.cjs',
    })

    await manager.show({
      senderWebContentsId: 1,
      url: 'http://localhost:3000',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    const opts = capturedWebPreferences[0] as { webPreferences?: Record<string, unknown> }
    const wp = opts?.webPreferences ?? {}
    expect(wp['contextIsolation']).toBe(true)
    expect(wp['sandbox']).toBe(true)
    expect(wp['nodeIntegration']).toBe(false)
    expect(wp['webviewTag']).toBe(false)
  })
})
