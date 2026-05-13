# T209 - Liquid Glass checkout mtime skew Worklog

## 1. Task summary

Repair the macOS Liquid Glass freshness contract so C4 final validation is not
blocked by same-checkout sub-second mtime skew.

## 2. Repo context discovered

- `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts` compares source
  mtimes directly against `apps/electron/resources/Assets.car`.
- `apps/electron/scripts/afterPack.cjs` uses the same direct comparison before
  deciding whether to ship the precompiled Liquid Glass asset.
- Current Linux checkout has `Assets.car` at `2026-05-09 10:43:35.422...` and
  icon sources at `2026-05-09 10:43:35.444...`, a 22 ms skew.
- `xcrun/actool` is not available in this Linux environment, so regenerating
  `Assets.car` locally is not possible here.

## 3. Files inspected

- `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- `apps/electron/scripts/afterPack.cjs`
- `apps/electron/README.md`
- `docs/tickets/T116-liquid-glass-icon-freshness.md`
- `docs/worklog/T116-liquid-glass-icon-freshness.md`
- `apps/electron/resources/AGENTS.md`

## 4. Tests added first

Existing red contract test is the primary failing validation. The contract will
also assert that `afterPack` uses the checkout-skew tolerance.

## 5. Expected failing test output

```text
bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts
```

Expected red state:

```text
Expected staleSources to equal []
Received:
apps/electron/resources/icon.svg
apps/electron/resources/icon.png
apps/electron/resources/icon.icon/icon.json
apps/electron/resources/icon.icon/Assets/icon.svg
apps/electron/resources/icon.icon/Assets/icon.png
```

## 6. Implementation changes

- Added a 1000 ms checkout mtime-skew tolerance to the contract test.
- Added the same `ICON_SOURCE_MTIME_SKEW_MS = 1000` guard to
  `apps/electron/scripts/afterPack.cjs`.
- Extended the contract test so it fails if `afterPack` stops using the same
  tolerance.
- Did not change icon artwork, source files, or compiled `Assets.car` content.

## 7. Validation commands run

- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- `git diff -- apps/electron/resources/Assets.car apps/electron/resources/icon.svg apps/electron/resources/icon.png apps/electron/resources/icon.icon/icon.json apps/electron/resources/icon.icon/Assets/icon.svg apps/electron/resources/icon.icon/Assets/icon.png --stat`

## 8. Passing test output summary

- `mac-liquid-glass-icon-contract.test.ts`: 3 pass, 0 fail, 12 expects.
- Icon resource diff stat was empty.

## 9. Build output summary

No runtime build was run for this narrow packaging-hook repair yet. Final C4
validation will run after the remaining full-suite blocker is repaired.

## 10. Remaining risks

- The 1000 ms tolerance is intentionally narrow: it removes same-checkout
  false positives while still catching real stale assets whose sources changed
  after the compiled catalog by more than one second.
- `Assets.car` was not regenerated because `xcrun/actool` is unavailable in
  this Linux environment.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Contract test passes on Linux checkout | Pass | 3 pass, 0 fail |
| `afterPack` uses the same tolerance as the contract | Pass | Contract asserts the constant and comparison expression |
| Icon sources and compiled icon content unchanged | Pass | Empty icon resource diff stat |
| Worklog complete | Pass | This file |
| Commit created | Pass | This ticket commit |
