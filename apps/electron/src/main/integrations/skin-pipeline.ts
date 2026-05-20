/**
 * PZD-W3 G.2.2.1.D — integration-agnostic skin pipeline.
 *
 * Every integration that ships a native skin (CSS + optional bootstrap JS)
 * MUST route apply/reapply/destroy through this pipeline. It closes audit
 * finding C-H4 (stale inserted-CSS keys leak when a skin is reapplied without
 * removing the previous one) at the framework level: `reapplySkin` ALWAYS
 * calls `removeInsertedCSS(prevKey)` BEFORE inserting the new CSS, so a
 * second apply cannot accumulate orphaned style sheets in the renderer.
 *
 * Token substitution is intentionally minimal — basic `{{token-name}}`
 * replacement against a flat `tokenMap`. Integrations that need richer
 * templating should pre-process their CSS before passing it here.
 *
 * Errors are caught and logged via `mainLog.error('[integration.skin]', ...)`
 * so a malformed bootstrap script cannot crash the host window. `destroySkin`
 * tolerates an invalid key (e.g. when the webContents already navigated away
 * and the renderer dropped the inserted sheet) — the goal is best-effort
 * cleanup, never a hard failure on teardown.
 */
import type { WebContents } from 'electron'

import { mainLog } from '../logger'

/**
 * Declarative skin description applied to a webContents.
 *
 * `bootstrapScript` is executed AFTER `insertCSS` resolves, so the skin's CSS
 * is already attached to the document by the time the script runs. The
 * script is invoked with `userGesture=true` to mirror the production usage in
 * `rox-design-view-manager` (some Web APIs gate on the user-gesture bit).
 */
export interface SkinConfig {
  /** CSS source string. May contain `{{token-name}}` placeholders. */
  css: string
  /** Optional JS payload to execute after the CSS is inserted. */
  bootstrapScript?: string
  /**
   * Flat key→value map used to expand `{{token-name}}` placeholders in `css`.
   * Tokens absent from the map are left untouched so partial maps are valid.
   */
  tokenMap?: Record<string, string>
}

/**
 * Substitute `{{token-name}}` placeholders in `css` with values from
 * `tokenMap`. Tokens not present in the map are left in place (callers can
 * see leftover placeholders to detect missing tokens during development).
 */
export function substituteTokens(css: string, tokenMap?: Record<string, string>): string {
  if (!tokenMap) return css
  return css.replace(/\{\{([^}]+)\}\}/g, (match, rawName: string) => {
    const name = rawName.trim()
    const value = tokenMap[name]
    return value !== undefined ? value : match
  })
}

/**
 * Pipeline that applies, replaces, and tears down skins on Electron
 * webContents. The pipeline is stateless — callers persist the returned
 * `cssKey` and pass it back on reapply/destroy so a single pipeline instance
 * can serve every integration in the process.
 */
export class SkinPipeline {
  /**
   * Insert the skin's CSS into `webContents` and run the bootstrap script.
   * Returns the inserted-CSS key so callers can later `reapplySkin` or
   * `destroySkin`. Errors are caught and logged; the returned promise
   * resolves with an empty key on failure so callers can treat it as a no-op
   * destroy candidate.
   */
  async applySkin(
    webContents: WebContents,
    skinConfig: SkinConfig,
  ): Promise<{ cssKey: string }> {
    try {
      if (webContents.isDestroyed()) {
        return { cssKey: '' }
      }
      const css = substituteTokens(skinConfig.css, skinConfig.tokenMap)
      const cssKey = await webContents.insertCSS(css)
      if (skinConfig.bootstrapScript !== undefined && !webContents.isDestroyed()) {
        await webContents.executeJavaScript(skinConfig.bootstrapScript, true)
      }
      return { cssKey }
    } catch (error) {
      mainLog.error('[integration.skin] applySkin failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { cssKey: '' }
    }
  }

  /**
   * Replace the previously applied skin with a new one. Calls
   * `removeInsertedCSS(prevKey)` BEFORE inserting the new CSS so the renderer
   * never carries two concurrent skin sheets (audit C-H4).
   */
  async reapplySkin(
    webContents: WebContents,
    prevKey: string,
    newConfig: SkinConfig,
  ): Promise<{ cssKey: string }> {
    try {
      if (webContents.isDestroyed()) {
        return { cssKey: '' }
      }
      if (prevKey) {
        try {
          await webContents.removeInsertedCSS(prevKey)
        } catch (removeError) {
          // Best-effort: a stale key (e.g. after navigation reset) must not
          // block reapply. Log at error so audit-trail still sees the drift.
          mainLog.error('[integration.skin] reapplySkin removeInsertedCSS failed', {
            error: removeError instanceof Error ? removeError.message : String(removeError),
            prevKey,
          })
        }
      }
      return await this.applySkin(webContents, newConfig)
    } catch (error) {
      mainLog.error('[integration.skin] reapplySkin failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { cssKey: '' }
    }
  }

  /**
   * Remove the inserted CSS associated with `cssKey`. Tolerates an invalid or
   * stale key — destruction is best-effort and never throws.
   */
  async destroySkin(webContents: WebContents, cssKey: string): Promise<void> {
    try {
      if (webContents.isDestroyed()) return
      if (!cssKey) return
      await webContents.removeInsertedCSS(cssKey)
    } catch (error) {
      mainLog.error('[integration.skin] destroySkin failed', {
        error: error instanceof Error ? error.message : String(error),
        cssKey,
      })
    }
  }
}
