# T173 - Shiki Call-Site Migration (first 2 sites)

## 1. Task summary

Start migrating renderer-facing call sites off the direct `shiki` package
imports (`codeToHtml`, `bundledLanguages`, `BundledLanguage`) onto the
shared `getSingletonHighlighter` + `resolveLanguage` from
`@rox-one/shared/highlight` (the singleton landed by T172 / PR #85 and
repaired by T336 / PR #92). T173 picks two sites and pins the contract;
T174 sweeps the remainder and removes the legacy direct-import paths.

## 2. Repo context discovered

- `origin/main @ 645e0a82` already contains the adapter (T172) and the
  T336 repair (corpus test typecheck, ADR 0010, missing metadata).
- The renderer's vitest harness (`apps/electron/vitest.config.ts`) aliases
  `react` to `<repo>/../../node_modules/react`. The agent worktree at
  `.claude/worktrees/agent-…` has no worktree-local `node_modules`, so
  RTL tests (including pre-existing `button.rtl.test.tsx`) fail with
  `Failed to resolve import "react/jsx-dev-runtime"` — independent of
  this slice. Bun-test runs from the repo root resolve modules normally.
- Direct `shiki` imports in the renderer surface area live at:
  - `apps/electron/src/renderer/components/shiki/ShikiCodeEditor.tsx`
  - `packages/ui/src/components/markdown/CodeBlock.tsx`
  - `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx`
  - `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx`
    (uses `tiptap-extension-code-block-shiki`, separate engine state)
- The shared adapter exports `getSingletonHighlighter`,
  `resetSingletonHighlighter`, `resolveLanguage`, `PRELOADED_LANGUAGES`,
  `PRELOADED_THEMES`, and types via `@rox-one/shared/highlight`.

## 3. Files inspected

- `packages/shared/src/highlight/index.ts`
- `packages/shared/src/highlight/singleton.ts`
- `packages/shared/src/highlight/highlighter.ts`
- `packages/shared/src/highlight/languages.ts`
- `apps/electron/src/renderer/components/shiki/ShikiCodeEditor.tsx`
- `apps/electron/src/renderer/components/shiki/ShikiCodeViewer.tsx`
- `apps/electron/src/renderer/components/shiki/ShikiDiffViewer.tsx`
- `packages/ui/src/components/markdown/CodeBlock.tsx`
- `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx`
- `packages/ui/package.json`
- `apps/electron/vitest.config.ts`
- `docs/tickets/T336-shiki-adapter-contract-repair.md`
- `docs/worklog/T336-shiki-adapter-contract-repair.md`

## 4. Tests added first

Two bun:test specs land alongside their respective component migrations:

- `apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts`
  (7 tests / 15 expects). Pins the inner-markup strip regex contract,
  alias resolution, deterministic repeat output, and reset path.
- `packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
  (7 tests / 22 expects). Pins the alias set CodeBlock used to own,
  null fallback for unknown ids, theme-pair output divergence, LRU
  determinism, and unsupported-theme/language graceful fallback.

## 5. Expected failing test output

Pre-migration, neither spec exists. Post-migration the specs must pass
green. There is no pre-existing red-test step because the migration is a
behavior-preserving refactor of two call sites; correctness is anchored
to the adapter's existing corpus contract (`highlight-corpus.test.ts`,
24 pass / 94 expects on `origin/main`).

## 6. Implementation changes

- `apps/electron/src/renderer/components/shiki/ShikiCodeEditor.tsx`
  - Replace `import { codeToHtml, bundledLanguages, type BundledLanguage } from 'shiki'`
    with `import { getSingletonHighlighter, resolveLanguage } from '@rox-one/shared/highlight'`.
  - Drop the local `LANGUAGE_ALIASES` table + `isValidLanguage` guard.
  - Resolve language via `resolveLanguage(language) ?? 'text'`.
  - Call `(await getSingletonHighlighter()).highlight(code, lang, { theme })`
    in place of `codeToHtml`.
  - Inner-markup strip regex preserved verbatim.
- `packages/ui/src/components/markdown/CodeBlock.tsx`
  - Same import swap.
  - Drop the local `LANGUAGE_ALIASES`, `PRELOADED_LANGUAGES` literal, and
    `isValidLanguage` guard. The `?? 'text'` arm pairs with the adapter's
    own fallback so unknown fences render as plain text without throwing.
  - Theme priority order (context → forcedTheme → DOM class) preserved.
  - LRU cache shape (`${theme}:${lang}:${code}`) preserved.
- Tests as described in section 4.
- Ticket + worklog (this file).

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts`
- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts` (regression)
- `cd packages/ui && bunx tsc --noEmit`
- `cd apps/electron && bunx tsc --noEmit`
- `cd packages/shared && bun run tsc --noEmit`

## 8. Passing test output summary

```text
bun test apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts
 7 pass, 0 fail, 15 expect() calls

bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts
 7 pass, 0 fail, 22 expect() calls

bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts
 24 pass, 0 fail, 94 expect() calls

cd packages/ui && bunx tsc --noEmit
exit 0

cd apps/electron && bunx tsc --noEmit
exit 0

cd packages/shared && bun run tsc --noEmit
exit 0
```

## 9. Build output summary

Not run in this slice — `bun run build` for the electron app requires
worktree-local `node_modules` (see Section 2). Typecheck against each
affected package's project tsconfig is the gating signal; both pass
clean. A full build runs at land time on `main`.

## 10. Remaining risks

- T174 follow-up: three sites still import `shiki` directly
  (`packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx`,
  `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx`, and the
  raw `shiki` peerDependency entry in `packages/ui/package.json`). The
  legacy direct-import path cannot be removed until those land.
- The Tiptap site uses `tiptap-extension-code-block-shiki`, which
  manages its own highlighter state; T174 needs a separate plan for it
  (engine replacement vs. singleton injection at extension config time).
- The renderer's RTL harness fails to bootstrap in this worktree (no
  worktree-local `node_modules`), so the component-level RTL coverage
  for this migration is deferred to CI/local-checkout. The bun:test
  module-pipeline coverage captures the migration contract.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `ShikiCodeEditor.tsx` no longer imports `shiki` | PASS | Diff |
| `CodeBlock.tsx` no longer imports `shiki` | PASS | Diff |
| Both sites use `getSingletonHighlighter` + `resolveLanguage` | PASS | Diff |
| Per-site bun:test with ≥6 expects | PASS | 15 + 22 expects (Section 8) |
| `packages/shared/src/highlight/` unchanged | PASS | Diff |
| Out-of-scope sites unchanged | PASS | Diff |
| Typecheck clean on affected packages | PASS | Section 8 |
| T174 follow-up sites documented | PASS | Section 10 + ticket |
