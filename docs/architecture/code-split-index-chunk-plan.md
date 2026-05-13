# T132 Code-Split Plan: index chunk (4.5 MB → route-level lazy loads)

**Status:** Blueprint (not yet implemented)
**Owner:** T132 follow-up PRs
**Last updated:** 2026-05-14

---

## 1. Current Situation

The production renderer emits an `index-*.js` chunk of **~4.6 MB** (~1.36 MB gzipped),
roughly 7× the 200 KB per-route performance budget set in CLAUDE.md.

### Why the chunk is so large

The app uses a custom navigation system (`navigate()` + `NavigationContext`) rather than
React Router or a similar library with built-in code-splitting. All route-level components
are imported statically in `App.tsx` and `AppShell.tsx`, which causes Rollup to merge them
into a single chunk alongside every library they transitively depend on.

The key import chain that inflates the index chunk:

```
main.tsx
└── App.tsx                        (statically imports all screens)
    └── AppShell.tsx
        ├── MainContentPanel.tsx   → WorkbenchRoutePage  (+ SpecBuilderScreen, ReviewGateScreen)
        └── input/ComposerArtifactPanel.tsx → SpecBuilderScreen + ReviewGateScreen
```

There is already one successful precedent: `PDFPreviewOverlay` is lazy-loaded via
`React.lazy` in `App.tsx` and emits its own chunk (`PDFPreviewOverlay-*.js`, ~467 KB).

### Build output snapshot (after playground exclusion, 2026-05-14)

| Chunk | Size (min) | Gzip |
|---|---|---|
| `index-*.js` | 4,604 KB | 1,359 KB |
| `main-*.js` | 2,745 KB | 709 KB |
| `PDFPreviewOverlay-*.js` | 467 KB | 138 KB |
| `wasm-*.js` | 622 KB | 231 KB |
| `cpp-*.js` | 626 KB | 45 KB |
| `emacs-lisp-*.js` | 780 KB | 197 KB |

The `index` chunk contains the full React tree: `App`, `AppShell`, `WorkbenchRoutePage`,
`ComposerArtifactPanel`, `SpecBuilderScreen`, `ReviewGateScreen`, and all their
transitive dependencies (Tiptap editor, i18next, Jotai, Radix UI primitives, etc.).

---

## 2. Candidate Routes to Lazy-Load

### 2.1 WorkbenchRoutePage (highest priority)

**File:** `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx`
**Import site:** `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`

The Workbench is a full-page overlay rendered only when a session enters "workbench mode"
(e.g. spec-builder or review-gate flows). It is never visible on cold start.

**Estimated saving:** 300–500 KB from the index chunk (WorkbenchRoutePage itself plus its
direct deps: `SpecBuilderScreen`, `ReviewGateScreen`, `artifact-screen-state`,
`spec-builder-state`).

### 2.2 ComposerArtifactPanel (medium priority)

**File:** `apps/electron/src/renderer/components/app-shell/input/ComposerArtifactPanel.tsx`
**Import site:** `apps/electron/src/renderer/components/app-shell/AppShell.tsx`

The artifact panel slide-in that hosts `SpecBuilderScreen` and `ReviewGateScreen` inline.
It is rendered on user intent (keyboard shortcut / button click), not on startup.

