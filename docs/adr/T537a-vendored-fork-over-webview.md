# Decision T537a: Vendor Open Design as in-process module rather than embed as external webview

- Status: accepted
- Date: 2026-05-19
- Implements: T537 (ROX Design embed)
- Source ticket: `docs/tickets/T537-rox-design-embed.md`

## Context

ROX wants to embed `nexu-io/open-design` as a Design surface that users can open from the top bar. Three options were considered:

**(a) BrowserView on nexu-io hosted URL** — direct to the Open Design cloud product via `BrowserWindow`/`BrowserView` pointed at a hosted domain. ROX controls nothing about the content, version, or availability of that URL.

**(b) Fork as renderer-embedded library** — vendor a pinned copy of the Open Design runtime payload into the repo (or build pipeline), manage its lifecycle inside the main Electron process, and render it via a managed Electron view. ROX controls version, network isolation, and integration surface.

**(c) Launch separate app and proxy window** — ship a second `.app` bundle alongside ROX and composite its window into the ROX chrome via `nativeWindowOpen` or an inter-process pipe. This preserves a clean process boundary at the cost of packaging complexity and startup latency.

The primary drivers:

- **No external runtime dependency** — a ROX install must be fully functional offline. Sending users to a hosted URL breaks this invariant.
- **Version pinning** — ROX's CSS theming bridge (see ADR-T537b) depends on specific HTML structure inside Open Design. An upstream deploy can break visual integration without notice if we point at a live URL.
- **Native-app feel** — the design surface must open within the ROX window without browser chrome, navigation bars, or cross-origin content warnings.
- **Signing / sandbox constraints** — the Electron sandbox makes a separate external app harder to composite reliably cross-platform; the managed-view pattern already has working implementations in the codebase (browser pane).

## Decision

Option (b). A vendored copy of Open Design 0.7.0 is placed in `apps/electron/resources/rox-design/`. Its lifecycle is managed by `RoxDesignRuntimeManager` (main process), and it is rendered via `RoxDesignViewManager` as an Electron managed view composited into the ROX window.

Key implementation contracts:

- The payload directory is populated by `bun run rox-design:prepare` from a local Open Design installation; it is not committed to git (except the `README.md` placeholder).
- `RoxDesignRuntimeManager` starts the daemon sidecar lazily on first user trigger (TopBar button or `Cmd+Shift+D` / `Ctrl+Shift+D`).
- `RoxDesignViewManager` creates and positions the managed view, forwarding focus and resize events from the main window.
- The vendored copy is loaded from disk via a `file://` URL; no network calls are made for the core function.
- Versioning is tracked in `apps/electron/resources/rox-design/NOTICES.md`.

## Consequences

**Positive:**

- Full control over the Open Design version in production; a bad upstream release cannot affect shipped ROX without an explicit vendored-copy refresh.
- No external network dependency for the core design function; works fully offline.
- Native-app feel: the design surface sits inside the ROX window frame with no browser chrome.
- The existing managed-view pattern (browser pane) provides a proven integration blueprint.

**Negative:**

- The vendored runtime payload adds approximately 80 MB to the installer and auto-update delta.
- Adopting an upstream bugfix or feature requires a manual vendored-copy refresh (clone, rsync, verify, commit) — see `apps/electron/resources/rox-design/README.md` for the procedure.
- The payload is populated at build/packaging time, not at dev-server startup; developers must run `bun run rox-design:prepare` before the surface is functional locally.

**Mitigation:**

- Lazy-load by user trigger (TopBar button) so the 80 MB payload incurs no startup cost.
- The upstream sync procedure is documented in `apps/electron/resources/rox-design/README.md` and Renovate will file weekly issues once PR #5b lands (T537 follow-up).
- `bun run rox-design:payload:verify` validates payload integrity before a build is published.

## Rejected Options

- **Option (a), hosted URL** — fails the offline invariant and the version-pinning requirement. Visual integration via CSS bridge becomes unreliable against live upstream deploys.
- **Option (c), separate app proxy** — packaging a second `.app`/`.exe` alongside ROX doubles signing, notarization, and auto-update surface area. Electron sandbox constraints on macOS make reliable window compositing brittle; startup latency is meaningfully higher than a managed in-process view.
