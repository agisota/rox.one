# T007 — Composer mode selector and action buttons

## 1. Task summary

Added a composer-level Agent Workbench product mode toolbar for the Electron chat input. The toolbar renders a product mode selector and the requested prompt workflow action buttons:

- Rewrite Prompt
- Think With Me
- Build Spec
- Review
- Verify
- Run TDD Plan
- Save Preset

The buttons do not execute backend workflows yet. They emit a typed renderer event payload via `rox:product-mode-intent` so later tasks can attach rewrite/spec/review/TDD execution without changing the composer submit path.

## 2. Repo context discovered

Read-only discovery found the chat submit chain:

`ChatPage -> ChatDisplay -> ChatInputZone -> InputContainer -> FreeFormInput`

The safe T007 write point is `FreeFormInput`, because it owns the visible composer controls and form submit behavior. Product-mode UI state is intentionally local to the composer for this task and does not replace existing permission/autonomy mode handling.

The renderer test surface is mostly Bun/unit-oriented rather than full DOM interaction testing. To keep TDD tight, the new toolbar behavior is covered through a pure typed contract module; the React component is covered by Electron typecheck and production renderer build.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx`
- `apps/electron/src/renderer/components/app-shell/input/ChatInputZone.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/StructuredInput.tsx`
- `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts`
- `apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts`
- `apps/electron/package.json`
- `package.json`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `apps/electron/tsconfig.json`

Explorer subagent mapped additional relevant files:

- `apps/electron/src/renderer/pages/ChatPage.tsx`
- `apps/electron/src/renderer/components/app-shell/ChatDisplay.tsx`
- `apps/electron/src/renderer/components/app-shell/ActiveOptionBadges.tsx`
- `apps/electron/src/renderer/components/app-shell/input/CompactPermissionModeSelector.tsx`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/input-event-guards.test.tsx`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/focus-input-events.test.tsx`
- `packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `packages/shared/src/i18n/__tests__/locale-registry.test.ts`

## 4. Tests added first

Added `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts` before implementation.

The test asserts:

- default product mode is `rewrite`
- toolbar action order is stable
- every action maps to the expected product mode
- `save-preset` keeps the currently selected mode
- action clicks can create typed `product-mode-intent` payloads
- selector exposes all product modes with the expected i18n keys

## 5. Expected failing test output

Initial failing run before implementation:

```text
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts
error: Cannot find module '../product-mode-toolbar'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added pure toolbar contract helpers in `product-mode-toolbar.ts`.
- Added `ProductModeToolbar.tsx` renderer component with accessible select/button controls.
- Wired the toolbar into `FreeFormInput` above the rich text input.
- Added local selected product mode state in the composer.
- Added typed `CustomEvent<ProductModeIntent>` dispatch on action click.
- Added action/toolbar i18n keys across all locale files; RU has Russian copy, other non-EN locales use English fallback.
- Added `@rox-agent/shared/workbench` and `@rox-agent/shared/workbench/product-mode-registry` exports for future tasks.

## 7. Validation commands run

```text
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts packages/shared/src/i18n/__tests__/locale-parity.test.ts packages/shared/src/i18n/__tests__/locale-registry.test.ts
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
bun run build
bun run electron:build
```

## 8. Passing test output summary

- Targeted toolbar + i18n tests: `79 pass, 0 fail`
- `bun run typecheck:shared`: pass
- `bun run typecheck:electron`: pass
- `bun run validate:agent-contract`: pass, `11 skills, 41 tickets, 7 required docs`
- `bun run validate:docs`: pass, architecture docs validator included
- `git diff --check`: pass

## 9. Build output summary

`bun run build` failed because the root script points to missing `scripts/build.ts`. This is an existing build-script blocker, not caused by T007.

Actual repository desktop build target passed:

```text
bun run electron:build
```

Evidence:

- main process build completed and verified
- preload builds completed and verified
- renderer Vite production build completed
- resources/assets copied successfully

## 10. Remaining risks

- T007 intentionally emits typed intent events only. Rewrite/Think/Spec/Review/TDD execution will be connected in later tickets.
- Full DOM click assertions are not added because the current renderer test harness is not primarily DOM-interaction based; the pure payload contract is tested and the React wiring is covered by typecheck/build.
- Root `bun run build` remains stale and should be fixed by a dedicated build-system ticket, not hidden inside T007.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Mode selector renders in composer | PASS | `ProductModeToolbar` wired into `FreeFormInput`; `electron:build` passed |
| Required action buttons exist | PASS | `COMPOSER_PRODUCT_MODE_ACTION_IDS` tested |
| Selected mode updates local UI state | PASS | `FreeFormInput` local `selectedProductMode`; `ProductModeToolbar` select callback typed |
| Buttons dispatch typed intent events | PASS | `createProductModeIntent` tested; `CustomEvent<ProductModeIntent>` wired |
| No backend execution yet | PASS | buttons only dispatch renderer event |
| Existing composer submit path preserved | PASS | no changes to `submitMessage`/`handleSubmit`; electron typecheck/build passed |
| Accessibility labels exist | PASS | select and action group/buttons include aria labels via i18n keys |
| Tests pass | PASS | targeted suite `79 pass, 0 fail` |
| Build passes | PASS | `bun run electron:build` passed |
| Worklog complete | PASS | this file |
