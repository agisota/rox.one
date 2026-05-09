# F.1 Shiki Shrinkage — Migration Research

**Date:** 2026-05-10
**Status:** Research only. No implementation. No recommendation between A/B/C.
**Shiki version:** 3.23.0 (confirmed via `node_modules/shiki/package.json`)

---

## 1. Current Bundle Attribution

### Viewer (`apps/viewer`) — the only app with an existing build artefact

The viewer was built against the current codebase (commit present in dist). Numbers are
uncompressed; network-transferred sizes after gzip will be roughly 3–4× smaller.

| Segment | Size (uncompressed) |
|---|---|
| `index-*.js` (main bundle, all of shiki core + wasm engine inlined) | **5.11 MB** |
| `wasm-CG6Dc4jp.js` (onig.wasm base64-inlined) | **622 KB** |
| `wasm-MzD3tlZU.js` (secondary wasm helper) | 12 KB |
| Lang/theme chunk files (301 separate chunks) | **8.40 MB** |
| **Total viewer JS** | **13.9 MB** |

The 622 KB `wasm-CG6Dc4jp.js` chunk is confirmed to be the Oniguruma WASM blob inlined as a
base64 string (`AGFzbQ…`). It is split into its own chunk by Rollup but still eagerly loaded
because shiki's high-level entry imports it synchronously via `@shikijs/engine-oniguruma/wasm-inlined`.

The viewer has **no shiki imports in `apps/viewer/src/`**. Shiki arrives transitively through
`@rox-agent/ui` (`ShikiCodeViewer`, `CodeBlock`, `ShikiDiffViewer`). Vite already tree-splits
individual language grammars into 301 lazy chunks automatically, but the core + wasm stay in the
main bundle.

### Electron renderer and WebUI

No current build artefacts exist for either app on this machine. The bundle-policy validator
(`scripts/validate-bundle-policy.ts`) documents the enforced limits:

| App | Max total JS | Max single chunk |
|---|---|---|
| Electron renderer | 19 MB | 5.8 MB |
| WebUI | 18 MB | 5.8 MB |
| Viewer | 15.3 MB | 5.7 MB |

Given that the viewer's main bundle is already at 5.11 MB with shiki core + wasm, and both the
electron renderer and webui share the same `@rox-agent/ui` components, all three apps carry a
comparable main-bundle cost from shiki. The wasm chunk alone (622 KB uncompressed, ~180 KB
gzipped) accounts for roughly 10–12% of a compressed main bundle.

### Approximation from `node_modules`

| Package | Disk size |
|---|---|
| `node_modules/shiki/` | 3.9 MB |
| `node_modules/@shikijs/` (all sub-packages) | 13 MB |
| `@shikijs/langs/dist/` (all grammars) | 9.9 MB |
| `@shikijs/themes/dist/` | 1.8 MB |
| `@shikijs/engine-oniguruma/dist/*.mjs` | 638 KB |
| `@shikijs/engine-javascript/dist/*.mjs` | **2.6 KB** |
| `node_modules/shiki/dist/onig.wasm` | 456 KB (raw binary; 622 KB when base64-wrapped in JS) |

---

## 2. Shiki API Surface

Shiki 3.23.0 exposes the following named entry points (from `package.json` `exports`):

