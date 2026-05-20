/**
 * EmbedReceiver — runs inside the embedded Design webContents (renderer side).
 * Receives theme snapshot messages posted from the host bridge and applies
 * them to documentElement.style via setProperty.
 *
 * Also enforces an origin filter: only messages from the tracked
 * managedWebContentsId are accepted, preventing rogue frames from injecting
 * tokens.
 */

import type { ThemeSnapshot } from './HostBridge'

export interface MessageEvent {
  senderId: number
}

export interface ThemeMessage {
  type: string
  snapshot: ThemeSnapshot
}

export interface EmbedReceiverOptions {
  /** When set, only messages from this webContents id are accepted. */
  managedWebContentsId?: number
}

export class EmbedReceiver {
  private readonly _managedId: number | undefined

  constructor(options: EmbedReceiverOptions = {}) {
    this._managedId = options.managedWebContentsId
  }

  /**
   * Apply a theme snapshot to the current document root.
   * Each entry in the snapshot is written as a CSS custom property on
   * `document.documentElement.style`.
   */
  apply(snapshot: ThemeSnapshot): void {
    const { style } = document.documentElement
    for (const [name, value] of Object.entries(snapshot)) {
      style.setProperty(name, value)
    }
  }

  /**
   * Handle an incoming postMessage event. Returns `true` if the message was
   * accepted and applied, `false` if it was rejected (wrong sender or type).
   */
  handleMessage(event: MessageEvent, message: ThemeMessage): boolean {
    // Origin filter: reject messages from non-Design webContents
    if (this._managedId !== undefined && event.senderId !== this._managedId) {
      return false
    }

    if (message.type !== 'rox-design:theme-snapshot') {
      return false
    }

    this.apply(message.snapshot)
    return true
  }
}
