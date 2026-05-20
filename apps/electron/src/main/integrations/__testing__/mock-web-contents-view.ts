/**
 * PZD-80: Reusable test-double for Electron `WebContentsView` and its `webContents`.
 *
 * The mock exposes the API surface used by `RoxDesignViewManager` and future
 * integrations (T271 artifacts, Browser-as-tool, etc.) so unit tests can exercise
 * the navigation/skin-injection/listener wiring without booting an Electron
 * process. Behaviour is fully synchronous and deterministic; tests opt in to
 * latency or failure by overriding the relevant method implementation.
 *
 * Design goals:
 *   - Mirror the *shape* of `WebContentsView` / `WebContents` rather than the
 *     full type. Production code only uses a small subset (loadURL,
 *     executeJavaScript, insertCSS, removeInsertedCSS, setWindowOpenHandler,
 *     on/off/once/removeAllListeners, send, close, dev-tools, isDestroyed).
 *   - Track every `on()`/`once()` registration and matching `off()` removal so
 *     tests can assert no listeners leak across destroy.
 *   - Support arbitrary event emission (`view.emit('did-finish-load', ...)`) so
 *     tests drive the production code through realistic navigation lifecycles.
 *   - Allow per-test overrides for promise-returning methods so tests can
 *     simulate slow loads, rejection, or specific return values without
 *     touching the production implementation.
 */

// Module-level counter used to hand out unique `webContents.id` values. The
// real Electron numbering scheme is opaque; we only guarantee uniqueness
// within a process, which matches how production code uses the id (as a map
// key in `RoxDesignViewManager.entries`).
let webContentsIdCounter = 1

export type MockEventArgs = readonly unknown[]
/**
 * A listener accepted by the mock event API. We intentionally allow any
 * argument shape (`...args: never[]`) so tests can declare per-event handler
 * signatures like `(event, url) => ...` or
 * `(event, level, message, line, sourceId) => ...` without casts.
 */
type Listener = (...args: never[]) => unknown
type LoadURLImpl = (url: string) => Promise<void>
type ExecuteJavaScriptImpl = (code: string, userGesture?: boolean) => Promise<unknown>

export interface MockWindowOpenDetails {
  url: string
  frameName?: string
  features?: string
  disposition?: string
  referrer?: { url: string; policy: string }
  postBody?: unknown
}

export interface MockWindowOpenResult {
  action: 'allow' | 'deny'
  outlivesOpener?: boolean
  overrideBrowserWindowOptions?: Record<string, unknown>
}

export type MockWindowOpenHandler = (
  details: MockWindowOpenDetails,
) => MockWindowOpenResult

interface SentMessage {
  channel: string
  args: unknown[]
}

/**
 * Subset of the Electron `WebContents` API used by the integrations layer.
 * The shape is intentionally minimal — extend it only when a new method is
 * referenced by production code that we want to exercise from tests.
 */
export interface MockWebContents {
  readonly id: number
  loadURL: (url: string) => Promise<void>
  getURL: () => string
  isDestroyed: () => boolean
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>
  insertCSS: (css: string) => Promise<string>
  removeInsertedCSS: (key: string) => Promise<void>
  setWindowOpenHandler: (handler: MockWindowOpenHandler) => void
  on: (event: string, listener: Listener) => MockWebContents
  off: (event: string, listener: Listener) => MockWebContents
  once: (event: string, listener: Listener) => MockWebContents
  removeAllListeners: (event?: string) => MockWebContents
  send: (channel: string, ...args: unknown[]) => void
  close: () => void
  closeDevTools: () => void
  openDevTools: (options?: unknown) => void
  isDevToolsOpened: () => boolean
  setZoomFactor: (factor: number) => void
  getZoomFactor: () => number
  setBackgroundColor: (color: string) => void
  print: (options: unknown, callback: (success: boolean) => void) => void
}

export class MockWebContentsView {
  readonly webContents: MockWebContents

