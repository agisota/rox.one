# T264 - Rebrand component renames

## 1. Task summary

Rename the active Electron renderer icon component identifiers from legacy
`Craft*` names to canonical `Rox*` names without changing rendered output.

## 2. Repo context discovered

- Explorer mapping found three UI icon component definitions:
  `CraftAppIcon`, `CraftAgentsLogo`, and `CraftAgentsSymbol`.
- `CraftAppIcon` had no current consumers outside its own file.
- `CraftAgentsLogo` was consumed by the playground icon registry.
- `CraftAgentsSymbol` was consumed by `AppMenu`, `TopBar`, `SplashScreen`,
  onboarding screens, the playground shell, and the playground icon registry.
- No direct tests or snapshots referenced the old UI symbols.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `apps/electron/src/renderer/components/icons/CraftAppIcon.tsx`
- `apps/electron/src/renderer/components/icons/CraftAgentsLogo.tsx`
- `apps/electron/src/renderer/components/icons/CraftAgentsSymbol.tsx`
- `apps/electron/src/renderer/playground/registry/icons.tsx`
- `apps/electron/src/renderer/components/AppMenu.tsx`
- `apps/electron/src/renderer/components/app-shell/TopBar.tsx`
- `apps/electron/src/renderer/components/SplashScreen.tsx`
- `apps/electron/src/renderer/components/onboarding/*.tsx`
- `apps/electron/src/renderer/playground/PlaygroundApp.tsx`

## 4. Tests added first

Added `scripts/__tests__/rebrand-code-identifiers.test.ts` before
implementation. The first T264 test asserts:

- old icon component files do not exist;
- new `Rox*` icon component files exist;
- active Electron renderer source has no `CraftAppIcon`,
  `CraftAgentsLogo`, or `CraftAgentsSymbol` identifiers.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- Result: exit 1.
- Expected failure: `legacy icon component files should be renamed`, with the
  received list containing `CraftAppIcon.tsx`, `CraftAgentsLogo.tsx`, and
  `CraftAgentsSymbol.tsx`.

## 6. Implementation changes

- Renamed:
  - `CraftAppIcon.tsx` -> `RoxAppIcon.tsx`
  - `CraftAgentsLogo.tsx` -> `RoxAgentsLogo.tsx`
  - `CraftAgentsSymbol.tsx` -> `RoxAgentsSymbol.tsx`
- Renamed component prop interfaces and exported functions to `Rox*`.
- Updated renderer imports/usages in app menu, top bar, splash screen,
  onboarding, playground shell, and playground icon registry.
- Updated playground icon registry display names to `RoxAgentsLogo` and
  `RoxAgentsSymbol`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- `bun run typecheck`
- `bun run lint`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`: 1 pass,
  0 fail, 3 assertions.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.

## 9. Build output summary

Not run for T264 alone. R.2 will run the full suite and build before the phase
PR because later R.2 tickets also rename runtime imports.

## 10. Remaining risks

- Registry IDs such as `craft-agents-logo` remain lower-case product tokens and
  are outside the T264 representative `Craft*` component identifier scope; later
  rebrand phases own broader lower-case token cleanup.
- `bun run validate:rebrand` remains expected red until the remaining R.2 and
  later rebrand buckets land.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves component identifier gap | Pass | Red exit 1 on legacy icon files before implementation |
| Component files/symbols/imports use `Rox*` | Pass | Files and renderer imports now use `Rox*` names |
| Legacy UI component identifiers removed | Pass | R.2 identifier test passes |
| Validation evidence recorded | Pass | Targeted test, typecheck, and lint evidence recorded above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This ticket is committed as the T264 implementation commit in git history |
