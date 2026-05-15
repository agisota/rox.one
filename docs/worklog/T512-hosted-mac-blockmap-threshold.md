# T512 - Hosted Mac blockmap validator threshold

Status: DONE
Phase: RC2 post-merge stabilization
Ticket: docs/tickets/T512-hosted-mac-blockmap-threshold.md

## 1. Task summary

Fix the PR #247 hosted Mac ARM package failure by replacing the synthetic 1 MB
blockmap threshold with a threshold that real electron-builder blockmaps satisfy
while preserving empty/truncated artifact detection.

## 2. Repo context discovered

- PR #247 was mergeable after pushing merge commit `dfd5dd14`.
- GitHub Actions run `25946678796`, job `76276088235`, failed in
  `Validate packaged artifact metadata`.
- The failure was:
  `ROX-ONE-arm64.dmg.blockmap is 234.64 KB, expected >= 1.00 MB`.
- Earlier release worklogs recorded successful Mac blockmaps around
  315-343 KB, which confirms `.blockmap >= 1 MB` was not a stable release
  contract.
- The validator already had a zero-byte negative test for blockmaps, so the
  hosted failure could be covered by a focused positive regression.

## 3. Files inspected

- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `.github/workflows/mac-arm-build.yml`
- `docs/tickets/T503-packaged-artifacts-multi-platform.md`
- `docs/worklog/T503-packaged-artifacts-multi-platform.md`
- GitHub Actions job log for run `25946678796`.

## 4. Tests added first

Added `passes Mac validation with hosted-sized blockmaps below 1 MB`, which
builds a Mac fixture with 235 KB `.dmg.blockmap` and `.zip.blockmap` files and
expects unsigned Mac validation to pass.

## 5. Expected failing test output

Before implementation:

```text
Expected: 0
Received: 1
(fail) unsigned mode (ROX_RC_MODE=unsigned) > passes Mac validation with hosted-sized blockmaps below 1 MB
```

The other 15 packaged-artifacts tests still passed, proving the new failure was
isolated to the hosted-sized blockmap case.

## 6. Implementation changes

- Added named threshold constants in `scripts/validate-packaged-artifacts.ts`.
- Kept primary artifacts at 50 MB.
- Lowered `.blockmap` artifacts to 128 KB.
- Kept metadata files and `.AppImage.sig` at presence-only validation.
- Updated the T503 ticket and worklog to document the corrected `.blockmap`
  threshold.

## 7. Validation commands run

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `bun run validate:mac-arm-build-workflow`

## 8. Passing test output summary

- Packaged-artifacts validator tests: 16 pass, 0 fail.
- Mac ARM workflow contract: passed.

## 9. Build output summary

No local application build was run for this threshold-only repair. The failing
evidence came from the hosted Mac ARM package job after it built and packaged
the app successfully.

## 10. Remaining risks

- The hosted Mac ARM job must be rerun by pushing this branch update.
- Native macOS packaging is still not reproducible on this Linux host.
- The validator still checks blockmap size rather than parsing blockmap JSON.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Hosted-sized Mac blockmap regression exists | PASS | New 235 KB Mac blockmap test failed before implementation. |
| Regression passes after fix | PASS | Targeted test file reports 16 pass, 0 fail. |
| Empty blockmaps still fail | PASS | Existing zero-byte blockmap negative test remains green. |
| Mac ARM workflow contract unchanged | PASS | `bun run validate:mac-arm-build-workflow` passed. |
| T503 threshold docs updated | PASS | T503 ticket/worklog now state `.blockmap >= 128 KB`. |
