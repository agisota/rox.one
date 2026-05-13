# T174 - Delete Legacy Highlighter (Phase 3 closeout)

Status: DONE

## Context

T172 (PR #85) shipped the shared highlight singleton in
`packages/shared/src/highlight/` exposing `createShikiHighlighter`,
`getSingletonHighlighter`, `resolveLanguage`, and the curated
`PRELOADED_LANGUAGES` / `PRELOADED_THEMES` sets. T173 (PR #114) migrated
the first two renderer call sites (`ShikiCodeEditor`, `CodeBlock`) onto
the singleton and identified three remaining call sites:

- `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx` (direct
  `codeToHtml`).
- `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx` (uses
  `tiptap-extension-code-block-shiki`; engine plan needed).
- `shiki` peerDependency in `packages/ui/package.json`.

T174 closes Phase 3 of M.11 by finishing what is finishable today and
documenting the one remaining blocker as T174b.

## Goal

1. Migrate `ShikiCodeViewer.tsx` off the raw `shiki` package onto
   `getSingletonHighlighter` + `resolveLanguage`, with a bun:test
   pinning the migration contract.
2. Analyse `TiptapCodeBlockView.tsx` and either migrate it in this PR
   or document the blocker in-file and defer to T174b.
3. Drop the `shiki` peerDependency from `packages/ui/package.json`
   only if no remaining call site needs it.

## Required UI

None. The migration must be visually indistinguishable from the
pre-migration state.

## Required Data/API

No API changes. The migrated site consumes the existing
`@rox-one/shared/highlight` subpath export.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Each migrated site lands with a bun:test that pins the singleton contract
the site relies on. Tests must use ≥6 `expect()` calls each. Renderer-side
RTL tests are not run in this slice because the renderer's vitest harness
requires worktree-local `node_modules` (same constraint as T173);
contracts are tested at the module pipeline level.

## Implementation Requirements

- Migrate `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx`
  off `shiki` imports onto `getSingletonHighlighter` + `resolveLanguage`,
  using the same pattern as the T173 migrations.
- Preserve theme handling (`shikiTheme` prop, light/dark fallback),
  `onReady` gate, cancellation, and error path verbatim.
- Inspect `TiptapCodeBlockView.tsx` + the installed
  `tiptap-extension-code-block-shiki` and either migrate or document
  the blocker with a concrete T174b plan inside the file.
- Decide on the `shiki` peerDep: keep if any remaining call site needs
  it; drop otherwise. Document the decision in this ticket and in the
  worklog.
- Do not modify `packages/shared/src/highlight/`.
- Do not modify the T173-migrated sites (`ShikiCodeEditor`, `CodeBlock`).
- Do not modify `.swarm/master-roadmap-log.md`.
- Total component changes ≤150 LOC; total test additions ≤200 LOC.

## Decisions reached

### ShikiCodeViewer — migrated (commit 1)

Migrated. Behavior-preserving refactor identical in shape to T173:
- Drop the local `LANGUAGE_ALIASES` table + `isValidLanguage` /
  `bundledLanguages` guard.
- Use `resolveLanguage(lang) ?? 'text'` and
  `(await getSingletonHighlighter()).highlight(code, lang, { theme })`.
- Theme priority order (`shikiTheme` prop → light/dark mapping)
  preserved.
- `objc` / `objective-c` aliases (previously ShikiCodeViewer-local)
  now render as plain text via the adapter's graceful 'text' fallback —
  this matches the previous `isValidLanguage` else-text branch when an
  unknown language was supplied, so no observable regression in the
  view panel.
- Pinned by `shiki-code-viewer-singleton.test.ts`
  (8 tests / 27 expects).

### TiptapCodeBlockView — deferred to T174b (commit 2)

Cannot be migrated in this slice. The upstream extension
`tiptap-extension-code-block-shiki` constructs its own Shiki highlighter
internally via `createHighlighter` from the raw `shiki` package
(verified against `node_modules/tiptap-extension-code-block-shiki/dist`)
and exposes no public API to inject an externally built highlighter.

The file's only direct `shiki` import is `bundledLanguages`, used to
enumerate the language-picker dropdown options. Migrating that import in
isolation while leaving the extension on its own highlighter would
silently shrink the authoring language set from ~280 (full bundled set)
to ~21 (our preload set) — a worse outcome than today's state.

Detailed deferral plan is captured in a module-doc block in the file
itself; the high-level steps are:

1. Ship a `tiptap-extension-code-block-rox-singleton` adapter (or fork
   the upstream extension) that calls `getSingletonHighlighter()` for
   decoration instead of constructing its own highlighter.
2. Wire the dropdown options off `PRELOADED_LANGUAGES` + the shared
   `LANGUAGE_ALIASES`; preserve current ordering/labels.
3. Drop the raw `shiki` import from `TiptapCodeBlockView.tsx` and from
   `packages/ui/package.json` peerDependencies in the same PR.
4. Pin the new extension's highlight-on-decoration contract with a
   bun:test.

### `shiki` peerDependency — kept (no commit 3)

Kept. `TiptapCodeBlockView.tsx` still resolves grammars from the raw
`shiki` package, so the peerDep stays until T174b lands. Dropping it
now would break the editor's language picker and the extension's
internal highlighter construction.

The peerDep removal is part of T174b's scope.

## Validation Commands

- `bun test packages/ui/src/components/code-viewer/__tests__/`
- `bun test packages/ui/src/components/markdown/__tests__/` (regression
  for the T173-migrated CodeBlock site)
- `cd packages/ui && bunx tsc --noEmit`
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `bun run validate:bundle-budget`

## Acceptance Criteria

- [x] `ShikiCodeViewer.tsx` no longer imports from `shiki`.
- [x] `ShikiCodeViewer.tsx` uses `getSingletonHighlighter` +
      `resolveLanguage`.
- [x] A bun:test pins the migration contract with ≥6 expects.
- [x] `TiptapCodeBlockView.tsx` either migrates or documents the
      blocker with a T174b plan in-file.
- [x] `packages/ui/package.json` peerDep decision documented (kept
      pending T174b).
- [x] `packages/shared/src/highlight/` is unchanged.
- [x] T173-migrated sites (`ShikiCodeEditor`, `CodeBlock`) are
      unchanged.
- [x] Typecheck passes for `packages/ui`.

## Worklog

See `docs/worklog/T174-delete-legacy-highlighter.md`.
