/**
 * PZD-79 G.2.2.1.C — sandbox baseline primitive.
 *
 * Every integration that spawns a WebContentsView MUST use this helper. It
 * enforces the Electron security baseline (sandbox, contextIsolation,
 * no nodeIntegration, no webviewTag, webSecurity, no insecure content) by
 * construction: the unsafe webPreferences keys are NOT exposed via the
 * helper's parameter type, so callers cannot weaken them.
 *
 * In packaged builds DevTools opens are intercepted and immediately closed
 * on the returned view, preventing the renderer-side debugger from being
 * used as an attack surface in shipped builds.
 */
import { WebContentsView, app } from 'electron'

export interface SecureWebContentsViewOptions {
  /** Absolute path to the preload script for this view. */
  preloadPath: string
  /** Optional Electron session partition (e.g. `persist:rox-design`). */
  partition?: string
}

/**
 * Create a WebContentsView with the hardened security baseline applied.
 *
 * The helper signature deliberately omits every webPreferences key that could
 * weaken sandbox / contextIsolation / nodeIntegration / webviewTag /
 * webSecurity / allowRunningInsecureContent — these are hard-coded inside
 * this function and cannot be overridden by callers.
 */
export function createSecureWebContentsView(options: SecureWebContentsViewOptions): WebContentsView {
  const webPreferences: Electron.WebPreferences = {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    preload: options.preloadPath,
    ...(options.partition !== undefined ? { partition: options.partition } : {}),
  }

  const view = new WebContentsView({ webPreferences })

  // Block DevTools in shipped builds. In development DevTools remains
  // available so engineers can debug integrations.
  if (app.isPackaged) {
    view.webContents.on('devtools-opened', () => {
      view.webContents.closeDevTools()
    })
  }

  return view
}
