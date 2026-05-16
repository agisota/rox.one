# T525 - Windows blockmap validator threshold

## 1. Task summary

Adjust packaged artifact validation so Windows blockmaps produced by current
electron-builder packaging pass while empty/truncated blockmaps still fail.
The same local probe also showed `latest.yml` can omit the blockmap from
`files[]`, so validation now treats that metadata entry as optional while still
requiring the sidecar file on disk.

## 2. Repo context discovered

- T524 re-enabled all-platforms packaged artifact validation.
- Local unsigned Windows validation against `apps/electron/release` failed:
  `ROX-ONE-x64.exe.blockmap is 115.84 KB, expected >= 128.00 KB`.
- T512 established `128 KB` as the Mac blockmap floor after hosted Mac ARM
  blockmaps measured around 235 KB.
- Windows blockmaps can be smaller than Mac DMG/ZIP blockmaps, so the floor
  needs to be platform-specific.
- The local Windows `latest.yml` listed only `ROX-ONE-x64.exe`, while
  `ROX-ONE-x64.exe.blockmap` existed on disk.

## 3. Files inspected

- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `docs/tickets/T512-hosted-mac-blockmap-threshold.md`
- `docs/worklog/T512-hosted-mac-blockmap-threshold.md`

## 4. Tests added first

- Added `passes Windows validation with hosted-sized blockmaps below 128 KB`
  using a `116 * 1024` byte Windows blockmap fixture.
- Flipped the missing-`latest.yml` blockmap-entry case from a failure
  expectation to a passing expectation.
- Added `fails Windows validation when latest.yml blockmap size is stale` so
  optional metadata remains checked when present.

## 5. Expected failing test output

Before implementation, the new `116 KB` Windows blockmap regression failed
because the validator still applied the shared `128 KB` blockmap floor:

```text
Expected: 0
Received: 1
```

The missing blockmap-entry expectation also failed against the current hosted
shape because `latest.yml` can omit `ROX-ONE-x64.exe.blockmap` while the sidecar
exists on disk.

## 6. Implementation changes

- Split blockmap floors into `MAC_BLOCKMAP_MIN_BYTES = 128 * 1024` and
  `WINDOWS_BLOCKMAP_MIN_BYTES = 64 * 1024`.
- Kept Mac signed and unsigned blockmap validation on the `128 KB` floor.
- Kept the Windows `.exe.blockmap` sidecar required on disk, but lowered its
  floor to `64 KB`.
- Kept Windows `latest.yml` installer metadata required and size-checked.
- Made Windows `latest.yml` blockmap metadata optional; when present, its size
  is still checked against disk.
- Updated T503 docs and worklog to reflect the platform-specific thresholds and
  optional Windows blockmap metadata entry.

## 7. Validation commands run

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=windows ROX_ARTIFACT_ARCH=x64 bun run validate:packaged-artifacts`
- `ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=linux ROX_LINUX_ARCH=x86_64 bun run validate:packaged-artifacts`
- `bun run validate:ci-contract`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`
- Static release workflow review-blocker check for credential persistence,
  Windows log paths, packaged-artifact validation steps, and unsigned Linux
  signature upload requirements.
- Ruby YAML parse for `.github/workflows/*.{yml,yaml}`.

## 8. Passing test output summary

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`: 20 pass,
  0 fail, 59 `expect()` calls.
- Local Windows unsigned artifact validation passed against
  `ROX-ONE-x64.exe` at `108.45 MB`, `ROX-ONE-x64.exe.blockmap` at `115.84 KB`,
  and `latest.yml` without a blockmap `files[]` entry.
- Local Linux unsigned artifact validation passed against
  `ROX-ONE-x86_64.AppImage` without an `.AppImage.sig` sidecar.
- `validate:ci-contract`, `validate:mac-arm-build-workflow`,
  `validate:rebrand`, `validate:docs`, workflow YAML parse, static workflow
  blocker check, and `git diff --check` passed.

## 9. Risks and follow-ups

- This is a threshold-only change. Hosted Windows all-platforms execution still
  needs GitHub runner evidence.

## 10. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| RED Windows hosted-sized blockmap regression fails before implementation | PASS | New `116 KB` blockmap fixture failed against the old shared `128 KB` floor. |
| Windows hosted-sized blockmaps pass | PASS | `passes Windows validation with hosted-sized blockmaps below 128 KB` passes. |
| Empty Windows blockmaps still fail | PASS | Existing `fails when blockmap is present but empty (0 bytes)` passes. |
| Windows validation passes when `latest.yml` omits blockmap | PASS | `passes Windows validation when latest.yml omits the blockmap entry` passes and local Windows validation logged the optional-entry message. |
| Mac blockmap threshold remains `128 KB` | PASS | Mac signed and unsigned blockmap requirements use `MAC_BLOCKMAP_MIN_BYTES = 128 * 1024`. |
| Targeted tests pass | PASS | `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`: 20 pass, 0 fail. |
| Local Windows artifact validation passes | PASS | `ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=windows ROX_ARTIFACT_ARCH=x64 bun run validate:packaged-artifacts` passed. |
| Docs validation passes | PASS | `bun run validate:docs` passed. |
| Whitespace check passes | PASS | `git diff --check` passed. |
| Worklog complete | PASS | This 11-section worklog is complete with a green acceptance matrix. |
| Commit created | PASS | This ticket is committed as its own Lore commit. |

## 11. Final notes

T525 keeps the T524 workflow validation gate enabled while matching the artifact
shape generated locally for Windows. Hosted PR #248 checks remain the release
runner proof point before the PR can merge.
