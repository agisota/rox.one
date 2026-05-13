# T173 - Shiki Call-Site Migration (first 2 sites)

Status: DONE

## Context

T172 (PR #85) shipped the shared highlight adapter at
`packages/shared/src/highlight/` exposing `createShikiHighlighter`,
`getSingletonHighlighter`, `resolveLanguage`, and the curated
`PRELOADED_LANGUAGES` / `PRELOADED_THEMES` sets. T242 / T336 (PR #92)
repaired the adapter contract (corpus test typecheck, ADR 0010, missing
metadata).

T173 starts migrating renderer-facing call sites OFF the direct
`shiki` package imports (`codeToHtml`, `bundledLanguages`,
`BundledLanguage`) ONTO the shared process-wide singleton. T174 will
remove the legacy direct-import path once all call sites have moved.

## Goal

Migrate the first two renderer-facing call sites onto
`getSingletonHighlighter` + `resolveLanguage` without changing their
observable behavior (theme handling, fallback to plain text, async
highlight gate, LRU cache shape).

## Required UI

None. The migration must be visually indistinguishable from the
pre-migration state.

## Required Data/API

No API changes. The migrated sites consume the existing
`@rox-one/shared/highlight` subpath export.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Each migrated site lands with a bun:test that pins the singleton contract
the site relies on. Tests must use ≥6 `expect()` calls each. Renderer-side
RTL tests are not run in this slice because the renderer's vitest harness
requires worktree-local `node_modules` (which is not provisioned in this
agent worktree); contracts are tested at the module pipeline level.

## Implementation Requirements

- Migrate `apps/electron/src/renderer/components/shiki/ShikiCodeEditor.tsx`
  off `shiki` imports onto `getSingletonHighlighter` + `resolveLanguage`.
- Migrate `packages/ui/src/components/markdown/CodeBlock.tsx` off `shiki`
  imports onto `getSingletonHighlighter` + `resolveLanguage`. Remove the
  local `LANGUAGE_ALIASES` / `PRELOADED_LANGUAGES` / `isValidLanguage`
  dead weight covered by the shared adapter.
- Preserve the existing inner-markup regex strip in `ShikiCodeEditor`.
- Preserve theme priority order in `CodeBlock` (context → forcedTheme →
  DOM class fallback).
- Do not modify `packages/shared/src/highlight/`.
- Do not delete the legacy direct-import paths from sites not in scope
  (T174 will do that across the full sweep).
- Do not modify `.swarm/master-roadmap-log.md`.
- Total component changes ≤200 LOC; total test additions ≤200 LOC.

## Sites in scope (this slice)

1. `apps/electron/src/renderer/components/shiki/ShikiCodeEditor.tsx` —
   renderer-direct `codeToHtml` call site.
2. `packages/ui/src/components/markdown/CodeBlock.tsx` — renderer-facing
   wrapper used by `StreamingMarkdown.tsx`.

## Sites remaining (T174 follow-up)

- `packages/ui/src/components/code-viewer/ShikiCodeViewer.tsx` — direct
  `codeToHtml` import; renderer-facing wrapper at
  `apps/electron/src/renderer/components/shiki/ShikiCodeViewer.tsx`.
- `packages/ui/src/components/markdown/TiptapCodeBlockView.tsx` — uses
  `tiptap-extension-code-block-shiki` which manages its own engine
  state; needs a separate migration plan (engine-replacement vs.
  singleton injection).
- Any future renderer paths surfaced by the T174 grep sweep.

## Validation Commands

- `bun test apps/electron/src/renderer/components/shiki/__tests__/`
- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `bun test packages/shared/src/highlight/__tests__/` (regression)
- `cd packages/ui && bunx tsc --noEmit`
- `cd apps/electron && bunx tsc --noEmit`

## Acceptance Criteria

- [x] `ShikiCodeEditor.tsx` no longer imports from `shiki`.
- [x] `CodeBlock.tsx` no longer imports from `shiki`.
- [x] Both sites use `getSingletonHighlighter` + `resolveLanguage`.
- [x] A bun:test pins the migration contract for each site, ≥6 expects.
- [x] `packages/shared/src/highlight/` is unchanged.
- [x] Legacy highlighter sites not in scope are unchanged (T174's job).
- [x] Typecheck passes for the affected packages.
- [x] T174 follow-up sites recorded in this ticket.

## Worklog

See `docs/worklog/T173-shiki-callsite-migration.md`.
