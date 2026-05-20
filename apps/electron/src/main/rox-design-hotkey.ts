/**
 * rox-design-hotkey — registers the ⌘⇧D / Ctrl+Shift+D in-focus hotkey on
 * a BrowserWindow's webContents. When triggered while the window is focused,
 * it sends the `design:toggle` IPC channel to the renderer.
 *
 * Uses `webContents.on('before-input-event')` so the shortcut is only active
 * when the Electron window has keyboard focus (unlike globalShortcut which
 * fires even when the app is backgrounded).
 */

import { BrowserWindow, type WebContents } from 'electron'

/**
 * Returns true when the given `input` event matches ⌘⇧D (macOS) or
 * Ctrl+Shift+D (Windows/Linux).
 */
function isDesignHotkey(input: Electron.Input): boolean {
  if (input.type !== 'keyDown') return false
  if (input.key.toLowerCase() !== 'd') return false
  if (!input.shift) return false
  return input.meta || input.control
}

/**
 * Register the design toggle hotkey on a single webContents instance.
 *
 * Only dispatches `design:toggle` when `BrowserWindow.getFocusedWindow()`
 * returns a window whose `webContents.id` matches the registering webContents,
 * ensuring the shortcut fires only while the correct window is in focus.
 *
 * @param webContents The renderer webContents to attach the listener to.
 */
export function registerDesignHotkeyOnWebContents(webContents: WebContents): void {
  webContents.on('before-input-event', (_event, input) => {
    if (!isDesignHotkey(input)) return

    const focusedWin = BrowserWindow.getFocusedWindow()
    if (!focusedWin) return

    // Only fire for the focused window's webContents
    if (focusedWin.webContents.id !== webContents.id) return

    webContents.send('design:toggle')
  })
}
