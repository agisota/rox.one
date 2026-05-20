/**
 * Diagnostic logger for macOS white-window investigation.
 *
 * Activated by setting ROX_DIAG=1 before launching the packaged app.
 * Writes JSON-lines to ~/Library/Logs/<AppName>/diag.log and opens
 * DevTools in detached mode on the first BrowserWindow.
 *
 * Scope: ROX_DIAG=1 only — zero overhead in normal operation.
 */

import { app, session, webContents } from 'electron'
import { join } from 'path'
import { createWriteStream, readdirSync as fsReaddirSync } from 'fs'
import type { WriteStream } from 'fs'

let logStream: WriteStream | null = null

function write(record: Record<string, unknown>): void {
  if (!logStream) return
  logStream.write(JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n')
}

function safeReaddirSync(dir: string): string[] {
  try {
    // original-fs bypasses ASAR so we see real filesystem entries
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ofs = require('original-fs') as { readdirSync: typeof fsReaddirSync }
    return ofs.readdirSync(dir) as unknown as string[]
  } catch (err) {
    return [`<error: ${String(err)}>`]
  }
}

/**
 * Call once from main/index.ts inside app.whenReady() when ROX_DIAG=1.
 * Dumps environment info and subscribes to renderer/webRequest events.
 */
export function initDiagLogger(): void {
  if (process.env.ROX_DIAG !== '1') return

  const logDir = app.getPath('logs')
  const logPath = join(logDir, 'diag.log')
  logStream = createWriteStream(logPath, { flags: 'a' })

  write({ event: 'diag-start', reason: 'ROX_DIAG=1 detected' })

  // --- Environment snapshot ---
  write({
    event: 'env-snapshot',
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    exePath: app.getPath('exe'),
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    versions: process.versions,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromiumVersion: process.versions.chrome,
  })

  // List entries at resourcesPath (shows what's inside the built .app bundle)
  write({
    event: 'resources-listing',
    resourcesPath: process.resourcesPath,
    entries: safeReaddirSync(process.resourcesPath),
  })

  // List app.getAppPath() (root of the ASAR or unpacked dir)
  write({
    event: 'app-path-listing',
    appPath: app.getAppPath(),
    entries: safeReaddirSync(app.getAppPath()),
  })

  // List registered custom protocols
  const knownSchemes = ['file', 'rox', 'thumbnail', 'app', 'electron']
  const registeredProtocols = knownSchemes.map(scheme => ({
    scheme,
    isPrivileged: session.defaultSession.protocol.isProtocolRegistered(scheme),
    isHandled: session.defaultSession.protocol.isProtocolHandled(scheme),
  }))
  write({ event: 'registered-protocols', protocols: registeredProtocols })

  // --- Subscribe to new webContents (catches the renderer window) ---
  app.on('web-contents-created', (_event, wc) => {
    const wcId = wc.id
    const url = wc.getURL()

    write({
      event: 'web-contents-created',
      wcId,
      url,
      webPreferences: {
        contextIsolation: wc.getWebRTCIPHandlingPolicy?.() ?? null,
        // Dump the sanitized subset we care about
        sandbox: (wc as unknown as { sandbox?: boolean }).sandbox ?? null,
      },
    })

    // Open DevTools detached on first window for live inspection
    wc.once('did-finish-load', () => {
      try {
        wc.openDevTools({ mode: 'detach' })
        write({ event: 'devtools-opened', wcId })
      } catch (err) {
        write({ event: 'devtools-open-error', wcId, error: String(err) })
      }
    })

    wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      write({ event: 'did-fail-load', wcId, errorCode, errorDescription, validatedURL, isMainFrame })
    })

    wc.on('did-fail-provisional-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      write({ event: 'did-fail-provisional-load', wcId, errorCode, errorDescription, validatedURL, isMainFrame })
    })

    wc.on('console-message', (_e, level, message, line, sourceId) => {
      // level: 0=verbose, 1=info, 2=warning, 3=error
      if (level >= 2) {
        write({ event: 'console-message', wcId, level, message, line, sourceId })
      }
    })

    wc.on('render-process-gone', (_e, details) => {
      write({ event: 'render-process-gone', wcId, details })
    })

    wc.on('unresponsive', () => {
      write({ event: 'unresponsive', wcId })
    })

    wc.on('preload-error', (_e, preloadPath, error) => {
      write({ event: 'preload-error', wcId, preloadPath, error: String(error) })
    })

    // Subscribe to network errors for this webContents' session
    try {
      wc.session.webRequest.onErrorOccurred({ urls: ['<all_urls>'] }, (details) => {
        write({
          event: 'network-error',
          wcId,
          url: details.url,
          error: details.error,
          resourceType: details.resourceType,
          requestId: details.id,
        })
      })
    } catch (err) {
      write({ event: 'network-error-subscription-failed', wcId, error: String(err) })
    }
  })

  // Flush and close on quit
  app.on('before-quit', () => {
    write({ event: 'diag-end', reason: 'before-quit' })
    logStream?.end()
  })

  // Also log the path so CI steps can find the file
  // eslint-disable-next-line no-console
  console.log(`[ROX_DIAG] Logging diagnostics to: ${logPath}`)
}
