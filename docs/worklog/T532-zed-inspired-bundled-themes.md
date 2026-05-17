# T532 - Zed-inspired bundled theme presets

## 1. Task summary

Add marketplace-informed Zed-inspired bundled theme presets as the next visible
Appearance slice under the active goal.

## 2. Repo context discovered

- Existing theme presets live as JSON files under
  `apps/electron/resources/themes/`.
- `AppearanceSettingsPage` loads presets with
  `window.electronAPI.loadPresetThemes()`.
- `ThemeContext` has a bundled `import.meta.glob()` fallback for the same
  resource folder.
- `packages/shared/src/highlight/themes.ts` defines the Shiki themes preloaded
  by the syntax highlighter.
- Zed docs describe theme extensions and local themes as JSON theme files; the
  Zed extensions page shows prominent theme families such as Catppuccin, Tokyo
  Night, One Dark Pro, GitHub, Dracula, macOS Classic, VSCode Dark Modern, and
  Snazzy.

## 3. Files inspected

- `apps/electron/resources/themes/*.json`
- `apps/electron/src/renderer/pages/settings/AppearanceSettingsPage.tsx`
- `apps/electron/src/renderer/context/ThemeContext.tsx`
- `packages/shared/src/config/theme.ts`
- `packages/shared/src/config/validators.ts`
- `packages/shared/src/highlight/themes.ts`

## 4. Tests added first

- `packages/shared/src/config/__tests__/bundled-themes.test.ts`
  - expects the curated Zed-inspired theme IDs to exist in bundled resources
  - validates every bundled theme JSON file with `validateThemeContent()`
  - verifies every bundled `shikiTheme` reference is present in
    `PRELOADED_THEMES`

## 5. Expected failing test output

- Initial red run failed because the new preset files did not exist:
  `Expected: true Received: false`.
- The same run also failed the count guard:
  `Expected: >= 19 Received: 15`.

## 6. Implementation changes

- Added four bundled theme presets:
  - `kanagawa-wave.json`
  - `macos-classic.json`
  - `snazzy.json`
  - `vscode-dark-modern.json`
- Added `dark-plus` and `kanagawa-wave` to the preloaded Shiki theme set so
  the new presets' code highlighting does not fall back silently.
- Updated the preloaded-theme comment to avoid a stale hardcoded preset count.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/bundled-themes.test.ts`
- `bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`
- `ls apps/electron/dist/resources/themes | rg 'kanagawa-wave|macos-classic|snazzy|vscode-dark-modern'`

## 8. Passing test output summary

- Bundled theme tests: 3 pass, 0 fail, 61 expect calls.
- Highlight corpus tests: 24 pass, 0 fail, 94 expect calls.
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
- `apps/electron/dist/resources/themes` contains:
  `kanagawa-wave.json`, `macos-classic.json`, `snazzy.json`, and
  `vscode-dark-modern.json`.

## 10. Remaining risks

- This is a bundled-preset slice, not a full remote theme marketplace.
- The presets are ROX-authored palettes inspired by prominent Zed marketplace
  families; they do not import third-party extension source verbatim.
- Adding more Shiki themes increases renderer transformed module count slightly
  (`5664` to `5668` in this build), but the highlight corpus and build still
  pass.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| New Zed-inspired bundled theme presets exist | Done | `bundled-themes.test.ts`, resource files |
| All bundled theme JSON files validate | Done | `bundled-themes.test.ts` |
| All bundled theme syntax-highlighting references are preloaded | Done | `bundled-themes.test.ts`, highlight corpus |
| Build copies the new theme assets | Done | `dist/resources/themes` check |
| Tests pass | Done | Bundled theme + highlight corpus tests, typecheck, lint |
| Build passes when applicable | Done | `bun run build` |
| Worklog complete | Done | This file |
| Commit created | Done | Lore commit for this T532 slice |
