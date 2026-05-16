# T524 - Release-all-platforms review blocker repair

## 1. Task summary

Repair the remaining PR #248 all-platforms release workflow review blockers:
Windows log path traversal above the repo, credential persistence during build,
and disabled packaged-artifact validation.

## 2. Repo context discovered

- The unified workflow runs Mac, Linux, and Windows packaging in a matrix, then
  publishes artifacts to one draft GitHub Release.
- Linux is explicitly unsigned in this workflow, unlike
  `.github/workflows/linux-signed-release.yml`.
- `scripts/validate-packaged-artifacts.ts` already scopes by platform and was
  independently updated to default Linux AppImage artifacts to `x86_64`, but it
  still requires `.AppImage.sig` in unsigned mode.
- Windows unsigned workflow patterns use `..\..\.ci-logs` from
  `apps/electron`; PR #248 used `..\..\..\.ci-logs`.

## 3. Files inspected

- `.github/workflows/release-all-platforms.yml`
- `.github/workflows/windows-unsigned-release.yml`
- `.github/workflows/linux-signed-release.yml`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `docs/tickets/T503-packaged-artifacts-multi-platform.md`
- `docs/worklog/T503-packaged-artifacts-multi-platform.md`

## 4. Tests added first

- Added `passes unsigned Linux validation without AppImage signature sidecar`
  to `scripts/__tests__/validate-packaged-artifacts.test.ts`.
- Added `fails signed Linux validation when AppImage signature is missing` so
  unsigned-mode relaxation cannot weaken the signed Linux release contract.
- Ran a static workflow blocker check before implementation to prove the
  workflow still had the review blockers.

## 5. Expected failing test output

Targeted RED validator output before implementation:

```text
Expected: 0
Received: 1
(fail) unsigned mode (ROX_RC_MODE=unsigned) > passes unsigned Linux validation without AppImage signature sidecar
```

Static RED workflow output before implementation:

```text
windows log paths escape repo with ..\..\..\.ci-logs
checkout does not disable persisted credentials
packaged artifact validation remains commented out
missing packaged artifact validation for Mac
missing packaged artifact validation for Linux
```

## 6. Implementation changes

- Split Linux packaged artifact requirements into signed and unsigned lists in
  `scripts/validate-packaged-artifacts.ts`.
- Kept signed Linux validation strict: `.AppImage` plus `.AppImage.sig`.
- Allowed unsigned Linux validation to skip `.AppImage.sig` while still
  checking `.AppImage` and, when `ROX_LINUX_DEB_RPM=true`, `.deb` and `.rpm`.
- Re-enabled packaged artifact validation in
  `.github/workflows/release-all-platforms.yml` for Mac, Linux, and Windows
  with platform-scoped env vars.
- Set `persist-credentials: false` on the checkout of the release tag.
- Corrected Windows `apps/electron` log paths from `..\..\..\.ci-logs` to
  `..\..\.ci-logs`.

## 7. Validation commands run

- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- Static workflow blocker check.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release-all-platforms.yml'); puts 'workflow yaml parses'"`
- `ruby -e "require 'yaml'; Dir['.github/workflows/*.{yml,yaml}'].sort.each { |f| YAML.load_file(f); puts f }"`
- `git diff --check`
- `bun run validate:ci-contract`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:rebrand`
- `bun run validate:docs`

## 8. Passing test output summary

- Packaged artifact validator tests: `18 pass`, `0 fail`, `53 expect()`
  calls.
- Static workflow check printed:
  `release-all-platforms static review blockers clear`.
- YAML parser loaded all GitHub workflow YAML files, including
  `.github/workflows/release-all-platforms.yml`.
- `bun run validate:ci-contract` printed:
  `[ci-contract] ok: workflow, package scripts, and validator fixture checks passed`.
- `bun run validate:mac-arm-build-workflow` printed:
  `[mac-arm-build-workflow] ok: Mac ARM workflow contract passed`.
- `bun run validate:rebrand` printed:
  `rebrand validation passed: no forbidden tokens outside the allowlist`.
- `bun run validate:docs` printed:
  `[agent-contract] ok: 11 skills, 480 tickets, 7 required docs`.
- `git diff --check` exited 0.

## 9. Risks and follow-ups

- The all-platforms release workflow itself still needs hosted execution on
  GitHub runners; local validation is static plus focused validator tests.

## 10. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| RED validator test fails before implementation | PASS | Targeted test failed on unsigned Linux missing signature |
| RED workflow static check fails before implementation | PASS | Static check listed Windows path, checkout credentials, and disabled validation blockers |
| Unsigned Linux validation passes without `.AppImage.sig` | PASS | Targeted test suite includes unsigned Linux no-signature pass case |
| Signed Linux validation still requires `.AppImage.sig` | PASS | Targeted test suite includes signed Linux missing-signature fail case |
| Unified workflow validates all three platforms before publish | PASS | Workflow has Mac/Linux/Windows `Validate packaged artifact metadata` steps before publish |
| Windows log paths stay inside repo | PASS | Static check rejects `..\..\..\.ci-logs` and passed |
| Checkout credential persistence disabled | PASS | Static check requires `persist-credentials: false` and passed |
| Validation commands pass | PASS | Targeted tests, static check, YAML parse, CI contract, Mac workflow, rebrand, docs, diff check |
| Worklog complete | PASS | This 11-section worklog records RED, implementation, validation, and risks |
| Commit created | PASS | This commit lands T524 |

## 11. Final notes

This is a PR #248 release-workflow repair only. It does not execute R.11
backup, filter-repo, tag retargeting, or force-push steps.
