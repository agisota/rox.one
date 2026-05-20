import { BrowserView, BrowserWindow, WebContentsView, shell, type WebContents } from 'electron'
import { join } from 'path'
import type { RoxDesignBounds, RoxDesignViewStatus } from '../shared/types'
import {
  getRoxDesignNavigationDecision,
  isHttpUrl,
  sanitizeRoxDesignBounds,
  scaleRoxDesignBounds,
  type RoxDesignRectangle,
} from './rox-design-view-policy'
import {
  ROX_DESIGN_EMBED_CSS,
  buildRoxDesignEmbedBootstrapScript,
  resolveRoxDesignContentZoomFactor,
} from './rox-design-embed-skin'
import { startDesignThemeBridge } from './rox-design-theme-bridge'
import type { WindowManager } from './window-manager'

type RoxDesignViewKind = 'webContentsView' | 'browserView'

type NativeRoxDesignView = BrowserView | WebContentsView

/**
 * Lifecycle phase hook surface used by the view manager. The hook is
 * created per `show()` call so individual phases (`attach-view`, `load-url`,
 * `dom-ready`, `did-finish-load`) can be timed independently.
 *
 * Hook implementation lives in `rox-design-telemetry.ts`. The view manager
 * has no opinion on how phases are reported — it only marks boundaries.
 */
export interface RoxDesignShowPhaseHook {
  startPhase(
    phase: 'attach-view' | 'load-url' | 'dom-ready' | 'did-finish-load',
  ): { end(): void }
  /**
   * Signal that the overall show lifecycle has completed (did-finish-load
   * fired, or the load aborted). Implementations should close the underlying
   * show span here; the view manager guarantees one call per show().
   */
  complete(): void
}

/**
 * Sink for INP samples polled from the embedded Rox Design surface. The view
 * manager calls this every 5s with raw event-timing durations measured by
 * `PerformanceObserver({ type: 'event' })` inside the bootstrap script.
 */
export type RoxDesignInpSink = (sampleMs: number) => void

interface ManagedRoxDesignView {
  hostWindow: BrowserWindow
  hostWebContentsId: number
  view: NativeRoxDesignView
  viewKind: RoxDesignViewKind
  webContents: WebContents
  currentUrl: string | null
  attached: boolean
  contentZoomFactor: number
  skinCssKey: string | null
  /** Dispose function returned by startDesignThemeBridge — set after first load. */
  disposeThemeBridge: (() => void) | null
}

export interface RoxDesignViewManagerOptions {
  windowManager?: WindowManager | null
  preloadPath?: string
  logger?: {
    info?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
    error?: (message: string, meta?: Record<string, unknown>) => void
  }
  /**
   * Optional factory that returns a perf hook for the current `show()` call.
   * Called lazily inside `show()`; return `null` to skip instrumentation
   * (e.g. in unit tests).
   */
  showPhaseHookFactory?: () => RoxDesignShowPhaseHook | null
  /**
   * Optional sink for INP samples reported by the embedded surface. When
   * provided, the view manager polls `window.__ROX_DESIGN_PERF_READ__()`
   * every {@link inpPollIntervalMs} after the first did-finish-load.
   */
  inpSink?: RoxDesignInpSink
  /** Poll interval in ms; defaults to 5000. */
  inpPollIntervalMs?: number
}

export class RoxDesignViewManager {
  private readonly windowManager?: WindowManager | null
  private readonly preloadPath: string
  private readonly logger: RoxDesignViewManagerOptions['logger']
  private readonly entries = new Map<number, ManagedRoxDesignView>()
  private readonly showPhaseHookFactory: (() => RoxDesignShowPhaseHook | null) | null
  private readonly inpSink: RoxDesignInpSink | null
  private readonly inpPollIntervalMs: number
  /** Per-webContents INP poll timers — cleared on hide/destroy/fail-load. */
  private readonly inpPollTimers = new Map<number, ReturnType<typeof setInterval>>()
  /**
   * Per-webContents pending phase hooks for `dom-ready` / `did-finish-load`.
   * The map is single-slot per webContents — replaced on each `show()` so the
   * latest spawn always wins. The `hook` reference is the show-level hook
   * (for `complete()`), kept here so the listeners can close it on
   * load-finished/load-failed.
   */
  private readonly pendingPhaseHooks = new Map<number, {
    domReady: { end(): void } | null
    finishLoad: { end(): void } | null
    hook: RoxDesignShowPhaseHook | null
  }>()

