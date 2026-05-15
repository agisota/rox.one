# T512 - Hosted Mac blockmap validator threshold

Status: DONE
Phase: RC2 post-merge stabilization
Owner: agent-executor

## Summary

Repair the packaged-artifacts validator after the hosted Mac ARM package job
proved real electron-builder blockmaps are smaller than the old 1 MB synthetic
fixture threshold.

## Background

PR #247 became mergeable after the post-main merge commit, but the GitHub
Actions Mac ARM package job failed at `Validate packaged artifact metadata`.
The built `ROX-ONE-arm64.dmg.blockmap` was 234.64 KB, while the validator
required every `.blockmap` file to be at least 1 MB.

Historical release worklogs already show Mac blockmaps around 315-343 KB, so
the 1 MB threshold was a fixture artifact rather than a production invariant.

## Scope

- Keep primary installer/archive thresholds at 50 MB.
- Lower only `.blockmap` thresholds to a realistic non-trivial floor.
- Keep zero-byte blockmap detection red.
- Add regression coverage for hosted-sized Mac blockmaps below 1 MB.
- Update the T503 contract text so future agents do not restore the bad floor.

## Acceptance Criteria

- [x] `bun test scripts/__tests__/validate-packaged-artifacts.test.ts` fails
      before implementation for a 235 KB Mac blockmap fixture.
- [x] The same test passes after lowering the blockmap threshold.
- [x] Empty blockmaps still fail validation.
- [x] `bun run validate:mac-arm-build-workflow` still passes.
- [x] T503 ticket/worklog size-threshold documentation reflects the hosted
      threshold repair.
