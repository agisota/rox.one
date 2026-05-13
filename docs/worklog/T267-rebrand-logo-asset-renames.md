# T267 - Rebrand logo asset renames

## 1. Task summary

Rename active Electron logo asset filenames and their branding asset directory
from legacy `rox` names to canonical `rox` names.

## 2. Repo context discovered

- Phase R.3 requires logo assets to move from `apps/electron/resources/rox-logos/`
  to `apps/electron/resources/rox-logos/`.
- The tracked logo files currently include `rox_app_icon.png`,
  `rox_app_icon_dark.png`, `rox_logo_black.png`, and
  `rox_logo_white.png`.
- The renderer asset `apps/electron/src/renderer/assets/rox_logo_c.svg`
  is tracked and must be renamed to `rox_logo_c.svg`.
- Active text references found for this ticket are limited to
  `apps/electron/resources/AGENTS.md` plus the rebrand goal and mapping docs.
  Historical rebrand docs remain immutable or later-phase inputs.
- The macOS Liquid Glass icon contract uses `resources/icon.*` and
  `resources/icon.icon/**`, not the `rox-logos/` directory, but R.3 still
  requires the contract to remain green.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `.swarm/master-roadmap-log.md`
- `apps/electron/resources/AGENTS.md`
- `apps/electron/resources/rox-logos/*`
- `apps/electron/src/renderer/assets/rox_logo_c.svg`
- `apps/electron/scripts/afterPack.cjs`
- `apps/electron/electron-builder.yml`
- `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`

## 4. Tests added first

Added `scripts/__tests__/rebrand-asset-paths.test.ts` before implementation.
The T267 test asserts:

- legacy `apps/electron/resources/rox-logos/*` PNG paths do not exist;
- legacy `apps/electron/src/renderer/assets/rox_logo_c.svg` does not exist;
- canonical `apps/electron/resources/rox-logos/*` PNG paths exist;
- canonical `apps/electron/src/renderer/assets/rox_logo_c.svg` exists;
- `apps/electron/resources/AGENTS.md` names `rox-logos/`, not
  `rox-logos/`.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-asset-paths.test.ts`
- Result: exit 1.
- Expected failure: `legacy logo asset paths should be renamed`, with the
  received list containing all four `apps/electron/resources/rox-logos/*`
  PNG paths plus `apps/electron/src/renderer/assets/rox_logo_c.svg`.

## 6. Implementation changes

- Renamed:
  - `apps/electron/resources/rox-logos/rox_app_icon.png` ->
    `apps/electron/resources/rox-logos/rox_app_icon.png`
  - `apps/electron/resources/rox-logos/rox_app_icon_dark.png` ->
    `apps/electron/resources/rox-logos/rox_app_icon_dark.png`
  - `apps/electron/resources/rox-logos/rox_logo_black.png` ->
    `apps/electron/resources/rox-logos/rox_logo_black.png`
  - `apps/electron/resources/rox-logos/rox_logo_white.png` ->
    `apps/electron/resources/rox-logos/rox_logo_white.png`
  - `apps/electron/src/renderer/assets/rox_logo_c.svg` ->
    `apps/electron/src/renderer/assets/rox_logo_c.svg`
- Updated `apps/electron/resources/AGENTS.md` to document `rox-logos/`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-asset-paths.test.ts`
- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- `git ls-files | rg 'apps/electron/resources/rox-logos|rox_app_icon|rox_logo_black|rox_logo_white|apps/electron/src/renderer/assets/rox_logo_c\\.svg'`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-asset-paths.test.ts`: 1 pass, 0 fail,
  3 assertions.
- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`: 3 pass,
  0 fail, 12 assertions.
- `git ls-files` old-logo-path grep: exit 1 with no matches, proving old
  tracked logo paths are gone.

## 9. Build output summary

Not run for T267 alone. R.3 phase closeout will run `bun run build` after T268
lands because T268 updates packaged resource references used by the build.

## 10. Remaining risks

- Broader `rox-agent` command, package-scope, and environment-variable
  findings remain outside T267 and are owned by later rebrand phases.
- `bun run validate:rebrand` is expected to remain red until later phases.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves logo asset path gap | Pass | Red exit 1 on legacy logo asset paths before implementation |
| Logo asset paths use canonical names | Pass | R.3 asset-path regression test passes |
| Active references use canonical paths | Pass | `apps/electron/resources/AGENTS.md` now names `rox-logos/` |
| Icon contract remains green | Pass | Liquid Glass icon contract test passes |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This ticket is committed as the T267 implementation commit in git history |
