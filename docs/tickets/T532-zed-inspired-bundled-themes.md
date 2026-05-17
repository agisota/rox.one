# T532 - Zed-inspired bundled theme presets

Status: DONE

## Context

The active goal asks for more themes inspired by the Zed editor marketplace.
ROX.ONE already bundles JSON theme presets and surfaces them through the
Appearance settings picker, so the smallest useful slice is to add additional
curated presets from prominent Zed marketplace families instead of building a
full theme marketplace first.

## Goal

Add a small set of Zed-inspired bundled themes that appear automatically in the
existing theme picker and keep syntax-highlighting themes preloaded.

## Required UI

- New bundled presets appear in the existing Appearance theme dropdown.
- Theme metadata clearly names the preset and describes the inspiration.
- Presets must provide readable semantic colors for supported modes.

## Required Data/API

- Add JSON files under `apps/electron/resources/themes/`.
- Ensure referenced `shikiTheme` values are part of the preloaded highlighter
  theme set.
- Do not add runtime dependencies.

## TDD Requirements

Before implementation:

1. Add coverage proving the new theme IDs exist in bundled resources.
2. Validate every bundled theme file with `validateThemeContent()`.
3. Prove every bundled `shikiTheme` reference is preloaded.
4. Run the targeted test and capture the expected failure.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/bundled-themes.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [ ] New Zed-inspired bundled theme presets exist.
- [ ] All bundled theme JSON files validate.
- [ ] All bundled theme syntax-highlighting references are preloaded.
- [ ] Build copies the new theme assets.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T532-zed-inspired-bundled-themes.md`.
