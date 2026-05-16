# T525 - Windows blockmap validator threshold

Status: DONE

## Context

After T524 re-enabled packaged artifact validation in the unified all-platforms
release workflow, a local Windows artifact validation probe failed because the
existing `ROX-ONE-x64.exe.blockmap` is `115.84 KB`, below the shared
`128 KB` blockmap threshold.

## Goal

Keep Windows packaged artifact validation enabled without rejecting legitimate
hosted Windows blockmaps. Lower only the Windows blockmap threshold while
preserving Mac's hosted-proven `128 KB` floor and zero-byte rejection. Treat
the Windows blockmap `latest.yml` entry as optional because electron-builder can
produce the sidecar without listing it in update metadata.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`

## Required Subagents

None.

## TDD Requirements

Before implementation, add a Windows validation regression with a `116 KB`
blockmap and confirm it fails under the current shared `128 KB` threshold.

## Implementation Requirements

- Keep Mac blockmap threshold at `128 KB`.
- Set Windows blockmap threshold low enough for the observed `115.84 KB`
  artifact while keeping empty/truncated blockmaps rejected.
- Require the Windows blockmap file on disk, but only compare `latest.yml`
  blockmap size metadata when the metadata entry exists.
- Do not change runtime source files.

## Validation Commands

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=windows ROX_ARTIFACT_ARCH=x64 bun run validate:packaged-artifacts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] RED Windows hosted-sized blockmap regression fails before implementation.
- [x] Windows hosted-sized blockmaps pass.
- [x] Empty Windows blockmaps still fail.
- [x] Windows validation passes when `latest.yml` omits the blockmap entry.
- [x] Mac blockmap threshold remains `128 KB`.
- [x] Targeted tests pass.
- [x] Local Windows artifact validation passes.
- [x] Docs validation passes.
- [x] Whitespace check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T525-windows-blockmap-validator-threshold.md`.
