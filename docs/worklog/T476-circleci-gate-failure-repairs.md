# T476 - CircleCI gate failure repairs

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T476-circleci-gate-failure-repairs.md

## 1. Task summary

Repair the CircleCI gate failures surfaced after T475 so PR #217 and stacked
PR #218 can be revalidated on current branch heads.

## 2. Repo context discovered

CircleCI reached real job steps. Linux validation failed because Bun 1.3.10
ran DOM-scoped RTL files under `bun:test` despite `bunfig.toml`
`pathIgnorePatterns`; local validation had already passed on Bun 1.3.13.
CircleCI Gitleaks scanned 1672 historical commits and failed on known test
fixtures instead of just the PR diff. macOS e2e startup exposed
`ERR_FS_CP_EINVAL` from copying `/Users/distiller/.rox` onto itself. mac ARM
packaging reached electron-builder and failed schema validation for stale
`linux.desktop` and `win.publisherName` keys.

## 3. Files inspected

- `.circleci/config.yml`
- `bunfig.toml`
- `package.json`
- `scripts/electron-smoke.ts`
- `scripts/e2e-core-scenarios.ts`
- `scripts/electron-dist-dev-mac-arm64.ts`
- `apps/electron/electron-builder.yml`
- `packages/shared/src/config/user-data-migration.ts`
- `packages/shared/src/config/__tests__/user-data-migration.test.ts`

## 4. Tests added first

Added a user-data migration regression covering the case where canonical
`~/.rox` is the only discovered source and destination. The expected behavior
is a no-copy no-op with a marker, not `cpSync(source, source)`.

## 5. Expected failing test output

The failing remote evidence was CircleCI build 29:

```text
[user-data-migration] starting copy from /Users/distiller/.rox -> /Users/distiller/.rox
Unhandled rejection ... {"code":"ERR_FS_CP_EINVAL"}
```

The new local regression would fail on the previous implementation for the
same self-copy path.

## 6. Implementation changes

- Updated CircleCI Bun install from `bun-v1.3.10` to `bun-v1.3.13`.
- Kept the CircleCI default `build` job but narrowed it to docs and CI-contract
  validation; the named `validate` job remains the full validation suite.
- Changed CircleCI Gitleaks to scan changed files relative to
  `ROX_GITLEAKS_BASE_REF` instead of full repository history.
- Added a `source === newRoot` guard to user-data migration.
- Moved Linux desktop metadata under electron-builder's `linux.desktop.entry`
  schema and removed invalid `win.publisherName`.
- Added this T476 ticket and worklog.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun -e "import fs from 'node:fs'; import yaml from 'js-yaml'; const cfg = yaml.load(fs.readFileSync('.circleci/config.yml','utf8')); if (!cfg?.jobs?.build || !cfg?.jobs?.validate || !cfg?.jobs?.['secret-scan']) throw new Error('invalid CircleCI config shape'); console.log(Object.keys(cfg.jobs).join(','));"`
- `git diff --check`
- `bun run validate:docs`
- `bun run validate:ci-contract`
- `bun run validate:linux-deb-rpm`
- `bun run validate:windows-private-release-boundary`
- `bun run validate:mac-arm-build-workflow`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- Docker Gitleaks changed-file scan

## 8. Passing test output summary

`bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
passed: 6 tests, 0 failures, 69 assertions.

YAML parse output listed all CircleCI jobs:

```text
build,validate,secret-scan,e2e-core,mac-arm-build
```

`bun run validate:docs` passed: 11 skills, 442 tickets, 7 required docs; 4
architecture docs with 10 subsystem headings; sync-v2 design validated.

`bun run validate:ci-contract` passed:

```text
[ci-contract] ok: workflow, package scripts, and validator fixture checks passed
```

`bun run validate:linux-deb-rpm` passed: deb + rpm targets present alongside
AppImage; category, synopsis, and maintainer non-empty; top-level package
blocks present.

`bun run validate:windows-private-release-boundary` passed on this non-win32
host with live signtool checks skipped.

`bun run validate:mac-arm-build-workflow` passed.

`bun run typecheck` passed.

`bun run lint` passed with the existing 7-warning profile and 0 errors.

`bun run validate:rebrand` passed with no forbidden tokens outside the
allowlist.

`bun run validate:roadmap` passed: 46 phases, 110 tickets across detail files,
14 rebrand master-roadmap log rows.

Docker Gitleaks changed-file scan passed: scanned 34.75 KB and found no leaks.

## 9. Build output summary

No local mac ARM package build has been run in this Linux worktree; CircleCI is
the remote macOS validation surface.

## 10. Remaining risks

CircleCI macOS jobs can still fail for environment-only issues, signing
entitlements, or package-specific smoke failures after the schema and self-copy
repairs. The GitHub Actions billing lock remains external to this codebase.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| CircleCI uses Bun 1.3.13 | PASS | `.circleci/config.yml` |
| CircleCI default `build` trigger stays lightweight and greenable | PASS | `jobs.build` runs docs + CI contract |
| CircleCI secret scan checks changed files instead of full historical fixture corpus | PASS | `ROX_GITLEAKS_BASE_REF` diff scan |
| User-data migration no longer copies canonical `~/.rox` onto itself | PASS | Targeted migration regression passed |
| electron-builder config is schema-compatible for mac ARM validation | PASS | Linux, Windows, and Mac ARM static validators passed |
