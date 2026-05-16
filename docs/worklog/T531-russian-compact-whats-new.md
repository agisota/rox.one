# T531 - Russian compact What's New summaries

## 1. Task summary

Implement the next release-notes slice from the active goal: compact Russian
bullet summaries in the in-app What's New surface while preserving historical
English release-note source files.

## 2. Repo context discovered

- `packages/shared/src/release-notes/index.ts` loads flat markdown files from
  bundled assets or `~/.rox/release-notes`.
- `getReleaseNotesList()` currently maps every `.md` file to a version, which
  can include `next.md`.
- `getCombinedReleaseNotes()` is consumed by Electron and server-core system
  handlers for the What's New overlay.
- `apps/electron/resources/AGENTS.md` says versioned release files are owned by
  the release flow, so this slice uses companion display summaries instead of
  rewriting historical source notes.

## 3. Files inspected

- `packages/shared/src/release-notes/index.ts`
- `apps/electron/resources/AGENTS.md`
- `apps/electron/resources/release-notes/0.9.1.md`
- `apps/electron/resources/release-notes/0.9.0.md`

## 4. Tests added first

- `packages/shared/src/release-notes/__tests__/release-notes-summary.test.ts`
  - proves `{version}.ru.md` is selected as display content for
    `{version}.md`
  - proves `.ru.md` companion files are not counted as separate releases
  - proves `next.md` is excluded from released What's New output
  - proves combined notes preserve newest-first semver order

## 5. Expected failing test output

- Initial red run failed with:
  `SyntaxError: Export named 'getCombinedReleaseNotesFromFiles' not found in module .../packages/shared/src/release-notes/index.ts`.

## 6. Implementation changes

- Added a release-note display builder that only treats `{semver}.md` files as
  released notes.
- Added optional `{semver}.ru.md` companion summary support; companion files are
  display content for the matching release, not independent versions.
- Updated `getReleaseNotesList()` and `getCombinedReleaseNotes()` to use the
  new builder, preserving the public API shape for current consumers.
- Excluded `next.md` from released output by construction.
- Added compact Russian bullet summaries for the 10 releases currently shown in
  the UI: `0.9.1`, `0.9.0`, `0.8.13`, `0.8.12`, `0.8.11`, `0.8.10`,
  `0.8.9`, `0.8.8`, `0.8.7`, and `0.8.6`.
- Added a pending release-note entry for the display-layer change.

## 7. Validation commands run

- `bun test packages/shared/src/release-notes/__tests__/release-notes-summary.test.ts`
- `bun -e "..."` bundled-resource probe using
  `buildReleaseNotesListFromFiles()`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`
- `ls apps/electron/dist/resources/release-notes | rg '0\\.9\\.1\\.ru|0\\.8\\.6\\.ru|next\\.md'`

## 8. Passing test output summary

- Release-notes summary tests: 2 pass, 0 fail, 9 expect calls.
- Bundled-resource probe returned:
  `0.9.1,0.9.0,0.8.13,0.8.12,0.8.11,0.8.10,0.8.9,0.8.8,0.8.7,0.8.6`.
- Bundled-resource probe first rendered line:
  `# Что нового в v0.9.1`.
- Bundled-resource probe reported `no-pending`.
- Typecheck: passed.
- Lint: passed with the same 7 existing warnings in unrelated files:
  - `apps/electron/src/main/deep-link.ts:118`
  - `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx:1505`
  - `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.emphasis.rtl.test.tsx:45`
  - `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.history.rtl.test.tsx:50`
  - `apps/electron/src/renderer/pages/__tests__/ChatPage.rtl.test.tsx:36`
  - `apps/electron/src/renderer/pages/settings/settings-pages.ts:42`
  - `apps/electron/src/renderer/pages/settings/settings-pages.ts:65`
- Diff whitespace check: passed.

## 9. Build output summary

- `bun run build` passed.
- Existing build warnings remain:
  - Vite dynamic import warnings for Shiki language/theme specifiers
  - circular chunk warnings around `index-shared`, `i18n`, and `index-react`
  - chunk-size warnings for large renderer assets
- Electron build resources completed, including Session MCP server, Pi Agent
  server, SDK native binary staging, renderer resources, and asset copy.
- `apps/electron/dist/resources/release-notes` contains the new companion
  summary files, including `0.9.1.ru.md` and `0.8.6.ru.md`.

## 10. Remaining risks

- This slice provides Russian compact summaries for the 10 releases currently
  displayed by the UI limit. Older release notes still fall back to the original
  source files if the display limit is increased later without adding more
  companion summaries.
- Historical English release-note files remain the source of truth; future
  release prep should continue writing source details to `next.md` and add/update
  companion summaries when the release is cut.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Russian companion summaries are selected for display when present | Done | `release-notes-summary.test.ts`, bundled-resource probe |
| English source release notes remain bundled and untouched | Done | Companion `.ru.md` files added; source `.md` files unchanged except `next.md` |
| `next.md` is excluded from released What's New output | Done | `release-notes-summary.test.ts`, bundled-resource probe |
| The latest release version remains newest semver release | Done | bundled-resource probe starts with `0.9.1` |
| Tests pass | Done | Targeted tests, typecheck, lint |
| Build passes when applicable | Done | `bun run build` |
| Worklog complete | Done | This file |
| Commit created | Done | Lore commit for this T531 slice |
