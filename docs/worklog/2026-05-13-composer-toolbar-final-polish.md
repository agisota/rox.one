# 2026-05-13 Composer Toolbar final polish

## 1. Task summary

Improve the new composer prompt-session surface so the six workflow actions stay available but no longer dominate the composer toolbar. Re-check that the action buttons are wired to real artifact flows before final build/smoke.

## 2. Repo context discovered

- `FreeFormInput` owns the composer state and renders `ProductModeToolbar` plus `ComposerArtifactPanel`.
- `product-mode-toolbar.ts` is the canonical contract for the six composer action IDs, labels, and mode mapping.
- `ProductModeToolbar.tsx` currently renders all six actions as equal text buttons, which is visually noisy on the prompt input surface.
- `composer-artifact-flow.ts` maps the six actions to concrete artifact panels and Experience events.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/ComposerArtifactPanel.tsx`
- `apps/electron/src/renderer/components/app-shell/input/composer-artifact-flow.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`

## 4. Tests added first

Planned first failing test:

- Lock primary vs overflow action grouping while preserving all six action IDs.
- Lock the toolbar markup to render a compact action rail and overflow trigger instead of six equal top-level buttons.

## 5. Expected failing test output

`bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
failed before implementation with:

```text
SyntaxError: Export named 'COMPOSER_PRODUCT_MODE_PRIMARY_ACTION_IDS' not found
```

This is the expected failure: the compact primary/overflow grouping contract is not implemented yet.

## 6. Implementation changes

- Split the six composer quick actions into a compact primary rail and overflow menu:
  - primary: `improve-prompt`, `run-tdd-plan`, `verify`
  - overflow: `tear-down`, `build-spec`, `review`
- Kept the existing action IDs and `mapActionToIntent` contract so downstream artifact flows continue to receive the same `{ actionId, mode }` payloads.
- Added lucide icons, keyboard-accessible overflow menu behavior, escape/outside-click close handling, and clearer mode-picker labelling.
- Added localized toolbar overflow labels for all existing locale files.
- Added packaged UI smoke coverage that clicks the real packaged app through Account, Experience, and Composer action surfaces.

## 7. Validation commands run

- `bun install --frozen-lockfile`
- `bun run typecheck:all`
- `bun run lint`
- `bun run test:rtl`
- `bun run e2e:core`
- `bun run validate:audit`
- `cd packages/audit && bun test`
- `bun run build`
- `bun run electron:dist:dev:mac:arm64`
- `bun run electron:smoke:packaged:mac`
- `bun run electron:ui-smoke:packaged:mac`
- `bun run validate:packaged-artifacts`

## 8. Passing test output summary

- `bun run test:rtl`: 9 test files passed, 54 tests passed.
- `bun run e2e:core`: composer artifacts, Experience runtime journey, account/team/billing/storage, server smoke, and Electron startup smoke all passed.
- `bun run electron:ui-smoke:packaged:mac`: packaged ROX.ONE UI smoke passed for:
  - Account: login, registration, password reset surfaces
  - Experience: all six workbench screens
  - Composer: primary actions plus overflow actions opening expected artifact panels
- UI smoke evidence directory:
  `/Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-2026-05-12T22-52-42-266Z`

## 9. Build output summary

- `bun run build` passed.
- `bun run electron:dist:dev:mac:arm64` produced fresh packaged artifacts under `apps/electron/release/`.
- `bun run validate:packaged-artifacts` passed:
  - `apps/electron/release/ROX-ONE-arm64.dmg`
    SHA256 `0f247c23984ea4ff0b00de1ce9d0fa1e74f47f0ec0df18db2766bdfa3a4c84d7`
  - `apps/electron/release/ROX-ONE-arm64.zip`
    SHA256 `49ac7583cce6931de1f0fff57ccd1f0c5ae2311ab4a0ed579d3879cc85a6786e`

## 10. Remaining risks

- Live provider-backed prompt execution was not exercised because it would require real model/network side effects.
- Production account API submissions were not exercised; the packaged smoke verifies UI navigation and local form surface availability.
- Distribution signing/notarization remains ad-hoc/skipped in the dev mac packaging flow.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Six composer actions remain available | Pass | Primary rail exposes 3 actions; overflow menu exposes the other 3 |
| Toolbar is visually more compact | Pass | Equal six-button row replaced by primary action rail plus overflow |
| Action mapping still resolves to real artifacts | Pass | RTL tests and packaged UI smoke verified composer panels |
| Targeted tests pass | Pass | `product-mode-toolbar.test.ts` and `product-mode-toolbar.rtl.test.tsx` included in passing RTL gate |
| Full quality gate passes | Pass | install, lint, typecheck, RTL, e2e, audit, build, packaged smoke, UI smoke, artifact validation |
| Packaged app UI smoke covers composer/account/Experience | Pass | Evidence saved in the `rox-one-ui-smoke-2026-05-12T22-52-42-266Z` directory |