| Export | Resolves to | What it includes |
|---|---|---|
| `'shiki'` (default, `.`) | `dist/index.mjs` | Re-exports everything from `@shikijs/core`, plus eagerly imports `@shikijs/engine-oniguruma/wasm-inlined`, `@shikijs/engine-javascript`, and `@shikijs/vscode-textmate`. **Pulls all languages and themes when Rollup follows the `bundledLanguages`/`bundledThemes` side-effects.** |
| `'shiki/core'` | `dist/core.mjs` | Engine-only surface: `createHighlighter`, `createHighlighterCore`, `codeToHtml`, `codeToTokens`, etc. No languages, no themes, no wasm. 4 KB stub that re-exports from `@shikijs/core`. |
| `'shiki/langs/<lang>'` | `dist/langs/<lang>.mjs` | Tiny 44–52 byte re-export stub pointing to `@shikijs/langs/<lang>`. Actual grammar data lives in `@shikijs/langs/dist/<lang>.mjs`. |
| `'shiki/themes/<theme>'` | `dist/themes/<theme>.mjs` | 54-byte re-export stub pointing to `@shikijs/themes/<theme>`. |
| `'shiki/wasm'` | `dist/wasm.mjs` | Re-exports `@shikijs/engine-oniguruma/wasm-inlined` — the 622 KB base64 blob. |
| `'shiki/engine/javascript'` | `dist/engine-javascript.mjs` | Re-exports `@shikijs/engine-javascript` — the JS-regex engine, **2.6 KB total**. No WASM dependency. |
| `'shiki/engine/oniguruma'` | `dist/engine-oniguruma.mjs` | The WASM engine. Requires the `.wasm` binary. |
| `'shiki/bundle/full'` | `dist/bundle-full.mjs` | All langs + all themes + oniguruma. Equivalent to the current `import { codeToHtml } from 'shiki'` path. |
| `'shiki/bundle/web'` | `dist/bundle-web.mjs` | Web-optimised subset: JS-regex engine + subset of langs. |

**Key finding:** The high-level `'shiki'` entry is confirmed to be a catch-all bundle. Any import
from it — even just `bundledLanguages` (a plain object) — causes Rollup/Vite to include
`@shikijs/engine-oniguruma/wasm-inlined` as a side-effect because `index.mjs` has top-level
`import` statements for all three engines. This was the root cause of PR #6's no-op.

The migration path to meaningful savings requires switching the call sites to `'shiki/core'` and
supplying explicit engine + language + theme references.

---

## 3. Required Surface Area

### Call sites (with file refs)

| File | Import | Usage |
|---|---|---|
| `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx:6` | `bundledLanguages` from `'shiki'` | `Object.keys(bundledLanguages)` to build the dropdown option list. No highlighting here — TipTap's own extension (`tiptap-extension-code-block-shiki`) handles highlighting. |
| `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx:13` | `codeToHtml`, `bundledLanguages`, `BundledLanguage` from `'shiki'` | `codeToHtml()` for rendering; `bundledLanguages` for `isValidLanguage()` runtime check. |
| `packages/ui/src/components/markdown/CodeBlock.tsx:2` | `codeToHtml`, `bundledLanguages`, `BundledLanguage` from `'shiki'` | Same pattern as ShikiCodeViewer; also has a 200-entry LRU cache keyed on `${theme}:${lang}:${code}`. |

`tiptap-extension-code-block-shiki` (v1.2.0) declares `shiki: ^3.0.0 || ^4.0.0` as a peer dep.
Its internal use of shiki is separate and must be audited separately if migrating the TipTap path.

### Languages

**PRELOADED_LANGUAGES in `CodeBlock.tsx:24-28`** (22 entries):
`javascript`, `typescript`, `python`, `json`, `bash`, `shell`, `markdown`, `html`, `css`,
`sql`, `yaml`, `go`, `rust`, `java`, `c`, `cpp`, `tsx`, `jsx`, `swift`, `kotlin`, `ruby`, `php`.

Note: `shell` is a valid shiki lang (aliased to `shellscript`; `dist/shell.mjs` exists).

**Grammar sizes for the 22 preloaded languages** (from `@shikijs/langs/dist/`):

| Lang | Size |
|---|---|
| cpp | 429 KB |
| typescript | 191 KB |
| jsx | 188 KB |
| tsx | 186 KB |
| javascript | 185 KB |
| php | 118 KB |
| swift | 94 KB |
| c | 78 KB |
| python | 77 KB |
| markdown | 65 KB |
| html | 62 KB |
| css | 52 KB |
| go | 52 KB |
| ruby | 51 KB |
| java | 30 KB |
| sql | 24 KB |
| rust | 17 KB |
| yaml | 12 KB |
| kotlin | 10 KB |
| json | 3.2 KB |
| bash/shell | ~77 bytes (alias stub) |
| **22-lang total** | **~1.88 MB** |
| **All langs total** | **~7.8 MB** |

