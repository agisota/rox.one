/**
 * rox-design-theme-bridge.ts — T537 PR #2
 *
 * Orchestrator that wires:
 *   1. HostBridge → nativeTheme → snapshot → Design webContents (CSS vars)
 *   2. i18next languageChanged → Design webContents (localStorage config)
 *   3. Icon override: OD SVG <use> hrefs remapped to Lucide ROX set via
 *      MutationObserver injection (debounced 50ms, scoped to Design webContents)
 *
 * Constraints:
 *   - Does NOT touch auto-update code (T536)
 *   - Does NOT touch context-bridge / classifier (PR #4)
 *   - Does NOT modify vendored apps/electron/resources/rox-design/**
 */

import type { WebContents } from 'electron'
import { HostBridge } from '@rox-one/design-theme-bridge/HostBridge'

// ── Types ─────────────────────────────────────────────────────────────────

export interface I18nEmitter {
  language: string
  on(event: 'languageChanged', cb: (lng: string) => void): void
  off(event: 'languageChanged', cb: (lng: string) => void): void
}

// ── Icon registry ─────────────────────────────────────────────────────────

/**
 * Maps Open Design internal icon IDs to their Lucide equivalents.
 * Used by the MutationObserver injection (Cycles 11–12).
 */
const OD_TO_LUCIDE: Readonly<Record<string, string>> = {
  '#od-icon-close':         '#lucide-x',
  '#od-icon-settings':      '#lucide-settings',
  '#od-icon-search':        '#lucide-search',
  '#od-icon-plus':          '#lucide-plus',
  '#od-icon-trash':         '#lucide-trash-2',
  '#od-icon-check':         '#lucide-check',
  '#od-icon-chevron-down':  '#lucide-chevron-down',
  '#od-icon-chevron-right': '#lucide-chevron-right',
  '#od-icon-folder':        '#lucide-folder',
  '#od-icon-file':          '#lucide-file',
  '#od-icon-edit':          '#lucide-pencil',
  '#od-icon-copy':          '#lucide-copy',
  '#od-icon-link':          '#lucide-link',
  '#od-icon-upload':        '#lucide-upload',
  '#od-icon-download':      '#lucide-download',
  '#od-icon-arrow-left':    '#lucide-arrow-left',
  '#od-icon-arrow-right':   '#lucide-arrow-right',
  '#od-icon-info':          '#lucide-info',
  '#od-icon-warning':       '#lucide-alert-triangle',
  '#od-icon-error':         '#lucide-alert-circle',
}

/**
 * Resolve an Open Design SVG `<use href="...">` value to its Lucide equivalent.
 * Falls back to the original href if no mapping exists (Cycle 12: no throw).
 */
export function resolveIconHref(href: string): string {
  try {
    if (!href || !href.startsWith('#od-icon-')) return href
    return OD_TO_LUCIDE[href] ?? href
  } catch {
    return href
  }
}

// ── Theme bridge ──────────────────────────────────────────────────────────

/**
 * Start the nativeTheme → CSS-var bridge for the given Design webContents.
 * Returns a dispose function that removes all listeners.
 */
export function startThemeBridge(designWc: WebContents): () => void {
  // Import nativeTheme lazily so this module can be loaded in test environments
  // that don't have a full Electron runtime available.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { nativeTheme } = require('electron') as typeof import('electron')
  const bridge = new HostBridge()

  const postSnapshot = (snapshot: Record<string, string>) => {
    if (designWc.isDestroyed()) return
    // Build and inject a script that calls setProperty for each var
    const entries = Object.entries(snapshot)
    if (entries.length === 0) return

    const assignments = entries
      .map(([k, v]) => `  document.documentElement.style.setProperty(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
      .join('\n')

    const code = `(function() {\n${assignments}\n})();`
    designWc.executeJavaScript(code).catch(() => undefined)
  }

  bridge.startNativeThemeWatch(nativeTheme, postSnapshot)

  // Post initial snapshot immediately
  try {
    postSnapshot(bridge.snapshot())
  } catch {
    // snapshot() may fail in non-browser test environments; ignore
  }

  return () => bridge.dispose()
}

// ── i18n bridge ───────────────────────────────────────────────────────────

/**
 * Subscribe to i18next `languageChanged` events and propagate the new locale
 * into the embedded Design surface by writing to its localStorage config.
 *
 * Cycle 9: fires within 50ms of the event (synchronous dispatch, no rAF needed).
 * Cycle 10: RU locale sets language='ru' in the OD config store.
 *
 * Returns a dispose function.
 */
export function startI18nBridge(i18n: I18nEmitter, designWc: WebContents): () => void {
  const handler = (lng: string) => {
    if (designWc.isDestroyed()) return

    // Build a script that updates the OD config in localStorage
    const safeLng = JSON.stringify(lng)
    const code = `(function() {
  try {
    var raw = localStorage.getItem('open-design:config') || '{}';
    var cfg = JSON.parse(raw);
    cfg.language = ${safeLng};
    localStorage.setItem('open-design:config', JSON.stringify(cfg));
  } catch(e) {}
})();`

    designWc.executeJavaScript(code).catch(() => undefined)
  }

  i18n.on('languageChanged', handler)

  return () => {
    i18n.off('languageChanged', handler)
  }
}

// ── Icon observer injection ───────────────────────────────────────────────

/**
 * Inject a MutationObserver into the Design webContents that rewrites all
 * SVG `<use>` href attributes from OD icon IDs to Lucide equivalents.
 *
 * Debounced at 50ms, scoped only to the Design webContents (by id).
 *
 * Returns a dispose function (removes the observer via executeJavaScript).
 */
export function startIconObserver(designWc: WebContents): () => void {
  if (designWc.isDestroyed()) return () => undefined

  const iconMap = JSON.stringify(OD_TO_LUCIDE)

  const code = `(function() {
  if (window.__ROX_ICON_OBSERVER__) return;
  var MAP = ${iconMap};
  var DEBOUNCE_MS = 50;
  var timer = null;

  function swapIcons() {
    try {
      document.querySelectorAll('use[href], use[xlink\\\\:href]').forEach(function(el) {
        var attr = el.getAttribute('href') || el.getAttribute('xlink:href');
        if (!attr) return;
        var mapped = MAP[attr];
        if (!mapped || mapped === attr) return;
        if (el.getAttribute('href')) el.setAttribute('href', mapped);
        else el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', mapped);
      });
    } catch(e) {}
  }

  window.__ROX_ICON_OBSERVER__ = new MutationObserver(function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(swapIcons, ${50});
  });
  window.__ROX_ICON_OBSERVER__.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['href', 'xlink:href'],
  });
  swapIcons();
})();`

  designWc.executeJavaScript(code).catch(() => undefined)

  return () => {
    if (designWc.isDestroyed()) return
    designWc.executeJavaScript(`(function() {
  if (window.__ROX_ICON_OBSERVER__) {
    window.__ROX_ICON_OBSERVER__.disconnect();
    window.__ROX_ICON_OBSERVER__ = undefined;
  }
})();`).catch(() => undefined)
  }
}

// ── Composite start ───────────────────────────────────────────────────────

/**
 * Start all bridges for the Design webContents. Returns a dispose() that
 * tears down all listeners / observers.
 */
export function startDesignThemeBridge(
  designWc: WebContents,
  i18n?: I18nEmitter,
): () => void {
  const disposeTheme = startThemeBridge(designWc)
  const disposeI18n = i18n ? startI18nBridge(i18n, designWc) : () => undefined
  const disposeIcons = startIconObserver(designWc)

  return () => {
    disposeTheme()
    disposeI18n()
    disposeIcons()
  }
}
