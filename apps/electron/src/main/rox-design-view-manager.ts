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
  /**
   * In-flight loadURL promise for this entry.
   * Serializes concurrent show() calls so a second invocation always waits
   * for the first loadURL to settle before issuing its own load.
   * Fixes audit finding C-H3: rox-design:view-show load serialization.
   */
  loadPromise: Promise<void> | null
}

export interface RoxDesignViewManagerOptions {
  windowManager?: WindowManager | null
  preloadPath?: string
  logger?: {
    info?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
    error?: (message: string, meta?: Record<string, unknown>) => void
  }
}

export class RoxDesignViewManager {
  private readonly windowManager?: WindowManager | null
  private readonly preloadPath: string
  private readonly logger: RoxDesignViewManagerOptions['logger']
  private readonly entries = new Map<number, ManagedRoxDesignView>()

  constructor(options: RoxDesignViewManagerOptions = {}) {
    this.windowManager = options.windowManager
    this.preloadPath = options.preloadPath ?? join(__dirname, 'rox-design-bridge-preload.cjs')
    this.logger = options.logger
  }

  async show(input: { senderWebContentsId: number; url: string; bounds: RoxDesignBounds }): Promise<RoxDesignViewStatus> {
    const hostWindow = this.resolveHostWindow(input.senderWebContentsId)
    if (!hostWindow || hostWindow.isDestroyed()) {
      throw new Error('Rox Design host window is not available.')
    }

    const sanitized = sanitizeRoxDesignBounds(input.bounds)
    if (!sanitized) throw new Error('Rox Design host bounds are invalid.')
    if (!isHttpUrl(input.url)) throw new Error('Rox Design view URL must be http(s).')

    const hostWebContentsId = hostWindow.webContents.id
    const entry = this.entries.get(hostWebContentsId) ?? this.createEntry(hostWindow, hostWebContentsId)
    this.attachEntry(entry)

    // Bounds can be applied immediately — independent of the load (C-H3).
    this.setEntryBounds(entry, sanitized)

    if (entry.currentUrl !== input.url) {
      entry.currentUrl = input.url

      // C-H3: Serialize show() loads per-entry. If a loadURL is already in
      // flight, await it before starting a new one so that a rapid second
      // show() call cannot cancel the first load mid-flight and leave the
      // view in an inconsistent state (stale URL or setBounds before attach).
      if (entry.loadPromise) {
        await entry.loadPromise
      }

      entry.loadPromise = entry.webContents.loadURL(input.url).finally(() => {
        entry.loadPromise = null
      })
      await entry.loadPromise
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
      loadPromise: null,
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
      void this.applyEmbedSkin(entry)
    })

    entry.webContents.on('did-finish-load', () => {
      void this.applyEmbedSkin(entry)
    })

    entry.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
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
      if (!entry.skinCssKey) {
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
    entry.disposeThemeBridge?.()
    entry.disposeThemeBridge = null
    if (!entry.webContents.isDestroyed()) entry.webContents.close()
  }
}