**Estimated saving:** 150–250 KB (panel component + its deps, minus those already
pulled in by WorkbenchRoutePage's lazy chunk if both land in the same split).

### 2.3 Settings panel (lower priority, later PR)

**Files:** `apps/electron/src/renderer/components/settings/**`
**Import site:** `AppShell.tsx` (conditional render based on navigation state)

Settings are navigated to explicitly and never rendered on startup. Splitting them would
reduce startup parse time but savings are harder to quantify without a manifest analysis.
Defer until after 2.1 and 2.2 are done and the routing pattern is proven.

---

## 3. Implementation Pattern

### 3.1 React.lazy + Suspense

Follow the existing `PDFPreviewOverlay` precedent in `App.tsx`:

```tsx
// Before (static import — contributes to index chunk)
import { WorkbenchRoutePage } from '../workbench/WorkbenchRoutePage'

// After (lazy import — emits its own chunk)
const WorkbenchRoutePage = React.lazy(() =>
  import('../workbench/WorkbenchRoutePage').then((m) => ({ default: m.WorkbenchRoutePage }))
)
```

Wrap render sites with `<Suspense>`:

```tsx
<Suspense fallback={<WorkbenchSkeleton />}>
  <WorkbenchRoutePage screen={screen} />
</Suspense>
```

The `fallback` should be a lightweight skeleton (e.g. a bare `div` with the same
background color) — not a spinner that flashes for <100 ms loads.

### 3.2 Route-level Suspense boundaries

Each lazy component needs its own Suspense boundary placed at the call site, **not** at
the root. This is consistent with the existing `Sentry.ErrorBoundary` wrapping in
`main.tsx` — Suspense sits inside that boundary so load failures surface correctly.

```
<Sentry.ErrorBoundary>       ← root (main.tsx)
  <App>
    <AppShell>
      <Suspense fallback={<SkeletonA />}>   ← new, per-panel
        <WorkbenchRoutePage />
      </Suspense>
      <Suspense fallback={<SkeletonB />}>   ← new, per-panel
        <ComposerArtifactPanel />
      </Suspense>
    </AppShell>
  </App>
</Sentry.ErrorBoundary>
```

### 3.3 Preloading (optional, phase 2)

To avoid a waterfall on first navigation, call `import('../workbench/WorkbenchRoutePage')`
eagerly after the app shell finishes its initial render (e.g. after the first
`useEffect` in `App.tsx` completes). This primes the module cache without blocking startup.

```tsx
useEffect(() => {
  // Prefetch after hydration so the chunk is cached before the user navigates
  void import('../workbench/WorkbenchRoutePage')
  void import('../components/app-shell/input/ComposerArtifactPanel')
}, [])
```

### 3.4 Vite chunk naming

Add an explicit `output.chunkFileNames` hint so CI artifacts are readable:

```ts
// vite.config.ts — rollupOptions.output
output: {
  chunkFileNames: (chunkInfo) => {
    // Give named lazy chunks stable, human-readable names
    const name = chunkInfo.name ?? 'chunk'
    return `assets/${name}-[hash].js`
  }
}
```

---

## 4. Expected Savings per Route

These are estimates based on static analysis; actual numbers must be measured after each
PR lands by diffing `bun run scripts/report-bundle-artifacts.ts` output.

| Route | Estimated chunk size | Index reduction |
|---|---|---|
| WorkbenchRoutePage (incl. SpecBuilderScreen + ReviewGateScreen) | ~350 KB | ~350 KB |
| ComposerArtifactPanel | ~150 KB | ~100 KB (shared deps already in Workbench chunk) |
| Settings panel | ~200 KB | ~200 KB |
| **Total after all three** | — | **~650 KB off index (~14% reduction)** |

The index chunk will not drop below ~3 MB without also splitting out Tiptap editor (~600 KB)
and Shiki highlight core (~400 KB). That is a separate, higher-risk effort tracked in T140.

---

## 5. Risk / Regression Checklist

Before merging any T132 split PR, verify:

- [ ] **RTL tests pass** — `bun run test:rtl` covers `WorkbenchRoutePage` and
  `ComposerArtifactPanel` render paths; a Suspense boundary must not break snapshot tests.
- [ ] **Sentry error boundary still wraps lazy chunks** — confirm that a render error
  inside a lazy chunk is caught by `Sentry.ErrorBoundary` and shows `<CrashFallback>`.
- [ ] **HMR works in dev** — `bun run dev` (vite serve) must hot-reload lazy components
  without a full page reload.
- [ ] **No flash of empty content** — the Suspense fallback must not be visible for
  navigations that resolve in <50 ms (typical on disk; test on a throttled CPU profile).
- [ ] **Bundle policy passes** — `bun run validate:bundle-policy` must stay green.
  The policy ceiling for Electron renderer is currently 320 JS assets / 19 MB total;
  adding 2–3 new chunks stays well inside that limit.
- [ ] **Electron IPC timing unaffected** — the main process loads `index.html`; lazy
  chunk fetches are file-protocol loads from `dist/renderer/assets/`. Confirm in smoke
  test that the workbench opens within 300 ms of user action.
- [ ] **No circular imports introduced** — run `madge --circular apps/electron/src/renderer`
  before and after to detect any new cycles created by the split.
- [ ] **Preload does not regress LCP** — if eager prefetch `useEffect` is added,
  confirm via `bun run scripts/e2e-smoke.ts` that startup time does not increase.

---

## 6. Suggested PR Sequence

| PR | Scope | Prerequisite |
|---|---|---|
| T132-a | Lazy-load `WorkbenchRoutePage` in `MainContentPanel` | This blueprint PR merged |
| T132-b | Lazy-load `ComposerArtifactPanel` in `AppShell` | T132-a green |
| T132-c | Add prefetch `useEffect` for both chunks | T132-b green, perf baseline established |
| T132-d | Settings panel split | T132-c green |
| T140 | Tiptap + Shiki core splits (high-risk, separate spike) | T132-d green |
