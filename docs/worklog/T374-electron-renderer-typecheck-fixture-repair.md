# T374 - Electron renderer typecheck fixture repair

Status: DONE
Phase: R.11 prerequisite repair
Ticket: docs/tickets/T374-electron-renderer-typecheck-fixture-repair.md

## 1. Task summary

Repair renderer test/playground fixtures so `bun run typecheck:electron` passes
after the current `origin/main` merge.

## 2. Repo context discovered

`BrowserInstanceInfo` now requires `hungTab: boolean`, but renderer atom tests
and browser playground mock presets still omit it. The voice input RTL test
uses jest-dom matchers even though the local Vitest type environment does not
load their assertion types. `TeamManagementStatus` is
`'loading' | 'ready' | 'error'`, but the a11y test seeds `'idle'`.

## 3. Files inspected

- `packages/shared/src/protocol/dto.ts`
- `apps/electron/src/renderer/atoms/__tests__/browser-pane.test.ts`
- `apps/electron/src/renderer/playground/registry/browser-ui.tsx`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/voice-input-slot.rtl.test.tsx`
- `apps/electron/src/renderer/pages/settings/__tests__/TeamManagementSettingsPage.rtl.test.tsx`
- `apps/electron/src/renderer/components/settings/rbac/team-management-state.ts`
- `apps/electron/src/test-utils/vitest-setup.ts`

## 4. Tests added first

No new test was needed. The existing RED check is `bun run typecheck:electron`.

## 5. Expected failing test output

```text
src/renderer/atoms/__tests__/browser-pane.test.ts(12,3): error TS2741: Property 'hungTab' is missing ...
src/renderer/components/app-shell/input/__tests__/voice-input-slot.rtl.test.tsx(...): error TS2339: Property 'toBeDisabled' does not exist ...
src/renderer/pages/settings/__tests__/TeamManagementSettingsPage.rtl.test.tsx(109,13): error TS2322: Type '"idle"' is not assignable ...
src/renderer/playground/registry/browser-ui.tsx(...): error TS2741: Property 'hungTab' is missing ...
```

## 6. Implementation changes

- Added the required `hungTab: false` field to `BrowserInstanceInfo`
  fixtures in the browser-pane atom test and browser UI playground presets.
- Replaced jest-dom matcher calls in the voice-input slot RTL test with
  standard DOM property/attribute assertions so no extra matcher type surface is
  required for `tsc --noEmit`.
- Wrapped the voice-input slot test render in `TooltipProvider` and mocked
  `useTranslation()` to return `defaultValue` so the RTL expectations exercise
  the component fallback copy without booting production i18n resources.
- Updated the team-management settings a11y seed from the removed `'idle'`
  status to the current valid `'ready'` status.

## 7. Validation commands run

- `bun run typecheck:electron` (RED)
- `bun run typecheck:electron` (GREEN)
- `bun test apps/electron/src/renderer/atoms/__tests__/browser-pane.test.ts`
- `~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/app-shell/input/__tests__/voice-input-slot.rtl.test.tsx src/renderer/pages/settings/__tests__/TeamManagementSettingsPage.rtl.test.tsx`

## 8. Passing test output summary

- `bun run typecheck:electron`: `tsc --noEmit` completed without errors.
- `browser-pane.test.ts`: 2 tests passed.
- `voice-input-slot.rtl.test.tsx` and
  `TeamManagementSettingsPage.rtl.test.tsx`: 11 tests passed. Vitest still
  emits existing KaTeX/Shiki warnings, but no failures.

## 9. Build output summary

Not run for this fixture-only repair. Broader branch closeout validation will
run the full build once the R.11 repair branch is clean.

## 10. Remaining risks

No production dependencies or runtime code paths changed. The only residual
risk is that broader suite/build validation can still expose unrelated failures
outside this fixture repair.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| `bun run typecheck:electron` passes | Green | `tsc --noEmit` completed without errors |
| No production dependency is added | Green | No package manifest or lockfile edits |
| Runtime behavior is unchanged | Green | Fixture/test-only changes; no production code path modified |