  constructor(options: RoxDesignViewManagerOptions = {}) {
    this.windowManager = options.windowManager
    this.preloadPath = options.preloadPath ?? join(__dirname, 'rox-design-bridge-preload.cjs')
    this.logger = options.logger
    this.showPhaseHookFactory = options.showPhaseHookFactory ?? null
    this.inpSink = options.inpSink ?? null
    this.inpPollIntervalMs = options.inpPollIntervalMs ?? 5_000
  }

  async show(input: { senderWebContentsId: number; url: string; bounds: RoxDesignBounds }): Promise<RoxDesignViewStatus> {
    const hostWindow = this.resolveHostWindow(input.senderWebContentsId)
    if (!hostWindow || hostWindow.isDestroyed()) {
      throw new Error('Rox Design host window is not available.')
    }

    const sanitized = sanitizeRoxDesignBounds(input.bounds)
    if (!sanitized) throw new Error('Rox Design host bounds are invalid.')
    if (!isHttpUrl(input.url)) throw new Error('Rox Design view URL must be http(s).')

    const phaseHook = this.showPhaseHookFactory?.() ?? null

    const hostWebContentsId = hostWindow.webContents.id
    const entry = this.entries.get(hostWebContentsId) ?? this.createEntry(hostWindow, hostWebContentsId)

    const attachPhase = phaseHook?.startPhase('attach-view') ?? null
    try {
      this.attachEntry(entry)
      this.setEntryBounds(entry, sanitized)
    } finally {
      attachPhase?.end()
    }

    if (entry.currentUrl !== input.url) {
      // Prime dom-ready / did-finish-load hooks BEFORE loadURL so the events
      // race with the latest load, not a stale one. The configureWebContents
      // listeners call hook.end() then clear the slot.
      if (phaseHook) {
        this.pendingPhaseHooks.set(entry.webContents.id, {
          domReady: phaseHook.startPhase('dom-ready'),
          finishLoad: phaseHook.startPhase('did-finish-load'),
          hook: phaseHook,
        })
      }
      entry.currentUrl = input.url
      const loadPhase = phaseHook?.startPhase('load-url') ?? null
      try {
        await entry.webContents.loadURL(input.url)
      } finally {
        loadPhase?.end()
      }
    } else if (phaseHook) {
      // Same-URL re-show: there's no fresh navigation so dom-ready/finish-load
      // won't fire. Complete the show span immediately so callers get a
      // warm-cache record.
      phaseHook.complete()
    }

    this.showEntry(entry)
    return { status: 'shown', webContentsId: entry.webContents.id, viewKind: entry.viewKind }
  }

  setBounds(input: { senderWebContentsId: number; bounds: RoxDesignBounds }): void {
    const hostWindow = this.resolveHostWindow(input.senderWebContentsId)
    if (!hostWindow || hostWindow.isDestroyed()) return
    const entry = this.entries.get(hostWindow.webContents.id)
    if (!entry) return
    const sanitized = sanitizeRoxDesignBounds(input.bounds)
    if (!sanitized) {
      this.hideEntry(entry)
      return
    }
    this.setEntryBounds(entry, sanitized)
  }

