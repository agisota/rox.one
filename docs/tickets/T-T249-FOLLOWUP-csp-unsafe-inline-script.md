# T-T249-FOLLOWUP: Remove unsafe-inline from script-src (nonce hardening)

Status: DONE

## Resolution

Landed at commit `c38a6555 feat(security): remove unsafe-inline from CSP
script-src across renderer HTMLs` (2026-05-14). Strategy A (externalize) used
for `index.html` and `playground.html` — React DevTools loader moved into
dedicated module scripts (`devtools-loader.ts`,
`devtools-loader-playground.ts`). Strategy A (delete) used for
`browser-toolbar.html` and `browser-empty-state.html` — the anti-FOUC theme
class swap was verified unnecessary; background colours are covered by
`@media (prefers-color-scheme: dark)` inside the `<style>` block, and neither
component uses `dark:` Tailwind classes. `'unsafe-inline'` retained in
`style-src` (Tailwind dependency, separate ticket).

Verification (2026-05-16): `rg "unsafe-inline" apps/electron/src/renderer/*.html`
returns matches only inside `style-src`; no inline `<script>` tags remain in
any of the four renderer HTML files.

This ticket was left in `Status: OPEN` after the work landed because the
follow-up file was not updated in the original PR. Closing now with the
landed-SHA reference for traceability.

## Context

T249 CSP audit (PR `feat/T249-csp-zod-boundary-hardening-v2`) removed
`unsafe-eval` from `index.html` — the most critical deviation. All four
Electron renderer HTML files still allow `unsafe-inline` in `script-src`.

## Files affected

| File | Current script-src | Issue |
|------|--------------------|-------|
| `apps/electron/src/renderer/index.html` | `'unsafe-inline' 'wasm-unsafe-eval'` | Inline scripts: React DevTools loader + initial theme sync |
| `apps/electron/src/renderer/browser-empty-state.html` | `'unsafe-inline' 'wasm-unsafe-eval'` | Inline script: theme class sync before paint |
| `apps/electron/src/renderer/browser-toolbar.html` | `'unsafe-inline' 'wasm-unsafe-eval'` | Inline script: theme class sync before paint |
| `apps/electron/src/renderer/playground.html` | `'unsafe-inline' 'wasm-unsafe-eval'` | Inline script: React DevTools loader |

## Why not fixed in T249 PR

Removing `unsafe-inline` from `script-src` requires one of:

1. **Nonce injection** — Electron main process must inject a `nonce-<value>`
   attribute into the `<meta http-equiv="Content-Security-Policy">` tag AND
   add the same nonce to every inline `<script>` tag at page-load time via
   `BrowserWindow.webContents.on('did-start-navigation')` + HTML string
   manipulation. This is ~40-60 lines across `window-manager.ts` and all
   four HTML files. Requires a build-time Vite plugin or runtime injection.
2. **Externalise all inline scripts** — move the 3-line theme-sync and
   React DevTools scripts to separate `.js` files loaded via `<script src>`.
   Viable and smaller, but requires Vite to bundle those shims.

Option 2 is the lower-risk path. The `<style>` blocks inside `<head>`
also use `unsafe-inline` in `style-src` — those are acceptable for
Electron (Vite injects critical CSS as inline styles; nonce-based style-src
requires Vite plugin support).

## Acceptance criteria

- `script-src` in all four HTML files omits `unsafe-inline`.
- Theme-sync and DevTools-loader scripts are in external `.js` shim files.
- `wasm-unsafe-eval` is retained (required for WASM modules).
- `bun test` and `validate-rebrand` continue to pass.

## Severity

MEDIUM — Electron's `contextIsolation: true` + `nodeIntegration: false`
mitigate XSS risk significantly, but `unsafe-inline` still enables any
XSS payload injected via a compromised renderer to execute arbitrary JS.
