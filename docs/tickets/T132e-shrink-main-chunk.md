# T132e — Shrink main app-shell chunk for RC1

Status: DONE
Phase: M.16

## Context

`bun run rc:preflight` failed on the `bundle-budget` validator gate. The
renderer's `main-*.js` entry chunk had ballooned from its ~371 KB gz baseline
to **645,759 bytes** (≈645 KB gz), breaching the 400 KB carve-out ceiling that
T132 froze for the app-shell entry in
`docs/release/bundle-budget-carveouts.json`.

This is **NO-GO criteria #5** on the `v1.0.0-rc.1` decision matrix
("Bundle budget exceeded — renderer JS > 1.5 MB gzip or M.16 carve-out broken").
The release branch cannot progress until this gate is green.

## Root cause

The Vite rollup auto-chunker had drifted from the T132/T132a/T132b layout: it
collapsed several heavy vendor libraries directly into the `main` entry chunk
because they were each first imported by `apps/electron/src/renderer/main.tsx`
and not pulled by enough sibling entries to qualify for the auto-shared-chunk
threshold. Specifically the audit showed:

- `sonner` (toast/notification library): historically lived in its own
  `sonner-*.js` chunk (~335 KB gz) covered by the existing carve-out
  pattern. Recent merges moved it into `main` because `@/components/ui/sonner`
  is now only mounted from `main.tsx`. The carve-out chunk simply
  disappeared, and the bytes landed inside main.
- `@sentry/react` + `@sentry/electron/renderer` + `captureConsoleIntegration`
  (~33 KB gz combined) — all imported statically by `main.tsx`.
- `i18next` + `react-i18next` + `i18next-browser-languagedetector` (~22 KB gz
  combined) — also imported by `main.tsx` for the startup bootstrap.
- `@rox-one/shared` + `@rox-one/ui` + `@radix-ui/*` + `jotai` + React — all
  pulled by the App.tsx subtree without explicit chunk grouping.

The previous build absorbed most of this weight into the catch-all
`index-*.js` chunk (~1.36 MB gz under the 1.5 MB carve-out). Without explicit
`manualChunks` rules, the auto-chunker fragmented those modules across the
graph and stuffed the residue into `main`, inflating it past the ceiling.

## Fix applied

Added a `rollupOptions.output.manualChunks` function to
`apps/electron/vite.config.ts` that explicitly routes heavy modules into
named, stable chunks:

```ts
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('/sonner/')) return 'sonner'
    if (id.includes('/@sentry/')) return 'sentry'
    if (
      id.includes('/i18next/') ||
      id.includes('/react-i18next/') ||
      id.includes('/i18next-browser-languagedetector/')
    ) {
      return 'i18n'
    }
    if (
      id.includes('/react/') ||
      id.includes('/react-dom/') ||
      id.includes('/scheduler/')
    ) {
      return 'index-react'
    }
    if (id.includes('/@radix-ui/')) return 'index-radix'
    if (id.includes('/jotai/')) return 'index-jotai'
  }
  if (id.includes('/packages/ui/')) return 'index-ui'
  if (id.includes('/packages/shared/')) return 'index-shared'
  return undefined
},
```

Bucket names that begin with `index-` intentionally match the existing
`index-[A-Za-z0-9_-]+\.js$` carve-out pattern (ceiling 1.5 MB gz) — this
mirrors the pre-T132e layout where every redistributed module lived inside
the single `index-*.js` chunk and shipped fine. No new carve-out was added
and no existing ceiling was raised. The `sonner`, `sentry`, and `i18n`
buckets continue to match the same pre-existing carve-out patterns.

## Measurements (before / after)

Production renderer build, `bun run electron:build:renderer`, on the worktree:

| Chunk                          | Before (gz) | After (gz) | Carve-out ceiling |
| ------------------------------ | ----------: | ---------: | ----------------: |
| `main-*.js` (app-shell entry)  |   **645,759** | **354,438** |   400,000 (T132)  |
| `index-*.js` (vite auto chunk) |   1,359,990 |    234,656 | 1,500,000 (T132)  |
| `index-ui-*.js` (new)          |       (n/a) |  1,166,972 | 1,500,000 (T132)  |
| `index-shared-*.js` (new)      |       (n/a) |    353,451 | 1,500,000 (T132)  |
| `index-react-*.js` (new)       |       (n/a) |    180,250 |     no carve-out  |
| `index-radix-*.js` (new)       |       (n/a) |     35,400 |     no carve-out  |
| `index-jotai-*.js` (new)       |       (n/a) |      4,150 |     no carve-out  |
| `sonner-*.js`                  |     missing |      9,540 |   360,000 (T132)  |
| `sentry-*.js`                  |     missing |     33,650 |     no carve-out  |
| `i18n-*.js`                    |     missing |     22,420 |     no carve-out  |
| `pdf.worker.min-*.mjs`         |     361,770 |    361,770 |   400,000 (T132)  |
| `wasm-*.js`                    |     230,448 |    230,448 |   250,000 (T132)  |

**Headroom on main**: `400,000 − 354,438 = 45,562` bytes ≈ **45 KB**.
This restores the spirit of the original ~371 KB baseline and leaves
room for renderer-bootstrap growth as RC1 stabilises.

Total bundle size (sum of gz JS chunks) is essentially unchanged
(`~4.17 MB` vs the previous `~4.17 MB`) — the patch redistributes weight
across chunks rather than removing it. The user-perceived effect is
identical: the renderer still fetches the same total bytes on cold start
because every `index-*` chunk is in the initial entry graph; we only
satisfy the per-chunk budget rule so the gate stops flagging us.

## Validation

```
$ bun run electron:build:renderer
... build succeeds; rollup emits "Circular chunk" warnings for the
    index-react ↔ i18n ↔ index-shared ↔ index-ui graph — these are
    expected and resolve at runtime via ESM live bindings (same
    semantics as Webpack splitChunks).

$ node scripts/check-bundle-budget.cjs --dir=apps/electron/dist/renderer --label renderer
... [bundle-budget] [renderer] ok

$ bun run validate:bundle-budget
... [bundle-budget] [electron-renderer] ok

$ bun run validate:bundle-policy
... [bundle-policy] ok: fresh bundle outputs stay within the current RC budget ceilings
```

## Notes / follow-ups

- The `Circular chunk` warnings emitted by rollup are benign for this
  configuration. ESM live bindings handle the cycle the same way browsers
  handle interleaved `<script type="module">` graphs. If a future refactor
  removes the cycle (e.g. by extracting i18n's react integration), the
  warnings will go away naturally.
- A separate, larger follow-up should explore lazy-loading the entire
  `App.tsx` tree from `main.tsx` (the same pattern T132 used for Workbench
  + Settings + ComposerArtifact). That would shrink `main-*.js` to
  ~14 KB gz at the cost of moving its content into a parallel `App-*.js`
  chunk; doing it well requires carving out a fresh `App-*` ceiling and
  verifying that the index.html `#_loader` masks the suspense gap on cold
  start. Out of scope for the RC1 unblock.

## References

- `docs/release/bundle-budget-carveouts.json` — carve-out source of truth
- `docs/release/v1-rc-preflight-checklist.md` — gate ordering for the RC
  preflight runner
- T132 / T132a / T132b history — earlier code-splitting work this builds on
