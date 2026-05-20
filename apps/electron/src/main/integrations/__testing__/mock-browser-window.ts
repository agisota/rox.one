/**
 * PZD-80: Reusable test-double for Electron `BrowserWindow` used to host a
 * `MockWebContentsView` during unit tests.
 *
 * Production code that targets `WindowManager.getWindowByWebContentsId(...)`
 * expects a `BrowserWindow` with at minimum:
 *   - `webContents.id`
 *   - `contentView.addChildView` / `removeChildView`
 *   - `isDestroyed()`
 *   - `on('closed', ...)`
 *   - `getBounds()` / `setBounds(...)`
 *
 * This mock provides exactly that surface, plus a listener-count tracker that
 * mirrors `MockWebContentsView` so test suites can use the same leak-detection
 * pattern uniformly.
 */
import { MockWebContentsView, type MockWebContents } from './mock-web-contents-view'

/** See note in mock-web-contents-view.ts — `never[]` keeps per-event signatures flexible. */
type Listener = (...args: never[]) => unknown

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

interface ContentView {
  addChildView: (view: MockWebContentsView) => void
  removeChildView: (view: MockWebContentsView) => void
}

// Module-level counter that is independent of MockWebContentsView's so that
// host webContents ids do not collide with embedded view ids in the same test.
let hostWebContentsIdCounter = 1_000_000

export class MockBrowserWindow {
  readonly webContents: Pick<MockWebContents, 'id' | 'send'> & {
    isDestroyed: () => boolean
    setBackgroundColor: (color: string) => void
  }
  readonly contentView: ContentView

  private readonly listeners = new Map<string, Listener[]>()
  private readonly children: MockWebContentsView[] = []
  private bounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 }
  private destroyed = false

  constructor() {
    const self = this
    const id = hostWebContentsIdCounter++
    this.webContents = {
      id,
      isDestroyed: () => self.destroyed,
      send: (_channel: string, ..._args: unknown[]) => {
        // captured if needed by future tests
      },
      setBackgroundColor: (_color: string) => undefined,
    }

    this.contentView = {
      addChildView: (view: MockWebContentsView) => {
        if (self.destroyed) return
        self.children.push(view)
      },
      removeChildView: (view: MockWebContentsView) => {
        const index = self.children.indexOf(view)
        if (index !== -1) self.children.splice(index, 1)
      },
    }
  }

  // ---- listener lifecycle ---------------------------------------------------

  on(event: string, listener: Listener): this {
    if (this.destroyed) return this
    const existing = this.listeners.get(event)
    if (existing) {
      existing.push(listener)
    } else {
      this.listeners.set(event, [listener])
    }
    return this
  }

  off(event: string, listener: Listener): this {
    const existing = this.listeners.get(event)
    if (!existing) return this
    const index = existing.indexOf(listener)
    if (index === -1) return this
    existing.splice(index, 1)
    if (existing.length === 0) this.listeners.delete(event)
    return this
  }

  once(event: string, listener: Listener): this {
    const wrapper = ((...args: never[]) => {
      this.off(event, wrapper)
      ;(listener as (...args: unknown[]) => unknown)(...args)
    }) as Listener
    return this.on(event, wrapper)
  }

  // ---- bounds ---------------------------------------------------------------

  getBounds(): Rectangle {
    return { ...this.bounds }
  }

  setBounds(bounds: Rectangle): void {
    this.bounds = { ...bounds }
  }

  // ---- lifecycle ------------------------------------------------------------

  isDestroyed(): boolean {
    return this.destroyed
  }

  /** Close the window, firing 'closed' listeners exactly once. */
  close(): void {
    if (this.destroyed) return
    this.destroyed = true
    const closedHandlers = this.listeners.get('closed')
    if (closedHandlers) {
      for (const handler of [...closedHandlers]) {
        ;(handler as () => void)()
      }
    }
    this.listeners.clear()
  }

  // ---- test-facing surface --------------------------------------------------

  getChildViews(): readonly MockWebContentsView[] {
    return this.children
  }

  getListenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const [event, handlers] of this.listeners.entries()) {
      counts[event] = handlers.length
    }
    return counts
  }
}