  hide(senderWebContentsId: number): RoxDesignViewStatus {
    const hostWindow = this.resolveHostWindow(senderWebContentsId)
    if (!hostWindow || hostWindow.isDestroyed()) return { status: 'hidden' }
    const entry = this.entries.get(hostWindow.webContents.id)
    if (!entry) return { status: 'hidden' }
    this.hideEntry(entry)
    return { status: 'hidden', webContentsId: entry.webContents.id, viewKind: entry.viewKind }
  }

  hasWebContents(webContents: WebContents): boolean {
    for (const entry of this.entries.values()) {
      if (entry.webContents.id === webContents.id && !entry.webContents.isDestroyed()) return true
    }
    return false
  }

  getHostWindowForWebContents(webContents: WebContents): BrowserWindow | null {
    for (const entry of this.entries.values()) {
      if (entry.webContents.id === webContents.id) return entry.hostWindow.isDestroyed() ? null : entry.hostWindow
    }
    return null
  }

  destroyAll(): void {
    for (const entry of this.entries.values()) this.destroyEntry(entry)
    this.entries.clear()
  }

  private resolveHostWindow(senderWebContentsId: number): BrowserWindow | null {
    return this.windowManager?.getWindowByWebContentsId(senderWebContentsId) ?? null
  }

  private createEntry(hostWindow: BrowserWindow, hostWebContentsId: number): ManagedRoxDesignView {
    const canUseWebContentsView = typeof WebContentsView === 'function' && hostWindow.contentView != null
    const viewKind: RoxDesignViewKind = canUseWebContentsView ? 'webContentsView' : 'browserView'
    const view = canUseWebContentsView
      ? new WebContentsView({ webPreferences: this.secureWebPreferences() })
      : new BrowserView({ webPreferences: this.secureWebPreferences() })
    const entry: ManagedRoxDesignView = {
      hostWindow,
      hostWebContentsId,
      view,
      viewKind,
      webContents: view.webContents,
      currentUrl: null,
      attached: false,
      contentZoomFactor: 1,
      skinCssKey: null,
      disposeThemeBridge: null,
    }

    this.configureWebContents(entry)
    hostWindow.once('closed', () => {
      const current = this.entries.get(hostWebContentsId)
      if (current) {
        this.destroyEntry(current)
        this.entries.delete(hostWebContentsId)
      }
    })
    this.entries.set(hostWebContentsId, entry)
    return entry
  }

  private secureWebPreferences() {
    return {
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:rox-design',
      preload: this.preloadPath,
      sandbox: true,
      webviewTag: false,
    }
  }

