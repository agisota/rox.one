# T125 - Composer Toolbar Keyboard Access

## 1. Task summary

Improve the composer product-mode picker so the custom UI supports predictable keyboard navigation and exposes a stronger listbox accessibility contract.

## 2. Repo context discovered

- `ProductModeToolbar.tsx` renders a custom picker button and listbox instead of a native `<select>`.
- `product-mode-toolbar.ts` owns the stable composer mode/action order and is the right place for pure keyboard target logic.
- `product-mode-toolbar.test.ts` is the existing static/contract harness for this toolbar.
- Composer action buttons already emit local `product-mode-intent` payloads; this task should not change action routing or provider submission behavior.
- No `mise.toml` exists in this repo, so validation uses the existing `bun` package scripts.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `docs/tickets/T053-product-mode-toolbar-lint.md`
- `docs/worklog/T053-product-mode-toolbar-lint.md`
- `docs/tickets/T057-experience-layer-interaction-polish.md`
- `docs/worklog/T057-experience-layer-interaction-polish.md`
- `package.json`

## 4. Tests added first

- Added `resolveComposerProductModeKeyboardTarget` expectations for `ArrowDown`, `ArrowUp`, `Home`, and `End` across the visible composer mode order.
- Added a static render assertion for the picker keyboard shortcut contract.

## 5. Expected failing test output

Initial red run:

```text
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts
0 pass
1 fail
SyntaxError: Export named 'resolveComposerProductModeKeyboardTarget' not found in module
```

The failure was expected because the keyboard navigation helper did not exist yet.

## 6. Implementation changes

- Added `COMPOSER_PRODUCT_MODE_NAVIGATION_KEYS`, `isComposerProductModeNavigationKey`, and `resolveComposerProductModeKeyboardTarget` to the toolbar contract module.
- Added active-mode state to the custom picker.
- Keyboard behavior:
  - `ArrowDown` / `ArrowUp` wrap through the visible mode order.
  - `Home` / `End` jump to first/last visible mode.
  - `Enter` / `Space` select the active mode while the listbox is open.
  - `Escape` closes the picker and returns focus to the picker button.
- Added listbox focus handling, `aria-activedescendant`, option IDs, `data-active`, and non-tabstop option buttons for a stable active-option model.
- Kept composer action buttons and local artifact routing unchanged.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts packages/shared/src/workbench/__tests__/experience-state-binding.test.ts packages/shared/src/workbench/__tests__/mission-mode-prompt-registry.test.ts`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run lint:i18n:sorted`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:coverage`
- `bun run validate:agent-contract`
- `bun run electron:build`
- `bun run electron:smoke`
- `git diff --check`
- `lsp_diagnostics` for `ProductModeToolbar.tsx`
- `lsp_diagnostics` for `product-mode-toolbar.ts`

## 8. Passing test output summary

Targeted toolbar contract:

```text
8 pass
0 fail
51 expect() calls
```

Composer/workbench slice:

```text
43 pass
0 fail
303 expect() calls
```

Static checks:

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run lint:i18n:sorted
PASS

bun run lint:i18n:parity
i18n parity OK (7 locales, 1556 keys each)

bun run lint:i18n:coverage
i18n coverage OK (1484 literal references, 1016 files scanned)

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 126 tickets, 7 required docs

git diff --check
PASS
```

LSP diagnostics reported 0 errors for both touched source files. The LSP helper noted `tsc skipped: no tsconfig found`, so the authoritative typecheck evidence is `bun run typecheck:electron`.

## 9. Build output summary

```text
bun run electron:build
PASS
```

Vite reported the known non-blocking large chunk warning.

```text
bun run electron:smoke
[smoke] Electron headless startup passed
App initialized successfully
```

## 10. Remaining risks

- Live GUI keyboard interaction was not manually clicked through in a desktop window in this pass; coverage is contract/static plus Electron startup smoke.
- The existing `react-i18next` static-render warning remains in the toolbar test because the harness does not initialize i18n. It is non-fatal and pre-existing for this test shape.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Keyboard target resolution is covered by tests | Pass | `product-mode-toolbar.test.ts` covers ArrowDown, ArrowUp, Home, End |
| Picker markup exposes stable listbox active-option contract | Pass | `aria-keyshortcuts`, `aria-activedescendant`, option IDs, `data-active` |
| Existing composer action behavior is unchanged | Pass | Existing action/intent tests still pass |
| Relevant validation passes | Pass | Targeted tests, slice tests, typecheck, lint, i18n gates, diff check |
| Build and smoke pass | Pass | `electron:build` and `electron:smoke` passed |
| Worklog complete | Pass | This worklog records context, red/green evidence, implementation, risks |
| Commit created | Pass | Scoped Lore commit created for T125 |