Selecting only the 22 preloaded languages would cut grammar payload from ~7.8 MB to ~1.88 MB
(~76% reduction in grammar data). After Rollup tree-shaking and gzip, the real-world saving in
the main chunk would be smaller because many non-preloaded grammars are already split into lazy
chunks by Vite.

**Languages exposed to user via TiptapCodeBlockView dropdown:**
`Object.keys(bundledLanguages)` filtered by `EXCLUDED_LANGUAGES` (`mermaid`, `latex`, `math`,
`tex`, `katex`). With 346 individual `.mjs` files in `@shikijs/langs/dist/`, the dropdown
shows approximately 200+ languages. The 12 `PRIORITY_LANGUAGES` appear first; the rest sort
alphabetically. Whether the full list is a genuine UX requirement or a convention inherited from
"include everything by default" is not documented in the file history (the working copy has only
three version-bump commits: v0.6.0, v0.7.0, v0.8.5 — no commit message elaborates on the design
decision).

### Themes

**Themes pickable by the user** — derived from 15 preset JSON files in
`apps/electron/resources/themes/`:

| Preset | Light shiki theme | Dark shiki theme |
|---|---|---|
| default / github | `github-light` (12.5 KB) | `github-dark` (12.7 KB) |
| catppuccin | `catppuccin-latte` (52 KB) | `catppuccin-mocha` (52 KB) |
| dracula | `github-light` | `dracula` (23 KB) |
| ghostty | `github-light` | `vitesse-dark` (15 KB) |
| gruvbox | `github-light` | `vitesse-dark` |
| haze | — | `github-dark` |
| night-owl | `github-light` | `night-owl` (32 KB) |
| nord | `github-light` | `nord` (30 KB) |
| one-dark-pro | `one-light` (28 KB) | `one-dark-pro` (37 KB) |
| pierre | `github-light` | `github-dark` |
| rose-pine | `rose-pine-dawn` (24 KB) | `rose-pine` (24 KB) |
| solarized | `solarized-light` (7.3 KB) | `solarized-dark` (7.7 KB) |
| tokyo-night | `github-light` | `tokyo-night` (39 KB) |
| vitesse | `vitesse-light` (15 KB) | `vitesse-dark` |

**Distinct themes in use:** `github-light`, `github-dark`, `catppuccin-latte`, `catppuccin-mocha`,
`dracula`, `vitesse-dark`, `vitesse-light`, `night-owl`, `nord`, `one-dark-pro`, `one-light`,
`rose-pine`, `rose-pine-dawn`, `solarized-light`, `solarized-dark`, `tokyo-night` — **16 themes**.
`github-light` / `github-dark` are the default fallback (set by `DEFAULT_SHIKI_THEME` in
`packages/shared/src/config/theme.ts:303-305`).

`ShikiThemeContext` is a thin pass-through provider; it does not eagerly load themes. The theme
name is just a string; the actual theme data is fetched by shiki when `codeToHtml` is called.

---

## 4. Three Migration Options

### Option A — Preloaded subset only (smallest main-bundle, dropdown shrinks)

**What it does:**
Replace all three `import { codeToHtml, bundledLanguages } from 'shiki'` call sites with:

```ts
import { createHighlighter } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
// or: import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import langJS from 'shiki/langs/javascript'
import langTS from 'shiki/langs/typescript'
// … 20 more explicit imports …
```

Build one shared singleton `highlighter` (or use `getSingletonHighlighter` from `@shikijs/core`)
preloaded with the 22 languages and 16 themes. Replace `bundledLanguages` usages with a
hand-maintained `SUPPORTED_LANGUAGES` constant. The dropdown in TiptapCodeBlockView shrinks from
200+ to 22 entries.

**Estimated bundle savings (uncompressed):**
- Wasm chunk eliminated: −622 KB (if JS engine chosen) or kept (if oniguruma kept)
- Grammar data: −~5.9 MB lazy chunks (all non-preloaded langs removed from build)
- Themes: only the 16 in-use theme files bundled; currently all ~130 are included
- Rough net main-bundle reduction: **−600 KB to −1.2 MB** (wasm + unused eager grammar stubs);
  total asset reduction: **−5 to −7 MB** across the full dist (lazy lang chunks eliminated)

