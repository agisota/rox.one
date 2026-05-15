# T502 - Windows unsigned-release workflow worklog

Status: DONE
Phase: v1.0.0-rc.2 A3 repair
Ticket: docs/tickets/T502-windows-unsigned-release-workflow.md

## 1. Task summary

Patch the Windows unsigned-release workflow review blockers. The owned scope is
`.github/workflows/windows-unsigned-release.yml`,
`docs/tickets/T502-windows-unsigned-release-workflow.md`, and this worklog.

## 2. Repo context discovered

The merged PR branch added `.github/workflows/windows-unsigned-release.yml` and
`docs/tickets/T502-windows-unsigned-release-workflow.md`. The workflow
validated the tag after the initial checkout but did not switch the build to
the validated tag, ran Electron build/package commands from the repository
root, did not run the existing Windows boundary validators, and uploaded broad
`*.exe` globs even though `apps/electron/electron-builder.yml` declares
`win.artifactName: "ROX-ONE-${arch}.${ext}"`.

## 3. Files inspected

- `.github/workflows/windows-unsigned-release.yml`
- `docs/tickets/T502-windows-unsigned-release-workflow.md`
- `apps/electron/package.json`
- `apps/electron/electron-builder.yml`
- `scripts/validate-windows-private-release-boundary.ts`
- `scripts/validate-windows-boundary-fixtures.ts`
- `package.json`

## 4. Tests added first

No new validator source files were added because this patch is constrained to
the workflow and docs. RED coverage used a targeted pre-fix grep and
missing-file check before implementation.

## 5. Expected failing test output

Pre-fix RED check:

```text
MISSING docs/worklog/T502-windows-unsigned-release-workflow.md
```

Pre-fix grep also showed the wrong patterns:

```text
docs/tickets/T502-windows-unsigned-release-workflow.md:11:ROX-ONE-Setup-*.exe + latest.yml for v1.0.0-rc.2 distribution.
.github/workflows/windows-unsigned-release.yml:101:          bun run build:win *>&1 | Tee-Object -FilePath .ci-logs\windows-unsigned-release\electron-build.log
.github/workflows/windows-unsigned-release.yml:112:          bunx electron-builder --win --x64 --publish=never *>&1 | Tee-Object -FilePath .ci-logs\windows-unsigned-release\electron-builder.log
.github/workflows/windows-unsigned-release.yml:143:            apps/electron/release/*.exe
```

## 6. Implementation changes

- Added `fetch-depth: 0`, kept the untrusted input in env, and checked out
  `refs/tags/$RELEASE_TAG` after regex validation.
- Added `bun run validate:windows-boundary-fixtures` before the Electron build.
- Ran `bun run build:win` and `bunx electron-builder --win --x64 --publish=never`
  from `apps/electron`, where those package scripts and `electron-builder.yml`
  live.
- Added `bun run validate:windows-private-release-boundary` after packaging.
- Replaced broad upload/checksum globs with canonical required artifacts:
  `ROX-ONE-x64.exe`, `ROX-ONE-x64.exe.blockmap`, and `latest.yml`.
- Updated the T502 ticket summary to match the electron-builder artifact name.

## 7. Validation commands run

- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run validate:windows-boundary-fixtures`
- `bun run validate:windows-private-release-boundary`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/windows-unsigned-release.yml'); puts 'yaml ok'"`
- `git diff --check`
- `command -v actionlint || true`

## 8. Passing test output summary

- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 466 tickets, 7 required docs`
- `bun run validate:docs`: agent contract, architecture docs, and sync-v2 design validators passed.
- `bun run validate:windows-boundary-fixtures`: good fixture passed; bad fixture failed as expected.
- `bun run validate:windows-private-release-boundary`: non-win32 host skipped live signtool checks and passed static docs/config boundary checks.
- Workflow YAML parse: `yaml ok`.
- `git diff --check`: passed with no whitespace errors.
- `actionlint`: not installed in this worktree environment, so no actionlint check was available.

## 9. Build output summary

No local Windows Electron packaging build was run from Linux. The workflow
change is validated by static checks and repository validators.

## 10. Remaining risks

Local validation cannot execute the GitHub Actions Windows runner or produce a
real NSIS artifact in this Linux worktree. The workflow-level risk is bounded
by static YAML parsing, the repo agent/docs validators, the existing Windows
boundary validators wired into CI, and explicit artifact existence checks in
the workflow.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Checkout/build use validated release tag | Done | Workflow validates `inputs.tag`, writes `RELEASE_TAG`, fetches, checks out, and exact-match verifies the tag before install/build. |
| Build runs from correct Electron cwd or valid script | Done | Build and package steps `Push-Location apps\electron` before `build:win` and `electron-builder`. |
| Windows boundary validators are present | Done | Workflow runs `validate:windows-boundary-fixtures` and `validate:windows-private-release-boundary`. |
| Artifact naming matches electron-builder | Done | Workflow requires/uploads `ROX-ONE-x64.exe`, `ROX-ONE-x64.exe.blockmap`, and `latest.yml`. |
| T502 worklog exists | Done | This file records context, RED evidence, implementation, validation, and risks. |
