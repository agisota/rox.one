# T340 - Origin main validation baseline repair

Status: DONE
Phase: post-merge validation repair
Ticket: docs/tickets/T340-origin-main-validation-baseline-repair.md

## 1. Task summary

Repair validation regressions present on current `origin/main` after replaying
the post-merge validation branch onto PR #96.

## 2. Repo context discovered

The failures were present in `origin/main` itself:

- `git show origin/main:packages/shared/src/agent/options.ts` showed duplicate
  `ROX_DEBUG: debugFlag` entries.
- `git show origin/main:packages/shared/src/agent/pi-agent.ts` showed duplicate
  `ROX_DEBUG: debugFlag` entries.
- `git show origin/main:packages/shared/src/utils/__tests__/env-compat.test.ts`
  showed duplicated saved-env declarations and cleanup lines.
- `scripts/validate-rebrand.cjs` now uses `legacyStem = 'rox'`, so the stricter
  token list flagged current canonical ROX-owned surfaces that were not yet
  allowlisted.
- Several rebrand unit tests still encoded earlier assumptions that current
  ROX.ONE identifiers (`ROX ONE`, `com.rox.one`, `RoxMcpClient`, icon component
  names) were forbidden.
- A new credential reload regression showed the storage backend wrote an
  8-byte magic field but compared fresh loads against a 6-byte magic buffer,
  causing the flat credential file to be deleted as corrupt.

## 3. Files inspected

- `packages/shared/src/agent/options.ts`
- `packages/shared/src/agent/pi-agent.ts`
- `packages/shared/src/utils/__tests__/env-compat.test.ts`
- `packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `packages/shared/src/credentials/backends/secure-storage.ts`
- `scripts/__tests__/community-link-audit.test.ts`
- `scripts/__tests__/r7-docker-ci-build.test.ts`
- `scripts/__tests__/rebrand-code-identifiers.test.ts`
- `scripts/validate-rebrand.cjs`

## 4. Tests added first

The first red checks were existing validation commands:

- `bun run typecheck`
- `bun run validate:rebrand`

After the full suite exposed the credential reload problem, I added:

- `packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
  coverage for reloading `DEFAULT_LOCAL_SCOPE` credentials from the existing
  flat credential file with a fresh manager instance.

## 5. Expected failing test output

`bun run typecheck` failed with:

- `TS1117: An object literal cannot have multiple properties with the same name`
  in `options.ts` and `pi-agent.ts`.
- `TS2451: Cannot redeclare block-scoped variable` in
  `env-compat.test.ts`.

`bun run validate:rebrand` failed with 110 forbidden-token findings across
current ROX-owned surfaces.

The new credential reload test failed with:

- expected `"flat-secret"`, received `null`.

The existing tenant fallback test also failed:

- expected `"legacy-flat-secret"`, received `null`.

The stale rebrand/env/migration bundle failed on:

- community-link audit self-test using a current ROX URL instead of the
  upstream fixture.
- workflow-name/appId checks blocking current `ROX ONE` / `com.rox.one`.
- code-identifier checks forbidding current Rox namespace identifiers.
- user-data migration priority test using the canonical destination as one of
  the candidate legacy roots.
- env-compat tests expecting a distinct legacy prefix that is not present on
  the current ROX.ONE branch.

## 6. Implementation changes

- Removed duplicate `ROX_DEBUG` properties from the agent subprocess env
  objects.
- Removed duplicated saved-env declarations and duplicated cleanup lines from
  the env compatibility test, then aligned the test cases with direct
  canonical `ROX_*` reads.
- Added concrete allowlists for current ROX-owned infrastructure,
  documentation, runtime, and rebrand-test surfaces that the PR #96 validator
  now checks.
- Updated stale rebrand tests so they continue blocking legacy residue while
  allowing current ROX.ONE names.
- Updated the user-data migration priority fixture so both legacy candidates
  are distinct from the canonical destination root.
- Fixed `SecureStorageBackend` magic validation by using an 8-byte magic
  buffer matching the reserved header field.

## 7. Validation commands run

- `bun run typecheck` (red)
- `bun run validate:rebrand` (red)
- `bun run typecheck`
- `bun run validate:rebrand`
- `bun run lint`
- `git diff --check`
- `bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts scripts/__tests__/community-link-audit.test.ts scripts/__tests__/r7-docker-ci-build.test.ts scripts/__tests__/rebrand-code-identifiers.test.ts packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`:
  6 pass, 0 fail, 18 expect calls.
- Combined rebrand/env/migration focused bundle:
  24 pass, 0 fail, 136 expect calls.
- Earlier static gates after duplicate/allowlist repair:
  `bun run typecheck` exit 0, `bun run validate:rebrand` exit 0,
  `bun run lint` exit 0, `git diff --check` exit 0.
- C4 targeted storage/RPC suite:
  84 pass, 0 fail, 107 expect calls.
- Documentation validators:
  `validate:docs` and `validate:roadmap` exited 0.
- Full suite:
  5592 pass, 13 skip, 0 fail, 1 snapshot, 23737 expect calls.

## 9. Build output summary

`bun run build` exited 0. Vite reported chunk-size warnings during renderer
build, but all build stages completed successfully.

## 10. Remaining risks

No known remaining test failures. The branch still needs final integration with
the latest `origin/main` before completion because `origin/main` advanced while
the local repairs were in progress.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Typecheck no longer fails on duplicate object/env declarations | Green | `bun run typecheck` exit 0 |
| Rebrand validator accepts current ROX-owned surfaces | Green | `bun run validate:rebrand` exit 0 |
| Focused rebrand/env/migration tests pass | Green | Combined focused bundle: 24 pass, 0 fail |
| Tenant credential reload/fallback passes | Green | `tenant-key-derivation.test.ts`: 6 pass, 0 fail |
| Lint remains green | Green | `bun run lint` exit 0 |
| Whitespace check remains clean | Green | `git diff --check` exit 0 |
| Full suite remains green | Green | 5592 pass, 13 skip, 0 fail |
| Build remains green | Green | `bun run build` exit 0 |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