**Runtime cost:**
- No async loading after page load. All highlighting is synchronous once the highlighter singleton
  is initialised (which is itself async, done once at startup).
- JS regex engine (2.6 KB) starts faster than WASM initialisation (which requires fetching +
  compiling the 456 KB wasm binary). JS engine has slightly lower correctness on edge-case grammars
  (e.g., some Ruby lookbehind patterns); shiki documents this as an acceptable tradeoff for web use.

**UX impact:**
- TipTap language picker collapses from ~200 languages to 22. Users typing e.g. `Zig`, `Elixir`,
  `Haskell` in the search box get "No languages found."
- Read-only code viewers (`ShikiCodeViewer`, `CodeBlock`) silently fall back to `'text'` for any
  language not in the preloaded set.

**Implementation effort:**
- ~4 files changed: `CodeBlock.tsx`, `ShikiCodeViewer.tsx`, `TiptapCodeBlockView.tsx`, plus a new
  shared `shiki-singleton.ts` module.
- `LANGUAGE_NAMES` constant (22 entries) replaces `Object.keys(bundledLanguages)`.
- LOC delta: ~+80 / −15 across those files.
- Must also audit `tiptap-extension-code-block-shiki` to confirm it accepts a pre-built highlighter
  or also calls `createHighlighter` internally (if the latter, the extension still drags in its own
  shiki instance).

---

### Option B — Preloaded core + lazy-load on demand (medium bundle, full dropdown preserved)

**What it does:**
Same core migration as Option A, but the dropdown retains the full language name list via a
static `LANGUAGE_DISPLAY_NAMES` constant (an array of strings, zero shiki dependency).
When the user picks a non-preloaded language, the app:

```ts
// On language select:
const mod = await import(`shiki/langs/${lang}.mjs`) // Vite splits this into lazy chunk
await highlighter.loadLanguage(mod.default)
await highlighter.loadTheme(activeTheme) // if not yet loaded
```

Then re-renders the highlighted block.

**Estimated bundle savings:**
- Main bundle: same as Option A (−600 KB to −1.2 MB for wasm/core savings).
- Lazy lang chunks: remain on disk (304 chunks for viewer, similar for electron/webui). Network
  cost deferred until user picks that language — but the chunks are still shipped in the asar /
  served from CDN.
- Effective initial-load saving: same as A for first paint; no disk-space saving vs. current.

**Runtime cost:**
- First highlight of a non-preloaded language incurs one dynamic `import()` + `loadLanguage()`
  round-trip. In the web app this is a network request (~20–800 KB depending on grammar).
  In Electron the chunk is in the asar so it's a fast filesystem read.
- The LRU cache in `CodeBlock.tsx` must handle the "language not yet loaded" state; current code
  falls back to `'text'` on error, which is safe but silent.

**UX impact:**
- Dropdown shows full 200+ language list. Users can pick any language.
- On first pick of a non-preloaded language, there is a brief rendering delay (~50–300 ms on fast
  connections, longer on slow). A loading state or spinner is needed.
- Subsequent picks of the same language are instant (cached in the highlighter instance).

**Implementation effort:**
- ~5–6 files changed: same as A plus a `LANGUAGE_DISPLAY_NAMES` constant file and a
  `useLanguageLoader` hook to manage async state.
- The TipTap NodeView adds complexity: language selection triggers `updateAttributes`, which
  re-renders the NodeView — the async load must complete before re-render or show a skeleton.
  TipTap re-renders NodeViews on every keystroke in the surrounding doc; the language-loading
  state must be ref-guarded to avoid re-triggering mid-type.
- LOC delta: ~+120 / −15 across those files.

---

### Option C — Engine swap only, keep high-level API (lowest effort, medium savings)

**What it does:**
Keep `import { codeToHtml } from 'shiki'` unchanged at call sites. Add a one-time initialiser
that overrides the default engine:

```ts
import { createHighlighter } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// One-time at app startup (e.g., in main.tsx or a top-level module):
// Unfortunately codeToHtml() from 'shiki' high-level uses its own internal
// singleton — the engine cannot be swapped post-hoc on the high-level API.
```

