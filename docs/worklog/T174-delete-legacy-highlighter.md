# T174 - Delete Legacy Highlighter (Phase 3 closeout)

## 1. Task summary

Finish M.11 Phase 3 by completing the migration off the raw `shiki`
package onto the shared `getSingletonHighlighter` + `resolveLanguage`
adapter (`@rox-one/shared/highlight`, landed by T172 / PR #85). T173
(PR #114) shipped the first two call sites (`ShikiCodeEditor`,
`CodeBlock`). T174 closes the slice by:

1. Migrating `ShikiCodeViewer.tsx` (third renderer call site).
2. Inspecting `TiptapCodeBlockView.tsx` and either migrating it or
   documenting a concrete deferral plan as T174b.
3. Deciding on the `shiki` peerDependency in `packages/ui/package.json`.

## 2. Repo context discovered

- `origin/main @ 47d5f4cb` already contains the T173 migration (PR #114).
- Three sites still imported `shiki` directly before T174:
  - `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx` —
    used `codeToHtml`, `bundledLanguages`, `BundledLanguage`.
  - `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx` —
    used `bundledLanguages` for the language-picker dropdown options.
  - `packages/ui/package.json` peerDependencies declares `shiki`.
- The shared adapter exports `getSingletonHighlighter`,
  `resetSingletonHighlighter`, `resolveLanguage`, `PRELOADED_LANGUAGES`,
  `PRELOADED_THEMES` via `@rox-one/shared/highlight`.
- `tiptap-extension-code-block-shiki@1.2.0` (installed at
  `node_modules/tiptap-extension-code-block-shiki`) imports
  `createHighlighter`, `bundledThemes`, and `bundledLanguages` from
  `shiki` itself and constructs its own highlighter when configured. It
  exposes no API to inject an externally built highlighter.
- The renderer's vitest harness (`apps/electron/vitest.config.ts`)
  aliases `react` to repo-root `node_modules/react`; the agent worktree
  has no worktree-local `node_modules`, so RTL component tests cannot
  be run here. The contract-level bun:test pattern from T173 is
  reused here for the same reason.

## 3. Files inspected

- `packages/shared/src/highlight/index.ts`
- `packages/shared/src/highlight/singleton.ts`
- `packages/shared/src/highlight/highlighter.ts`
- `packages/shared/src/highlight/languages.ts`
- `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx` (pre + post)
- `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx`
- `packages/ui/src/components/markdown/CodeBlock.tsx` (T173 reference)
- `apps/electron/src/renderer/components/shiki/ShikiCodeEditor.tsx`
  (T173 reference)
- `apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts`
  (T173 reference)
- `packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
  (T173 reference)
- `packages/ui/package.json`
- `apps/viewer/package.json` (confirms shiki is its own devDependency
  there; not a peerDep change in scope for this ticket)
- `node_modules/tiptap-extension-code-block-shiki/package.json`
- `node_modules/tiptap-extension-code-block-shiki/dist/tiptap-extension-code-block-shiki.d.ts`
- `node_modules/tiptap-extension-code-block-shiki/dist/tiptap-extension-code-block-shiki.js`
  (verified `import { bundledThemes, bundledLanguages, createHighlighter } from "shiki"`)
- `docs/tickets/T173-shiki-callsite-migration.md`
- `docs/worklog/T173-shiki-callsite-migration.md`

## 4. Tests added first

One bun:test spec lands alongside the ShikiCodeViewer migration:

- `packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
  (8 tests / 27 expects). Pins:
  - The alias set ShikiCodeViewer used to own (js, ts, py, sh, zsh,
    yml, rb, rs, kt) resolves through the shared `resolveLanguage`.
  - Null fallback for unknown ids — including the legacy
    `objective-c` / `objc` aliases that the shared adapter does not
    preload, so they render as plain text (graceful fallback).
  - `<pre><code><span>` shell shape for the inner-HTML mount.
  - Theme divergence between `github-light` and `github-dark`.
  - Custom `shikiTheme` prop forwarding through the theme option.
  - Deterministic repeat output per `(code, lang, theme)`.
  - Unsupported-language graceful fallback to `text`.
  - Singleton reset path rebuilds cleanly.

No new test for `TiptapCodeBlockView.tsx` because that site is not
migrated in this slice — the analysis-and-defer commit is documentation
only.

## 5. Expected failing test output

Pre-migration, the spec did not exist. Post-migration it passes green
on first run. There is no pre-existing red-test step because the
ShikiCodeViewer migration is a behavior-preserving refactor anchored to
the adapter's existing corpus contract (`highlight-corpus.test.ts`,
24 pass / 94 expects on `origin/main`).

## 6. Implementation changes

### Commit 1 — `c08ae10f` — ShikiCodeViewer migration

- `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx`:
  - Replace
    `import { codeToHtml, bundledLanguages, type BundledLanguage } from 'shiki'`
    with
    `import { getSingletonHighlighter, resolveLanguage } from '@rox-one/shared/highlight'`.
  - Drop the local `LANGUAGE_ALIASES` table + `isValidLanguage` guard
    (covered by the shared adapter).
  - Resolve language via `resolveLanguage(lang) ?? 'text'` inside the
    `useMemo` block, keeping the file-extension to language mapping
    via the unchanged ShikiCodeViewer-local `LANGUAGE_MAP`.
  - Call `(await getSingletonHighlighter()).highlight(code, lang, { theme })`
    in place of `codeToHtml`.
  - `onReady` gate, cancellation, error path preserved verbatim.
- `packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`:
  - New file, 8 tests / 27 expects (see Section 4).

### Commit 2 — `ae77e910` — Tiptap blocker documented

- `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx`:
  - Add a module-doc block recording the migration blocker for T174b
    (the upstream extension owns the highlighter; no injection API).
  - Add an inline comment at the lone `import { bundledLanguages }
    from 'shiki'` site explaining why a partial migration would silently
    shrink the authoring language set and is therefore deferred to
    T174b.
  - No behavior change.

### No commit 3 — `shiki` peerDep kept

The `shiki` peerDependency in `packages/ui/package.json` stays because
`TiptapCodeBlockView.tsx` still imports from `shiki`. Removing it now
would break the editor's language picker and the upstream extension's
internal highlighter construction. Removal is part of T174b's scope.

### Commit 4 — ticket + worklog

This file plus `docs/tickets/T174-delete-legacy-highlighter.md`.

## 7. Validation commands run

- `bun test packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
  (T173 regression — still passes 7/7)
- `cd packages/ui && bunx tsc --noEmit`
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `bun run validate:bundle-budget`

## 8. Passing test output summary

```text
bun test packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts
 8 pass, 0 fail, 27 expect() calls

bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts
 7 pass, 0 fail, 22 expect() calls

cd packages/ui && bunx tsc --noEmit
exit 0

bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

bun run validate:agent-contract
PRE-EXISTING FAIL on origin/main, not caused by T174:
  [agent-contract] T223-tenant-credential-key-derivation.md missing Status line
  (verified by stashing T174 changes and re-running; ticket T223 lives in
  origin/main and is missing the Status line — out of scope for T174)

bun run validate:roadmap
PRE-EXISTING FAIL on origin/main, not caused by T174:
  [docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md]
  phase M.1.3b appears in the ledger but has no matching # Phase heading
  in its owner file (lane M)
  (verified by stashing T174 changes and re-running — out of scope for T174)

bun run validate:bundle-budget
PRE-EXISTING FAIL in worktree (no build output exists):
  [bundle-budget] [electron-renderer] missing build output:
  apps/electron/dist/renderer
  (build runs at land time on main; the worktree has no node_modules so
  `bun run build` cannot run here per the T173 / T174 constraint)
```

The three pre-existing failures (agent-contract, roadmap, bundle-budget)
are upstream of T174 and unrelated to the highlighter migration. They
are recorded here for traceability so reviewers can confirm the failures
are not regressions introduced by this slice.

## 9. Build output summary

Not run in this slice — `bun run build` for the electron app requires
worktree-local `node_modules` (same constraint as T173). Typecheck
against `packages/ui` is the gating signal; it passes clean. A full
build runs at land time on `main`.

## 10. Remaining risks

- **T174b is now the only legacy-highlighter follow-up**. It must ship
  the singleton-backed Tiptap extension (or upstream fork) and drop the
  `shiki` peerDep. Until it lands, the M.11 Phase 3 "delete legacy
  highlighter" goal is partially fulfilled — three of four sites use
  the singleton, one (Tiptap) still uses its own highlighter.
- The Tiptap dropdown still lists ~280 grammars even though the
  shared singleton only preloads ~21. This is intentional today —
  the upstream extension can still highlight any bundled language at
  decoration time — but T174b will shrink the picker to the preloaded
  subset to align with the singleton's bundle budget.
- The renderer's RTL harness still fails to bootstrap in this worktree
  (no worktree-local `node_modules`). Component-level RTL coverage for
  the migration is deferred to CI/local-checkout; the bun:test module-
  pipeline coverage captures the migration contract.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `ShikiCodeViewer.tsx` no longer imports `shiki` | PASS | Diff (commit `c08ae10f`) |
| `ShikiCodeViewer.tsx` uses `getSingletonHighlighter` + `resolveLanguage` | PASS | Diff |
| Per-site bun:test with ≥6 expects | PASS | 27 expects (Section 8) |
| `TiptapCodeBlockView.tsx` migrate OR document with T174b plan | PASS | Diff (commit `ae77e910`) + in-file doc |
| `packages/ui/package.json` peerDep decision documented | PASS | Ticket Section "Decisions reached" |
| `packages/shared/src/highlight/` unchanged | PASS | Diff |
| T173-migrated sites unchanged | PASS | Diff |
| Typecheck clean on `packages/ui` | PASS | Section 8 |