  private configureWebContents(entry: ManagedRoxDesignView): void {
    entry.webContents.setWindowOpenHandler(({ url }) => {
      const decision = getRoxDesignNavigationDecision(entry.currentUrl, url)
      if (decision.action === 'allow') {
        void entry.webContents.loadURL(url)
      } else if (decision.action === 'external') {
        void shell.openExternal(decision.url)
      }
      return { action: 'deny' }
    })

    entry.webContents.on('will-navigate', (event, url) => {
      const decision = getRoxDesignNavigationDecision(entry.currentUrl, url)
      if (decision.action === 'allow') {
        entry.currentUrl = url
        return
      }
      event.preventDefault()
      if (decision.action === 'external') void shell.openExternal(decision.url)
    })

    entry.webContents.on('did-start-navigation', () => {
      entry.skinCssKey = null
      // Tear down theme bridge on navigation; it will be re-established after
      // the new page load triggers applyEmbedSkin again.
      entry.disposeThemeBridge?.()
      entry.disposeThemeBridge = null
    })

    entry.webContents.on('dom-ready', () => {
      const pending = this.pendingPhaseHooks.get(entry.webContents.id)
      pending?.domReady?.end()
      if (pending) pending.domReady = null
      void this.applyEmbedSkin(entry)
    })

    entry.webContents.on('did-finish-load', () => {
      const pending = this.pendingPhaseHooks.get(entry.webContents.id)
      pending?.finishLoad?.end()
      if (pending) pending.finishLoad = null
      // Drop the slot once both child hooks resolved so subsequent shows
      // get a clean record. Close the show-level hook so the parent span
      // (cold-start / warm-open total) is emitted.
      if (pending && !pending.domReady && !pending.finishLoad) {
        pending.hook?.complete()
        this.pendingPhaseHooks.delete(entry.webContents.id)
      }
      void this.applyEmbedSkin(entry)
      // Start INP polling once the page is loaded. The poll re-runs even if
      // the page navigates within the same webContents — the bootstrap script
      // re-initializes the observer on each navigation.
      this.startInpPolling(entry)
    })

    entry.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      // Release any pending perf phase hooks so we don't leak open spans
      // when the load aborts before dom-ready / did-finish-load fire.
      const pending = this.pendingPhaseHooks.get(entry.webContents.id)
      pending?.domReady?.end()
      pending?.finishLoad?.end()
      pending?.hook?.complete()
      this.pendingPhaseHooks.delete(entry.webContents.id)
      this.stopInpPolling(entry.webContents.id)
      this.logger?.warn?.('[rox-design-view] load failed', { errorCode, errorDescription, validatedURL })
    })

    ;(entry.webContents as WebContents & { setBackgroundColor?: (color: string) => void }).setBackgroundColor?.('#05070d')
    ;(entry.view as { setBackgroundColor?: (color: string) => void }).setBackgroundColor?.('#05070d')
  }

  private attachEntry(entry: ManagedRoxDesignView): void {
    if (entry.attached || entry.hostWindow.isDestroyed()) return
    if (entry.viewKind === 'webContentsView') {
      entry.hostWindow.contentView.addChildView(entry.view as WebContentsView)
    } else {
      entry.hostWindow.addBrowserView(entry.view as BrowserView)
    }
    entry.attached = true
  }

  private setEntryBounds(entry: ManagedRoxDesignView, bounds: RoxDesignRectangle): void {
    const zoomFactor = entry.hostWindow.webContents.getZoomFactor?.() ?? 1
    const scaled = scaleRoxDesignBounds(bounds, zoomFactor)
    const contentZoomFactor = resolveRoxDesignContentZoomFactor(bounds)
    if (entry.contentZoomFactor !== contentZoomFactor) {
      entry.contentZoomFactor = contentZoomFactor
      entry.webContents.setZoomFactor(contentZoomFactor)
      void this.applyEmbedSkin(entry)
    }
    entry.view.setBounds(scaled)
    ;(entry.view as BrowserView).setAutoResize?.({ width: false, height: false })
  }

  private async applyEmbedSkin(entry: ManagedRoxDesignView): Promise<void> {
    if (entry.webContents.isDestroyed()) return
    try {
      // C-H4: cycle inserted CSS sheets — drop the previous key before inserting
      // the next one, otherwise stylesheets accumulate across navigations and
      // theme changes. removeInsertedCSS can throw if the key was already
      // invalidated by an intervening navigation, so we swallow that case and
      // still apply the new sheet.
      if (entry.skinCssKey) {
        const prevKey = entry.skinCssKey
        entry.skinCssKey = null
        try {
          await entry.webContents.removeInsertedCSS(prevKey)
        } catch (removeError) {
          this.logger?.warn?.('[rox-design-view] removeInsertedCSS failed (likely stale key)', {
            error: removeError instanceof Error ? removeError.message : String(removeError),
          })
        }
      }
      if (!entry.webContents.isDestroyed()) {
        entry.skinCssKey = await entry.webContents.insertCSS(ROX_DESIGN_EMBED_CSS)
      }
      await entry.webContents.executeJavaScript(buildRoxDesignEmbedBootstrapScript(entry.contentZoomFactor), true)

      // Start the native theme/i18n/icon bridge on first successful skin apply.
      // Re-navigation resets skinCssKey, so dispose + restart on each new page load.
      if (!entry.disposeThemeBridge && !entry.webContents.isDestroyed()) {
        entry.disposeThemeBridge = startDesignThemeBridge(entry.webContents)
      }
    } catch (error) {
      this.logger?.warn?.('[rox-design-view] failed to apply embedded ROX skin', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private showEntry(entry: ManagedRoxDesignView): void {
    if (entry.viewKind === 'webContentsView') {
      ;(entry.view as WebContentsView).setVisible(true)
    } else if (!entry.hostWindow.isDestroyed()) {
      entry.hostWindow.setTopBrowserView?.(entry.view as BrowserView)
    }
  }

  private hideEntry(entry: ManagedRoxDesignView): void {
    this.stopInpPolling(entry.webContents.id)
    if (entry.hostWindow.isDestroyed()) return
    entry.view.setBounds({ x: 0, y: 0, width: 1, height: 1 })
    if (entry.viewKind === 'webContentsView') {
      ;(entry.view as WebContentsView).setVisible(false)
    } else {
      const removable = entry.hostWindow as BrowserWindow & { removeBrowserView?: (view: BrowserView) => void }
      removable.removeBrowserView?.(entry.view as BrowserView)
      entry.attached = false
    }
  }

  private destroyEntry(entry: ManagedRoxDesignView): void {
    this.hideEntry(entry)
    this.stopInpPolling(entry.webContents.id)
    entry.disposeThemeBridge?.()
    entry.disposeThemeBridge = null
    // C-H4: drop the previously inserted skin sheet (best-effort) so it cannot
    // outlive the WebContents in the partition's stylesheet cache.
    if (entry.skinCssKey && !entry.webContents.isDestroyed()) {
      const prevKey = entry.skinCssKey
      entry.skinCssKey = null
      try {
        void entry.webContents.removeInsertedCSS(prevKey)
      } catch (error) {
        this.logger?.warn?.('[rox-design-view] removeInsertedCSS during destroy failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    // C-H4: close the listener-leak — every entry.webContents.on(...) site in
    // configureWebContents must be paired here. removeAllListeners drops:
    // will-navigate, did-start-navigation, dom-ready, did-finish-load,
    // did-fail-load (plus any future handlers without us forgetting).
    if (!entry.webContents.isDestroyed()) {
      try {
        entry.webContents.removeAllListeners()
      } catch (error) {
        this.logger?.warn?.('[rox-design-view] removeAllListeners failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    if (!entry.webContents.isDestroyed()) entry.webContents.close()
  }

  private startInpPolling(entry: ManagedRoxDesignView): void {
    if (!this.inpSink) return
    if (this.inpPollTimers.has(entry.webContents.id)) return
    const timer = setInterval(() => {
      void this.drainInpBuffer(entry)
    }, this.inpPollIntervalMs)
    // Don't keep the Electron event loop alive on this timer.
    ;(timer as unknown as { unref?: () => void }).unref?.()
    this.inpPollTimers.set(entry.webContents.id, timer)
  }

  private stopInpPolling(webContentsId: number): void {
    const timer = this.inpPollTimers.get(webContentsId)
    if (!timer) return
    clearInterval(timer)
    this.inpPollTimers.delete(webContentsId)
  }

  private async drainInpBuffer(entry: ManagedRoxDesignView): Promise<void> {
    if (!this.inpSink) return
    if (entry.webContents.isDestroyed()) {
      this.stopInpPolling(entry.webContents.id)
      return
    }
    try {
      const samples = await entry.webContents.executeJavaScript(
        '(typeof window.__ROX_DESIGN_PERF_READ__ === "function" ? window.__ROX_DESIGN_PERF_READ__() : [])',
        true,
      ) as unknown
      if (!Array.isArray(samples)) return
      for (const value of samples) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          this.inpSink(value)
        }
      }
    } catch (error) {
      this.logger?.warn?.('[rox-design-view] inp poll failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