**Correction:** The high-level `codeToHtml` from `'shiki'` uses an internal cached highlighter
that is initialised with the oniguruma engine. There is no public API to inject a different engine
into the high-level entry. The `createJavaScriptRegexEngine` option is only available when using
`shiki/core` + `createHighlighter({ engine })`. Therefore Option C as stated requires migrating to
`shiki/core` at the call site — it is not a zero-code-change option.

**What it actually does (corrected scope):**
Migrate only the `createHighlighter` / engine instantiation, while retaining the full
`bundledLanguages` and `bundledThemes` imports for language/theme validation and the dropdown.
Example:

```ts
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { bundledLanguages, bundledThemes } from 'shiki' // still imported for metadata

const highlighter = await createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: Object.values(bundledLanguages), // still loads all grammars
  themes: Object.values(bundledThemes),   // still loads all themes
})
```

This removes the 622 KB wasm chunk but still pulls all grammars and themes.

**Estimated bundle savings:**
- Wasm chunk eliminated: **−622 KB uncompressed** (~−180 KB gzipped).
- Grammar/theme data: **unchanged** (still all langs + all themes).
- Net saving: wasm only.

**Runtime cost:**
- JS regex engine initialises synchronously and much faster than wasm compilation.
- Correctness risk: the JS engine uses JavaScript `RegExp` instead of Oniguruma. For the 22
  common languages this is well-tested by the shiki project. For exotic grammars (e.g., `cpp`
  uses complex lookbehind/lookahead) there may be edge-case mismatch. Shiki documents JS engine
  as "experimental" for some grammars.
- No async language loading. All grammars are still eagerly bundled.

**UX impact:** None. Full language picker, all themes, no visual change.

**Implementation effort:**
- ~3 files changed (the three call sites), plus shared singleton refactor.
- Must remove `import { codeToHtml } from 'shiki'` and replace with `createHighlighterCore` usage,
  but language/theme metadata imports can stay.
- LOC delta: ~+40 / −10.

---

## 5. Risks Specific to This Codebase

### TipTap NodeView re-renders during typing (Option B risk)
`TiptapCodeBlockView` is a `ReactNodeViewRenderer`. ProseMirror calls `update()` on it for every
transaction that touches the node — including adjacent keystrokes. If `loadLanguage()` is
triggered on the first render and the node re-renders mid-load, a second `loadLanguage()` call
could fire concurrently. The highlighter deduplicates internally, but the React state (`isLoading`
boolean) needs a ref guard (`useRef`) to avoid double-loading. The existing `cancelled` flag
pattern in `CodeBlock.tsx` shows the team is aware of this stale-closure hazard; the same pattern
must be applied in the language-loading path.

### LRU cache in `CodeBlock.tsx` (Options A and B)
The cache key is `${theme}:${lang}:${code}`. Under Option B, if a language is not yet loaded,
`codeToHtml` will throw or produce plain text. The current error handler sets `highlighted = null`
(falls back to plain text) and does not retry. A language-loading path must either:
(a) not attempt `codeToHtml` until the language is confirmed loaded, or
(b) store a sentinel value in the cache to trigger re-render once loading completes.
Neither is currently handled. Option A avoids this entirely.

### `ShikiThemeProvider` eager loading
`ShikiThemeProvider` passes a string (`shikiTheme`) not a pre-fetched theme object. The actual
theme data is loaded lazily by shiki when `codeToHtml` is first called with that theme name. Under
`shiki/core` + `createHighlighter`, themes must be explicitly passed at highlighter creation time.
If the user switches to a theme whose shiki name was not in the initial `loadTheme()` list,
`codeToHtml` will throw. The fix is to call `highlighter.loadTheme(theme)` on theme switch. The
`ThemeContext` already provides `shikiTheme` reactively so this is hookable.

### Electron asar and dynamic imports (Option B)
The electron vite config has no custom `manualChunks` or `assetsInlineLimit` for shiki. Vite's
default code-splitting will output lang chunks as separate `.js` files in `dist/renderer/assets/`.
These will be packaged into the asar by `electron-builder`. Dynamic `import()` calls in the
renderer resolve to `app://./assets/<chunk>.js` which the Electron renderer handles correctly via
the default `app://` protocol. **No special Vite config is required for Option B in Electron.**
The viewer dist (304 JS chunks currently) confirms this pattern already works.

