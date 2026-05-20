/**
 * C-H3: rox-design:view-show load serialization
 *
 * Verifies that RoxDesignViewManager.show() serializes concurrent loadURL
 * calls per-entry so a second show() awaits the first in-flight load before
 * issuing its own, preventing stale-URL and premature-setBounds races.
 */
import { describe, expect, it, mock } from 'bun:test'

// ---------------------------------------------------------------------------
// Electron mock — must precede dynamic import of RoxDesignViewManager
// ---------------------------------------------------------------------------

let loadOrder: string[] = []
let callIdx = 0
let firstResolve!: () => void
let secondResolve!: () => void
let firstLoadPromise: Promise<void>
let secondLoadPromise: Promise<void>

function resetLoadState() {
  loadOrder = []
  callIdx = 0
  firstLoadPromise = new Promise<void>((r) => { firstResolve = r })
  secondLoadPromise = new Promise<void>((r) => { secondResolve = r })
}

resetLoadState()

mock.module('electron', () => {
  class MockWebContents {
    id = 42
    isDestroyed() { return false }
    setWindowOpenHandler(_handler: unknown) {}
    on(_event: string, _handler: unknown) { return this }
    setBackgroundColor(_color: string) {}
    loadURL(url: string): Promise<void> {
      loadOrder.push(url)
      return callIdx++ === 0 ? firstLoadPromise : secondLoadPromise
    }
    setZoomFactor(_f: number) {}
    getZoomFactor() { return 1 }
    insertCSS(_css: string) { return Promise.resolve('css-key') }
    executeJavaScript(_script: string) { return Promise.resolve(undefined) }
  }

  class MockWebContentsView {
    webContents = new MockWebContents()
    setBounds(_b: unknown) {}
    setVisible(_v: boolean) {}
    setBackgroundColor(_color: string) {}
    setAutoResize(_opts: unknown) {}
  }

  class MockBrowserView {
    webContents = new MockWebContents()
    setBounds(_b: unknown) {}
    setAutoResize(_opts: unknown) {}
    setBackgroundColor(_color: string) {}
  }

  class MockBrowserWindow {
    webContents = { id: 1, getZoomFactor: () => 1 }
    contentView = { addChildView(_v: unknown) {} }
    isDestroyed() { return false }
    once(_event: string, _handler: unknown) {}
    addBrowserView(_v: unknown) {}
    setTopBrowserView(_v: unknown) {}
    removeBrowserView(_v: unknown) {}
  }

  return {
    WebContentsView: MockWebContentsView,
    BrowserView: MockBrowserView,
    BrowserWindow: MockBrowserWindow,
    shell: { openExternal: mock(async () => undefined) },
  }
})

const { RoxDesignViewManager } = await import('../rox-design-view-manager') as typeof import('../rox-design-view-manager')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RoxDesignViewManager show() load serialization (C-H3)', () => {
  it('second show() awaits first loadURL before issuing its own load', async () => {
    resetLoadState()

    const mockWindow = {
      webContents: { id: 1, getZoomFactor: () => 1 },
      contentView: { addChildView(_v: unknown) {} },
      isDestroyed: () => false,
      once: (_event: string, _handler: unknown) => {},
      addBrowserView: (_v: unknown) => {},
      setTopBrowserView: (_v: unknown) => {},
    }

    const manager = new RoxDesignViewManager({
      windowManager: {
        getWindowByWebContentsId: (_id: number) => mockWindow as unknown as import('electron').BrowserWindow,
      } as unknown as import('../window-manager').WindowManager,
      preloadPath: '/fake/preload.cjs',
    })

    const bounds = { x: 0, y: 0, width: 800, height: 600 }

    // Launch both show() calls concurrently without awaiting the first
    const firstShow = manager.show({ senderWebContentsId: 1, url: 'https://design.t/v1', bounds })
    const secondShow = manager.show({ senderWebContentsId: 1, url: 'https://design.t/v2', bounds })

    // Only the first loadURL should have been called so far
    expect(loadOrder).toEqual(['https://design.t/v1'])

    // Resolve first load — unblocks the serialization chain
    firstResolve()
    await firstLoadPromise
    // Flush microtask queue so serialized chain can proceed
    await Promise.resolve()
    await Promise.resolve()

    // Second loadURL should now have been called
    expect(loadOrder).toContain('https://design.t/v2')

    // Resolve second load so both promises complete cleanly
    secondResolve()
    await Promise.all([firstShow, secondShow])

    // Final active URL is the second (most-recent) show() caller
    expect(loadOrder[loadOrder.length - 1]).toBe('https://design.t/v2')
  })
})
