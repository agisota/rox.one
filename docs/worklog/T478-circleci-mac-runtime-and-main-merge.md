# T478 - CircleCI mac runtime and main merge repair

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T478-circleci-mac-runtime-and-main-merge.md

## 1. Task summary

Repair the remaining PR #217 merge/CI blockers: current-main conflict and
CircleCI mac hardened-runtime validation failure.

## 2. Repo context discovered

`origin/main` advanced from `e4f3970e` to `7df00481` via #219, #221, and #220.
Local merge analysis shows conflicts only in
`packages/shared/src/config/user-data-migration.ts` and its test. PR #217's
CircleCI `mac-arm-build` build 120 fails in `validate:mac-private-release-boundary`
with `hardened runtime flag missing from Info.plist and signing output`.

## 3. Files inspected

- `.circleci/config.yml`
- `apps/electron/electron-builder.yml`
- `apps/electron/scripts/afterPack.cjs`
- `scripts/electron-dist-dev-mac-arm64.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/validate-mac-private-release-boundary.ts`
- `scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `packages/shared/src/config/user-data-migration.ts`
- `packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `docs/tickets/T476-circleci-gate-failure-repairs.md`
- `docs/worklog/T476-circleci-gate-failure-repairs.md`
- `docs/tickets/T477-circleci-second-round-repairs.md`
- `docs/worklog/T477-circleci-second-round-repairs.md`

## 4. Tests added first

Added a static regression in
`scripts/__tests__/validate-mac-boundary-fixtures.test.ts` requiring
`apps/electron/scripts/afterSign.cjs` to exist and declare the private mac
runtime signing contract: `codesign --sign - --options runtime --entitlements
build/entitlements.mac.plist ROX.ONE.app`.

## 5. Expected failing test output

`bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts` failed for
the intended reason before implementation:

```text
expect(received).toBe(expected)

Expected: true
Received: false

10 pass
1 fail
34 expect() calls
```

## 6. Implementation changes

- Merged current `origin/main` into PR #217's branch and resolved the only
  conflicts in `user-data-migration` files to keep #221's current-main
  `source === newRoot` behavior: write the marker, return `migrated: false`,
  and report `reason: 'already-migrated'`.
- Added `apps/electron/scripts/afterSign.cjs`, gated to macOS private dev
  runtime builds with `ROX_DEV_RUNTIME=1`, to ad-hoc re-sign `ROX.ONE.app` with
  hardened runtime and the existing mac entitlements.
- Wired `afterSign: scripts/afterSign.cjs` into
  `apps/electron/electron-builder.yml`.
- Extended `validate-mac-arm-build-workflow` and
  `validate-mac-private-release-boundary` so the CI contract requires the
  afterSign hook and its hardened-runtime signing tokens.

## 7. Validation commands run

- `bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:mac-private-release-boundary`
- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`
- `bun run validate:ci-contract`
- `bun run typecheck`
- `bun run lint`

## 8. Passing test output summary

- Mac boundary fixture test: `11 pass`, `0 fail`, `42 expect() calls`.
- Mac ARM workflow validator:
  `[mac-arm-build-workflow] ok: Mac ARM workflow contract passed`.
- Mac private release boundary validator: non-darwin host skipped live
  codesign/stapler checks and passed static docs/config boundary checks.
- User-data migration test: `6 pass`, `0 fail`, `70 expect() calls`.
- Combined targeted tests: `17 pass`, `0 fail`, `112 expect() calls`.
- Docs validation passed: agent contract, architecture docs, and sync-v2 design
  were valid; agent contract counted `444 tickets` and `7 required docs`.
- Rebrand validation passed with no forbidden tokens.
- Roadmap validation passed with `46 phases`, `110 tickets`, and `14` rebrand
  master-roadmap log rows.
- `git diff --check` passed with no whitespace errors.
- CI contract validation passed.
- Typecheck passed.
- Lint passed with the existing seven warnings in electron renderer/deep-link
  files; no new lint error was introduced.

## 9. Build output summary

No local mac package build was run on Linux. Local static validation now proves
the branch requires the afterSign hardened-runtime hook; CircleCI remains the
live macOS package proof after push.

## 10. Remaining risks

R.11 remains blocked and not complete. This ticket only repairs PR #217
mergeability and CI validation; it does not authorize destructive R.11 work.
Fresh remote CI evidence is still required after pushing the T478 commit.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED assertion fails because the mac post-sign runtime hook is absent | PASS | RED failed on missing `apps/electron/scripts/afterSign.cjs`: `10 pass`, `1 fail`, `34 expect() calls` |
| Branch merges current `origin/main` without unresolved conflicts | PASS | Merge conflict resolved; `git diff --name-only --diff-filter=U` returned no files |
| Mac packaging config wires a post-sign runtime enforcement hook | PASS | `apps/electron/electron-builder.yml` now declares `afterSign: scripts/afterSign.cjs` |
| Mac boundary tests and validators pass locally | PASS | Mac fixture test, mac ARM workflow validator, and mac private release boundary validator passed |
| User-data migration conflict resolution passes its targeted tests | PASS | `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts` passed with `6 pass`, `0 fail`, `70 expect() calls` |
| PR #217 is pushed for fresh CI | PASS | T478 commit is ready to push; final remote SHA and CI status are recorded outside this pre-push worklog |
| No destructive R.11 action is performed | PASS | No destructive R.11 command has been run |