For the web app (webui), dynamic lang chunks are fetched over HTTP from the same origin. This
works without additional configuration. The risk is latency on slow connections for first-use of a
non-preloaded language.

### `tiptap-extension-code-block-shiki` internal shiki usage
This extension (v1.2.0) lists `shiki: ^3.0.0 || ^4.0.0` as a peer dep and internally creates
its own highlighter. If the extension calls `createHighlighter()` from the high-level `'shiki'`
entry, it will re-introduce the full bundle even after migrating the three call sites. This must be
verified by inspecting the extension's compiled output before committing to Options A or B. If the
extension cannot accept an externally-created highlighter, a fork or custom extension may be needed.

---

## 6. Verification Plan

Applies regardless of which option is chosen. Run these steps after implementation.

**1. Bundle size delta**
```bash
# Before: record current sizes (or use viewer dist as proxy)
ls -la apps/viewer/dist/assets/index-*.js
ls -la apps/electron/dist/renderer/assets/

# Build
~/.bun/bin/bun run electron:build:renderer
~/.bun/bin/bun run webui:build
~/.bun/bin/bun run viewer:build

# After: compare
ls -la apps/electron/dist/renderer/assets/ | sort -k5 -rn | head -10
~/.bun/bin/bun run validate:bundle-policy  # must pass all three policies
```

**2. Functional smoke — highlighting**
- Render each of the 22 PRELOADED_LANGUAGES at least once (CodeBlock + ShikiCodeViewer).
- Option B only: select a non-preloaded language (e.g., `elixir`) from the TipTap dropdown;
  confirm loading state appears and highlighting completes.
- Switch between at least 3 themes via the theme picker; confirm code re-highlights.
- Confirm `InlineCode` is unaffected (it has no shiki dependency).

**3. Audit harness**
```bash
bash scripts/audit-smoke.sh  # must exit 0
```

**4. TipTap typing latency (Option B only)**
Open a document with a non-preloaded language code block. Type continuously for 5 seconds.
Confirm no UI jank or repeated "loading" flickers during typing (after first load completes).
Measure with Chrome DevTools Performance tab; typing frame time must remain ≤ 16 ms.

**5. Electron offline mode**
Disconnect network. Open Electron app. Open a document with code blocks. Confirm all preloaded
languages highlight. Option B: confirm non-preloaded language falls back gracefully (plain text or
error message, not a crash).

---

## 7. Recommended Next Step — Process Only

The maintainer should run a short synchronous brainstorm with the following decision questions.
Answering these will collapse the option space to one viable path.

1. **Is the full 200+ language picker a genuine UX requirement?**
   If the answer is "we have users who regularly pick Elixir / Zig / COBOL", Option A is off the
   table. If the answer is "we don't know" or "probably not", measure it: add analytics on
   language picker selections for two weeks before deciding.

2. **What is the acceptable first-paint latency budget for code highlighting?**
   Option B adds an async round-trip on first use of a non-preloaded language. Is 100–300 ms
   acceptable? Is a loading spinner acceptable in the TipTap editor (a writing surface)?

3. **Is the wasm-only saving (−180 KB gzipped, Option C) worth the migration cost?**
   If bundle size is the primary concern, Option A/B save 5–7× more than Option C. Option C is
   a lower-risk stepping stone but not the end state.

4. **What is the correctness risk tolerance for the JS regex engine?**
   The JS engine is well-tested for common languages but documented as experimental for complex
   grammars. If `cpp` or `typescript` highlighting produces incorrect output, is that acceptable?
   Run the highlighting smoke test on a non-trivial C++ file before deciding.

5. **Can the `tiptap-extension-code-block-shiki` accept an external highlighter?**
   This is a blocking technical question for Options A and B. If the answer is no, the migration
   scope expands to include either forking the extension or replacing it with a custom TipTap
   extension that uses the shared singleton. This should be investigated before estimating effort.

---

*Research by: automated exploration of node_modules, dist artefacts, and source files.*
*No source files were modified. No PR opened.*
