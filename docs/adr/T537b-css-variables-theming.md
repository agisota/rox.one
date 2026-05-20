# Decision T537b: Theme the embedded Design surface via CSS custom properties, not a UI fork

- Status: accepted
- Date: 2026-05-19
- Implements: T537 PR #2 (native skin bridge)
- Source ticket: `docs/tickets/T537-rox-design-embed.md`
- Companion: ADR-T537a (vendored fork over webview)

## Context

Open Design ships its own visual style: custom typefaces, background colours, button shapes, border radii, and panel chrome that are visually distinct from ROX's ChatPanel. ROX wants the embedded design surface to look indistinguishable from the surrounding ROX chrome — same font stack, same colour palette, same density — without requiring the user to choose a separate theme inside Open Design.

Two approaches were considered:

**(a) Fork Open Design's CSS/component source** — apply ROX design tokens directly to the upstream SCSS/CSS files inside the vendored copy and maintain the patch across upstream syncs.

**(b) CSS custom-property bridge** — ship a thin renderer-side bridge (`HostBridge`) and a preload script (`EmbedReceiver`) that read ROX's `--rox-*` CSS variables from `:root` at runtime and inject them into the embedded surface. Suppress Open Design's native chrome via a zero-specificity `:where()` stylesheet so the vendored files remain byte-for-byte identical to upstream.

The primary drivers:

- **Zero-modification vendored copy** — ADR-T537a requires the payload to be a full upstream copy with no edits, so that upstream syncs are a straight `rsync`. Patching upstream CSS (option a) invalidates this constraint.
- **Instant theme switching** — ROX supports multiple themes and a user may switch theme mid-session. The bridge must propagate changes within a single frame; a static patch cannot respond to runtime theme changes.
- **Specificity isolation** — the override stylesheet must not create a fragile specificity war with Open Design's own CSS. `:where()` has specificity 0, ensuring ROX overrides lose only when Open Design itself uses inline styles or `!important`.

## Decision

Build a two-part CSS custom-property bridge:

- **`HostBridge`** (renderer process) — reads all `--rox-*` CSS custom properties from `:root` in the ROX renderer, serialises them to a plain object, and sends the map to the embedded view via `ipcRenderer.sendToFrame` on page load and on any `theme-changed` event.
- **`EmbedReceiver`** (preload script injected into the managed view) — receives the variable map via `ipcRenderer.on`, writes each `--rox-*` property to `:root` inside the Open Design document, and injects a static `:where()` stylesheet that overrides Open Design's native panel chrome using only ROX variable references.

The `:where()` stylesheet is applied once at preload time. Variable values are refreshed on every `theme-changed` event, so theme switches take effect within a single 16 ms frame.

The vendored Open Design copy remains byte-for-byte identical to upstream; the bridge code lives entirely in:

```
apps/electron/src/renderer/design/host-bridge.ts
apps/electron/src/preload/embed-receiver.ts
apps/electron/src/renderer/styles/rox-design-overrides.css
```

## Consequences

**Positive:**

- The vendored copy carries zero modifications; upstream syncs are a straight `rsync --delete` with no patch rebase.
- Theme switches propagate instantly (within 16 ms) without requiring an Open Design reload.
- `:where()` specificity-0 overrides avoid specificity wars with Open Design's own selectors; the override stylesheet reads like a conventional CSS token mapping.
- Bridge code is isolated to three files; if Open Design's HTML structure changes, only the override CSS needs updating.

**Negative:**

- The bridge depends on Open Design's HTML element structure to target override selectors correctly. An upstream HTML refactor can break visual integration even if no CSS variable names change.
- Every new ROX theme token that should propagate into Open Design requires an explicit entry in the override map; tokens not in the map fall through to Open Design's defaults.
- `:where()` has no support in very old Electron versions; confirmed supported in the Electron version currently in use.

**Mitigation:**

- Playwright snapshot tests with a ≤2% pixel-diff gate run on every PR that touches `rox-design-overrides.css` or the bridge files. A failing snapshot is a required gate for merge.
- The visual-regression suite is documented in `docs/validation/rox-design-visual-regression.md`.

## Rejected Options

- **Option (a), fork upstream CSS** — requires maintaining a patch diff across every upstream sync. As Open Design's SCSS is compiled output, the patch surface is large and fragile. Conflicts would block urgent security syncs. Violates ADR-T537a's zero-modification constraint.
