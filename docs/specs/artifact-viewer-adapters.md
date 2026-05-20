# Artifact Viewer Adapters — Spec

**Ticket:** [PZD-37](https://linear.app/agisota/issue/PZD-37) (parent: PZD-10)
**Status:** Draft
**Owner:** Sidebar workstream
**Created:** 2026-05-20
**Target:** v1.1.x

---

## 1. Context

PR #286 (T537 Phase B) landed the `DesignArtifactCard` chat-attachment card, which currently handles a single artifact shape (`@rox-one/design-contract` `DesignArtifact` with `type ∈ {html, svg, png, pdf, pptx, mp4}`) and surfaces it as a thumbnail + Download + "Open in Design" CTA — see `apps/electron/src/renderer/components/chat/DesignArtifactCard.tsx`.

There is **no in-app preview** for those artifacts yet, and there is no support for Figma, browser snapshots, DOCX, XLSX, or Markdown. PZD-37 expands the artifact panel into a durable, secure, type-aware viewer layer.

This spec captures the architecture (registry + adapter interface) and the six adapters required, with per-adapter acceptance criteria, security boundaries, sequencing, and risk.

---

## 2. Goals & non-goals

### Goals

- Pluggable `ArtifactViewerRegistry` that maps an artifact kind/MIME to a renderer adapter.
- Lazy-loaded adapter modules — no upfront cost for unused types.
- Six adapters: `md`, `browser`, `docx`, `xlsx`, `pptx`, `figma`.
- Hard sandboxing: untrusted/active content cannot reach the app origin, tokens, cookies, or main DOM.
- Reuse the existing `DesignArtifact` schema and chat-card chrome where possible — additive metadata only.

### Non-goals

- Editing artifacts in-app (read-only viewers; editing remains in the source app).
- Server-side conversion service (each adapter renders client-side or via vetted local libs).
- Schema churn beyond optional metadata fields.
- Background re-rendering / pre-warming caches (deferred).

---

## 3. Architecture

### 3.1 Registry

```ts
// packages/artifact-viewer/src/registry.ts (new package)
export interface ArtifactAdapter {
  /** Adapter identifier — e.g. "md", "docx", "figma". */
  readonly kind: string

  /** True if this adapter can render the artifact (MIME-based dispatch). */
  canRender(mime: string): boolean

  /** Render the artifact into a React element for the viewer panel. */
  render(uri: string, opts: ViewOpts): React.ReactNode

  /** Export to a target format (PDF/PNG/HTML/native). Optional. */
  export?(uri: string, target: ExportTarget): Promise<Blob>
}

export interface ViewOpts {
  /** Theme inherited from app shell. */
  theme: 'light' | 'dark'
  /** Viewer panel size at render time. */
  size: { width: number; height: number }
  /** Abort signal for slow renders. */
  signal: AbortSignal
  /** Sandboxed partition name owned by the parent panel. */
  partition: string
  /** Locale for localized rendering. */
  locale: string
}

export type ExportTarget = 'pdf' | 'png' | 'html' | 'native'

export class ArtifactViewerRegistry {
  register(adapter: () => Promise<ArtifactAdapter>): void
  resolve(mime: string): Promise<ArtifactAdapter | null>
}
```

Registration is **factory-based**: callers register `() => import('./md-adapter')` so the actual module loads only on first match.

### 3.2 Dispatch flow

1. `ArtifactViewerPanel` receives a `DesignArtifact` (or future `AgentArtifact`) reference.
2. Panel resolves MIME from artifact metadata (or via `mime-types` lookup on the URI extension).
3. Panel calls `registry.resolve(mime)`. If null → render the existing `DesignArtifactCard` fallback (Download + Code link).
4. Panel mounts adapter inside a `<Suspense fallback={Skeleton} />` boundary with an error boundary catching converter failures.

### 3.3 Sandboxing

Each adapter that needs to load untrusted content (`browser`, `figma`, the HTML side of `docx`) renders inside an Electron `WebContentsView` (or sandboxed `<iframe>` in renderer-only adapters) bound to a **dedicated, per-kind partition**:

| Adapter | Partition                         | Sandbox kind         |
| ------- | --------------------------------- | -------------------- |
| md      | renderer-only (no partition)      | DOMPurify-sanitized  |
| browser | `persist:rox-artifact-browser`    | WebContentsView      |
| docx    | `persist:rox-artifact-docx`       | sandboxed iframe     |
| xlsx    | renderer-only (no partition)      | React/canvas table   |
| pptx    | `persist:rox-artifact-pptx`       | sandboxed iframe     |
| figma   | `persist:rox-artifact-figma`      | WebContentsView      |

This mirrors the existing `persist:rox-design` pattern in `apps/electron/src/main/rox-design-view-manager.ts` (`secureWebPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`). Each partition isolates cookies, storage, and service workers from both the app origin and other adapters.

A shared `secureArtifactWebPreferences(kind)` helper is added under `apps/electron/src/main/artifact-viewers/` and consumed by every WebContentsView-based adapter.

### 3.4 Lazy loading

- Adapter bundles are split with dynamic `import()` so the renderer's hot bundle stays small (budget ≤200KB JS) — only the artifact kinds actually viewed get loaded.
- Heavy native libs (mammoth, sheetjs, pptxgenjs) live in adapter chunks and never enter the main bundle.

### 3.5 Telemetry

Per the existing observability contract, each adapter emits:

- `artifact_viewer.adapter_loaded` (kind, load_ms)
- `artifact_viewer.render_start` / `render_complete` (kind, render_ms, bytes)
- `artifact_viewer.render_failed` (kind, reason, error_class)
- `artifact_viewer.export` (kind, target, bytes_out)

No PII or document content fields are emitted — bytes only.

---

## 4. Adapters

Each adapter section is intentionally self-contained so it can be lifted directly into a child Linear issue.

### 4.1 `md` — Markdown viewer

**MIME:** `text/markdown`, `text/x-markdown`, `.md` extension
**Library:** `markdown-it` (already lightweight) + `dompurify` for sanitization + `shiki` for code highlighting (already a runtime dep — confirmed by `runtime-payload-versions.json`).
**Sandboxing:** renderer-only. No partition needed — content is sanitized HTML rendered inside the app shell.

**Behavior:**

- Render Markdown to HTML via `markdown-it` with GFM extension.
- Sanitize with DOMPurify (`SAFE_FOR_TEMPLATES: true`, no `script`/`iframe`/event handlers).
- Highlight fenced code blocks via shiki using the active app theme (light/dark inherited from `ViewOpts.theme`).
- Internal anchor links scroll within the viewer; external links open via `shell.openExternal`.
- Image references resolved against the artifact's URI base; remote images blocked unless allowlisted CDN.

**Export:** `pdf` (print-to-PDF via the viewer's iframe), `html` (sanitized HTML blob).

**Acceptance criteria:**

- Given a `.md` artifact, when Preview opens, then the user sees the rendered Markdown with code highlighting matching the app theme within 200 ms for files ≤256 KB.
- Given a Markdown file with `<script>` or event-handler attributes, when previewed, then those nodes are stripped and a sandbox-warning toast is logged in dev mode (no toast in prod).
- Given external image references, when the host is not allowlisted, then the image is replaced with a placeholder + caption "external image blocked".
- Given a 5 MB Markdown file, when Preview opens, then rendering does not block the main thread for more than one 16ms frame (use `requestIdleCallback` chunked render).

**Effort:** S (≈3 days)
**Priority:** Medium

---

### 4.2 `browser` — Browser/page snapshot viewer

**MIME:** `text/html`, `application/xhtml+xml`, `multipart/related` (MHTML)
**Library:** Electron `WebContentsView` (already in tree, see `rox-design-view-manager.ts`).
**Sandboxing:** dedicated `persist:rox-artifact-browser` partition with `secureWebPreferences`.

**Behavior:**

- Mount a `WebContentsView` overlaying the viewer panel. Reuse the position/visibility machinery from `RoxDesignViewManager`.
- Load the HTML from `file://` URI directly (no fetch through renderer).
- Disable navigation away from the artifact: `getRoxDesignNavigationDecision`-style allowlist scoped to the artifact's directory.
- Block all top-level redirects; route external links to `shell.openExternal`.
- Expose a fullscreen toggle and "Open in default browser" download action.

**Export:** `pdf` (via `webContents.printToPDF`), `png` (via `webContents.capturePage`).

**Acceptance criteria:**

- Given an HTML artifact, when Preview opens, then the page renders inside a WebContentsView with no access to `window.electronAPI` or the app's origin (verified via console assertion in integration test).
- Given an HTML artifact that attempts to `fetch('https://app.rox.one/...')`, when running, then the request is blocked by partition isolation and CSP.
- Given a click on an external link, when fired, then it opens via `shell.openExternal` and not in the embedded view.
- Given the viewer closes, when the WebContentsView is detached, then its `webContents.destroy()` is called and the partition's cache is cleared.

**Effort:** M (≈5 days)
**Priority:** Medium

---

### 4.3 `docx` — Word document viewer

**MIME:** `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
**Library:** `mammoth` (DOCX → HTML, well-vetted) + DOMPurify; PDF fallback via `pdfjs-dist` for `.pdf` re-exports.
**Sandboxing:** rendered HTML displayed in a sandboxed `<iframe sandbox="allow-same-origin">` (no `allow-scripts`) using a blob URL.

**Behavior:**

- Read the `.docx` from `file://` via `fs.readFile`.
- Convert via `mammoth.convertToHtml({ buffer })` with custom style map preserving headings/lists.
- Sanitize HTML with DOMPurify.
- Inject the app's typography CSS for theme consistency.
- Show pagination indicator for documents >50 pages; lazy-render pages beyond the viewport.

**Export:** `pdf` (re-render the HTML via headless print), `html`.

**Acceptance criteria:**

- Given a 20-page DOCX, when Preview opens, then headings/lists/tables/images render with theme styling within 1.5 s.
- Given an unsupported feature (e.g., macros, embedded OLE), when encountered, then the unsupported region renders as a placeholder card; the rest of the doc still renders.
- Given a malformed DOCX (corrupt zip), when loaded, then the panel shows the "conversion failed" state with Code/Download still accessible.
- Given a docx with embedded images, when rendered, then images load from the in-memory blob (no remote fetch).

**Effort:** M (≈5 days)
**Priority:** Low

---

### 4.4 `xlsx` — Spreadsheet viewer

**MIME:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv`
**Library:** `exceljs` (preferred over sheetjs/CE for license clarity — Apache-2.0).
**Sandboxing:** renderer-only — data is parsed in-renderer and displayed via a virtualized React table.

**Behavior:**

- Parse `.xlsx` with `exceljs` into row/column model.
- Render via `@tanstack/react-virtual` for windowed scroll (the app already uses virtualization patterns).
- Sheet tabs at the bottom; switching tabs re-renders virtualized rows.
- Preserve cell formatting: number formats, dates, percentages. Bold/italic only — no full style fidelity.
- Formula values rendered as evaluated, not as formula strings.

**Export:** `pdf` (rendered grid), `html` (table markup).

**Acceptance criteria:**

- Given a workbook with 5 sheets / 50k rows total, when Preview opens, then the active sheet renders within 1 s and scrolling stays at 60 fps for the first 1k rows after parse.
- Given a CSV artifact, when opened, then it renders the same as a single-sheet xlsx.
- Given a workbook with macros, when loaded, then macros are dropped silently; an info badge "macros stripped for preview" is shown.
- Given a corrupt file, when loaded, then the "conversion failed" state shows with Download still working.

**Effort:** M (≈5 days)
**Priority:** Low

---

### 4.5 `pptx` — Presentation viewer

**MIME:** `application/vnd.openxmlformats-officedocument.presentationml.presentation`
**Library:** `pptxgenjs` for the reverse (generation/export) plus a DOCX-style approach for inbound: parse with `pptx2json` + render slides as SVG/HTML; **or** convert to PDF in the main process (via headless LibreOffice if available) and use the `browser` adapter chain.
**Sandboxing:** sandboxed iframe under `persist:rox-artifact-pptx`.

**Behavior:**

- On open, parse slide XML and render each slide as a positioned div tree (shapes + text + images).
- Slide navigator strip at the bottom (thumbnail row + arrow keys + space-to-advance).
- Speaker notes pane on the side (collapsed by default).
- Animations are flattened to final state (no transition playback).
- Fallback: if parsing fails, attempt to convert to PDF in main process and hand off to the `browser`/PDF flow.

**Export:** `pdf` (slide-per-page), `png` (active slide).

**Acceptance criteria:**

- Given a 30-slide deck, when Preview opens, then the first slide renders within 1.5 s and slide navigation is keyboard-accessible.
- Given embedded fonts not present locally, when rendering, then substitute fonts are used and a one-time toast notes the substitution.
- Given a parse failure on an exotic deck, when fallback PDF conversion is attempted, then the PDF preview renders; if both fail, the unsupported-type fallback is shown.
- Given each slide, when rendered, then aspect ratio matches the deck's slide master (no cropping).

**Effort:** L (≈8 days)
**Priority:** Low

---

### 4.6 `figma` — Figma artifact viewer

**MIME:** `application/x-figma`, `application/vnd.figma.file` (custom — Figma `.fig` is binary).
**Library:** Figma Embed Kit (web iframe) for hosted files; static PNG/SVG preview for local exports.
**Sandboxing:** `WebContentsView` under `persist:rox-artifact-figma` for embed; renderer iframe for static preview.

**Behavior:**

- Two modes determined by artifact metadata:
  1. **Embed mode**: artifact has `figmaFileKey` + signed embed URL → render `WebContentsView` loading `https://www.figma.com/embed?embed_host=rox-one&url=...`. Requires user to be signed into Figma in that partition.
  2. **Static mode**: artifact has only a PNG/SVG export → render in a renderer iframe with zoom/pan controls.
- Embed mode persists Figma session cookies inside the dedicated partition only — never the app session.
- Add a "Sign into Figma" prompt the first time embed mode is used; sign-in flow opens inside the WebContentsView.
- Block all non-figma.com navigations within the embed view.

**Export:** `png` (static export download), `pdf` (renders the visible frame).

**Acceptance criteria:**

- Given a Figma artifact with a file key, when Preview opens for a signed-in user, then the Figma canvas renders inside the embed view within 3 s.
- Given a user not signed into Figma, when embed mode opens, then a sign-in CTA is shown inside the WebContentsView (not the app shell) and the app session is untouched.
- Given a Figma artifact with only a static PNG export, when previewed, then the PNG renders with zoom/pan in a sandboxed iframe.
- Given the embed view, when figma.com posts a `postMessage` to the host, then only allowlisted message kinds (`figma:ready`, `figma:export-complete`) are accepted; everything else is dropped.

**Effort:** L (≈8 days) — depends on Figma embed terms + auth flow design
**Priority:** Low

---

## 5. Shared UI states

All adapters share these states inside `ArtifactViewerPanel`:

| State              | Trigger                                  | UX                                                   |
| ------------------ | ---------------------------------------- | ---------------------------------------------------- |
| `loading`          | adapter dynamic-import in flight         | Skeleton matching adapter's render area              |
| `unsupported`      | `registry.resolve(mime) === null`        | Existing `DesignArtifactCard` (Download + Code)      |
| `conversion-failed`| adapter `render` throws / returns error  | Error card + Retry + Download + Code                 |
| `preview-unavailable` | size > limit or feature gate disabled | "Preview unavailable" card + Download + Code         |
| `ready`            | adapter mounted                          | Adapter's React tree                                 |

---

## 6. Security checklist (cross-adapter)

- [ ] No adapter can read `window.electronAPI` — verified by integration test that inspects the global inside each sandboxed view.
- [ ] CSP for each `WebContentsView` blocks inline scripts (`script-src 'self'`), inline styles get nonces.
- [ ] Each adapter's partition is wiped on app shutdown (use `session.clearStorageData()` in `before-quit`).
- [ ] Dependency-audit gate: `mammoth`, `exceljs`, `pptxgenjs`, `pptx2json`, `markdown-it`, `dompurify` reviewed via `trufflehog`/`gitleaks` + license scan (no GPL/AGPL).
- [ ] All adapters validate input bytes against `sha256` declared in `DesignArtifact` before rendering — refuse mismatched payloads.

---

## 7. Sequencing

**Recommended initial pair: `md` + `browser`.**

Rationale:

- `md` is the fastest win (renderer-only, no native libs, no partition wiring). Validates the registry contract end-to-end with minimal risk.
- `browser` exercises the WebContentsView partition pattern that `docx`/`pptx`/`figma` will reuse — once it lands, the harder adapters inherit the sandbox foundation.
- Together they cover the two distinct adapter shapes (renderer-only vs. WebContentsView) so the registry API is stress-tested before the heavyweight adapters arrive.

Then in order: `xlsx` → `docx` → `pptx` → `figma`. Figma is last because it has the largest external-dependency surface (embed terms, auth flow) and security review cost.

---

## 8. Open questions

1. Do we ship a single npm package `@rox-one/artifact-viewer` housing all adapters, or per-adapter packages?  Recommendation: single package with adapter sub-paths (`@rox-one/artifact-viewer/md`).
2. Should `xlsx`/`docx` route through a future server-side converter for very large files?  Out of scope for v1, revisit in PZD follow-up if telemetry shows >5% conversion failures.
3. Figma embed-host registration: does ROX.ONE need an approved embed_host with Figma?  Action item before figma adapter starts.

---

## 9. Top risks

1. **Figma embed terms / auth** — the Figma adapter may require legal sign-off and an approved `embed_host` registration. This is the largest unknown and is why `figma` is last in the sequence.
2. **Document converter dependency surface** — `mammoth`, `exceljs`, `pptxgenjs`, `pptx2json` collectively add ~1-2 MB of transitive deps and broaden the supply-chain attack surface. Mitigation: lazy-load only on first use, run gitleaks/trufflehog/license-scan on each addition (per user engineering rules), pin exact versions in the lockfile.

---

## 10. Test plan

- **Unit:** `ArtifactViewerRegistry.resolve` dispatch matrix (mime → adapter); each adapter's `canRender` truth table.
- **RTL:** `ArtifactViewerPanel` states (`loading`, `unsupported`, `conversion-failed`, `ready`) per adapter.
- **Integration (Electron):** sandboxed-partition isolation tests (no `electronAPI`, no app-origin fetch) for `browser`, `docx`, `pptx`, `figma`.
- **Fixtures:** representative `.md`, `.html`, `.docx`, `.xlsx`, `.pptx`, `.fig` files under `apps/electron/test/fixtures/artifacts/`.
- **E2E:** open each viewer type via portless app URL in CI Electron runner.
- **Manual smoke:** copy/download/fullscreen/close across all six types; screenshots required for PR.

---

## 11. Acceptance summary (gate for PZD-37 closure)

- All six adapters land behind the registry with the per-adapter acceptance criteria above passing in CI.
- Security checklist (section 6) signed off by a reviewer in the `security` codeowner group.
- No `any` introduced; bundle budget ≤200 KB JS for the main renderer chunk (adapters are out-of-band).
- Documentation updated: this spec, ADR for the registry/adapter pattern, README pointer.
