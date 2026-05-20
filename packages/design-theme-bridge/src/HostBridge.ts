/**
 * HostBridge — runs in the Electron main process (or a browser-like environment
 * for testing). Reads all `--rox-*` CSS custom properties from `:root` and
 * exposes them as a plain snapshot object that can be posted to the embedded
 * Design webContents.
 */

export type ThemeSnapshot = Record<string, string>

export interface NativeThemeEmitter {
  on(event: 'updated', listener: () => void): void
  removeListener(event: 'updated', listener: () => void): void
}

export class HostBridge {
  private _themeListener: (() => void) | null = null
  private _nativeTheme: NativeThemeEmitter | null = null

  /**
   * Read all `--rox-*` CSS variables from `:root` and return them as a plain
   * `{ name: value }` map. Values are taken from getComputedStyle so they
   * reflect the live resolved value, not just inline declarations.
   */
  snapshot(): ThemeSnapshot {
    const result: ThemeSnapshot = {}
    const root = document.documentElement
    const computed = getComputedStyle(root)

    for (const name of root.style) {
      if (!name.startsWith('--rox-')) continue
      const value = computed.getPropertyValue(name).trim()
      if (value) result[name] = value
    }

    return result
  }

  /**
   * Subscribe to nativeTheme `updated` events and call `onSnapshot` with a
   * fresh snapshot. The callback is scheduled via `requestAnimationFrame` (or
   * `setTimeout(0)` in environments without rAF) so it fires within one frame
   * (~16 ms) of the theme change.
   */
  startNativeThemeWatch(
    nativeTheme: NativeThemeEmitter,
    onSnapshot: (snapshot: ThemeSnapshot) => void,
  ): void {
    this._nativeTheme = nativeTheme

    this._themeListener = () => {
      const schedule =
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : (cb: () => void) => setTimeout(cb, 0)

      schedule(() => {
        onSnapshot(this.snapshot())
      })
    }

    nativeTheme.on('updated', this._themeListener)
  }

  /**
   * Remove the nativeTheme listener. Call this when the Design surface is
   * being torn down to avoid memory leaks.
   */
  dispose(): void {
    if (this._nativeTheme && this._themeListener) {
      this._nativeTheme.removeListener('updated', this._themeListener)
      this._themeListener = null
      this._nativeTheme = null
    }
  }
}