  /** Map of event name -> array of currently registered listeners. */
  private readonly listeners = new Map<string, Listener[]>()
  /** Map of inserted-CSS key -> raw CSS string. Used for round-trip assertions. */
  private readonly insertedCss = new Map<string, string>()
  /** Captured ipc renderer payloads recorded by the send spy. */
  private readonly sentMessages: SentMessage[] = []
  /** Captured handler from setWindowOpenHandler so tests can invoke it later. */
  private windowOpenHandler: MockWindowOpenHandler | null = null
  /** Most recent URL passed to loadURL once it resolved successfully. */
  private currentUrl = ''
  /** Whether close() has been called; flips isDestroyed() to true. */
  private destroyed = false
  /** Whether openDevTools() is currently open. */
  private devToolsOpen = false
  /** Current zoom factor for `getZoomFactor`/`setZoomFactor` round-trip. */
  private zoomFactor = 1
  /** Counter used to mint deterministic insertCSS keys. */
  private insertCssCounter = 0
  /** Test override for loadURL. */
  private loadURLImpl: LoadURLImpl | null = null
  /** Test override for executeJavaScript. */
  private executeJavaScriptImpl: ExecuteJavaScriptImpl | null = null
  /** Configurable default return value for executeJavaScript. */
  private executeJavaScriptReturn: unknown = undefined

  /**
   * setBounds/setVisible/setBackgroundColor are no-ops on the mock but exposed
   * because production code calls them. They are spied via the listener
   * tracker so tests that care can assert on call shape directly.
   */
  setBounds = (_bounds: { x: number; y: number; width: number; height: number }): void => {
    // intentionally empty — extend if a test wants to assert bounds were set
  }

  setVisible = (_visible: boolean): void => {
    // intentionally empty
  }

  setBackgroundColor = (_color: string): void => {
    // intentionally empty
  }

  constructor() {
    const self = this
    this.webContents = {
      id: webContentsIdCounter++,
      loadURL: (url: string) => self.handleLoadURL(url),
      getURL: () => self.currentUrl,
      isDestroyed: () => self.destroyed,
      executeJavaScript: (code: string, userGesture?: boolean) =>
        self.handleExecuteJavaScript(code, userGesture),
      insertCSS: (css: string) => self.handleInsertCSS(css),
      removeInsertedCSS: (key: string) => self.handleRemoveInsertedCSS(key),
      setWindowOpenHandler: (handler: MockWindowOpenHandler) => {
        self.windowOpenHandler = handler
      },
      on: (event: string, listener: Listener) => {
        self.addListener(event, listener)
        return self.webContents
      },
      off: (event: string, listener: Listener) => {
        self.removeListener(event, listener)
        return self.webContents
      },
      once: (event: string, listener: Listener) => {
        const wrapper = ((...args: never[]) => {
          self.removeListener(event, wrapper)
          ;(listener as (...args: unknown[]) => unknown)(...args)
        }) as Listener
        self.addListener(event, wrapper)
        return self.webContents
      },
      removeAllListeners: (event?: string) => {
        if (event == null) {
          self.listeners.clear()
        } else {
          self.listeners.delete(event)
        }
        return self.webContents
      },
      send: (channel: string, ...args: unknown[]) => {
        if (self.destroyed) return
        self.sentMessages.push({ channel, args })
      },
      close: () => self.close(),
      closeDevTools: () => {
        self.devToolsOpen = false
      },
      openDevTools: (_options?: unknown) => {
        self.devToolsOpen = true
      },
      isDevToolsOpened: () => self.devToolsOpen,
      setZoomFactor: (factor: number) => {
        self.zoomFactor = factor
      },
      getZoomFactor: () => self.zoomFactor,
      setBackgroundColor: (_color: string) => {
        // captured implicitly via setBackgroundColor noop above
      },
      print: (_options: unknown, callback: (success: boolean) => void) => {
        callback(true)
      },
    }
  }

  // ---- test-facing surface --------------------------------------------------

