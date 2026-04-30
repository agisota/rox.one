# T053 - Product Mode Toolbar Lint Completion

## Task summary

Resolve the remaining full Electron lint blocker after the Experience Layer delivery by replacing nonstandard shadow utility classes in the composer product-mode toolbar with approved design-system shadow classes.

## Repo context discovered

- Full `apps/electron bun run lint` fails only in `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`.
- The failing rule is `rox-styles/no-nonstandard-shadows`.
- Existing toolbar behavior is covered by `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`.

## Files inspected

- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`

## Tests or validation checks added first

- No new test file needed; this is a style-system lint regression.
- Failing validation was run first: `bun run lint` from `apps/electron`.

## Expected failing output summary

- `ProductModeToolbar.tsx:52:21` disallowed `shadow-sm`.
- `ProductModeToolbar.tsx:64:23` disallowed `shadow-lg`.
- `ProductModeToolbar.tsx:94:23` disallowed `shadow-sm`.

## Implementation changes

- Replaced `shadow-sm` on the mode picker and action buttons with approved `shadow-xs`.
- Replaced `shadow-lg` on the picker popover with approved `shadow-modal-small`.
- Did not change toolbar behavior, mode/action contract, or unrelated composer state.

## Validation commands run

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `bun x eslint src/renderer/components/app-shell/input/ProductModeToolbar.tsx` from `apps/electron`
- `bun run lint` from `apps/electron`
- `bun run typecheck` from `apps/electron`
- `bun run validate:agent-contract`

## Passing output summary

- Toolbar contract tests: 7 pass, 0 fail.
- Targeted toolbar lint: passed.
- Full Electron lint: passed.
- Electron typecheck: passed.
- Agent contract validation: passed.

## Remaining risks

- `react-i18next` test warning still appears in the existing static render test because the test does not initialize i18n. It is non-fatal and pre-existing for this test shape.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Nonstandard shadow classes removed from `ProductModeToolbar.tsx` | Pass | `shadow-sm`/`shadow-lg` replaced by approved classes. |
| Toolbar tests still pass | Pass | Toolbar contract tests: 7 pass, 0 fail. |
| Targeted toolbar lint passes | Pass | `bun x eslint src/renderer/components/app-shell/input/ProductModeToolbar.tsx` passed. |
| Full Electron lint passes | Pass | `bun run lint` from `apps/electron` passed. |
| Electron typecheck passes | Pass | `bun run typecheck` from `apps/electron` passed. |
| Agent contract validation passes | Pass | `bun run validate:agent-contract` passed. |
| Scoped commit exists | Pass | This scoped commit. |