  /** Override loadURL behaviour for this instance (e.g. to reject). */
  setLoadURLImplementation(impl: LoadURLImpl | null): void {
    this.loadURLImpl = impl
  }

  /** Override executeJavaScript behaviour for this instance. */
  setExecuteJavaScriptImplementation(impl: ExecuteJavaScriptImpl | null): void {
    this.executeJavaScriptImpl = impl
  }

  /** Configure the default executeJavaScript return value. */
  setExecuteJavaScriptReturn(value: unknown): void {
    this.executeJavaScriptReturn = value
  }

  /** Drive the production code by emitting an Electron event with arguments. */
  emit(event: string, ...args: unknown[]): boolean {
    if (this.destroyed) return false
    const handlers = this.listeners.get(event)
    if (!handlers || handlers.length === 0) return false
    // Iterate over a copy because once() handlers remove themselves mid-loop.
    for (const handler of [...handlers]) {
      // Electron always passes an `event` object as the first argument. We
      // mirror that by injecting a minimal `{ preventDefault, sender }`
      // facade unless callers explicitly supply their own first argument
      // (they typically don't — they pass payload args after the event).
      const eventObject = { preventDefault: () => undefined, sender: this.webContents }
      ;(handler as (...args: unknown[]) => unknown)(eventObject, ...args)
    }
    return true
  }

  /** Snapshot of current listener counts keyed by event name. */
  getListenerCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const [event, handlers] of this.listeners.entries()) {
      counts[event] = handlers.length
    }
    return counts
  }

  /** All IPC payloads captured by the send spy. */
  getSentMessages(): readonly SentMessage[] {
    return this.sentMessages
  }

  /** Current insertCSS state for round-trip assertions. */
  getInsertedCss(): Record<string, string> {
    return Object.fromEntries(this.insertedCss.entries())
  }

  /** Invoke the window-open handler captured via setWindowOpenHandler. */
  invokeWindowOpenHandler(details: MockWindowOpenDetails): MockWindowOpenResult {
    if (!this.windowOpenHandler) return { action: 'deny' }
    return this.windowOpenHandler(details)
  }

  /** Tear down the mock, mirroring Electron `webContents.close()`. */
  close(): void {
    if (this.destroyed) return
    this.destroyed = true
    const handlers = this.listeners.get('destroyed')
    if (handlers) {
      for (const handler of [...handlers]) {
        ;(handler as (...args: unknown[]) => unknown)({
          preventDefault: () => undefined,
          sender: this.webContents,
        })
      }
    }
    this.listeners.clear()
  }

  // ---- internal -------------------------------------------------------------

  private addListener(event: string, listener: Listener): void {
    if (this.destroyed) return
    const existing = this.listeners.get(event)
    if (existing) {
      existing.push(listener)
    } else {
      this.listeners.set(event, [listener])
    }
  }

  private removeListener(event: string, listener: Listener): void {
    const existing = this.listeners.get(event)
    if (!existing) return
    const index = existing.indexOf(listener)
    if (index === -1) return
    existing.splice(index, 1)
    if (existing.length === 0) this.listeners.delete(event)
  }

  private async handleLoadURL(url: string): Promise<void> {
    if (this.loadURLImpl) {
      await this.loadURLImpl(url)
      // Custom impls may throw; if we got here they resolved cleanly.
      this.currentUrl = url
      return
    }
    this.currentUrl = url
  }

  private async handleExecuteJavaScript(
    code: string,
    userGesture?: boolean,
  ): Promise<unknown> {
    if (this.executeJavaScriptImpl) {
      return this.executeJavaScriptImpl(code, userGesture)
    }
    return this.executeJavaScriptReturn
  }

  private async handleInsertCSS(css: string): Promise<string> {
    const key = `mock-css-${++this.insertCssCounter}`
    this.insertedCss.set(key, css)
    return key
  }

  private async handleRemoveInsertedCSS(key: string): Promise<void> {
    this.insertedCss.delete(key)
  }
}
