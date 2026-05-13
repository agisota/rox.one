# T340 - Origin main validation baseline repair

Status: DONE

## Context

After replaying the post-merge validation repairs onto current `origin/main`
(PR #96), `bun run typecheck` and `bun run validate:rebrand` failed before any
new runtime feature work:

- `packages/shared/src/agent/options.ts` and
  `packages/shared/src/agent/pi-agent.ts` had duplicate `ROX_DEBUG` properties.
- `packages/shared/src/utils/__tests__/env-compat.test.ts` had duplicated saved
  env declarations and cleanup lines, and its legacy-prefix expectations no
  longer matched the current ROX.ONE canonical env surface.
- The stricter rebrand validator from PR #96 flagged current ROX-owned runtime,
  infrastructure, documentation, and test surfaces that intentionally contain
  canonical ROX identifiers.
- The full suite exposed stale rebrand tests that rejected current ROX.ONE
  names and a secure-storage magic-header mismatch that made fresh credential
  managers treat newly written credential files as corrupt.

## Goal

Restore the current `origin/main` validation baseline so the T337/T338/T339
repairs can be assessed by the standard gates.

## Required UI

None.

## Required Data/API

No API shape changes.

## Required Automations

None.

## Required Subagents

None. The failing commands point directly at duplicate lines and validator
allowlist misses.

## TDD Requirements

Use the existing validation commands as red checks:

- `bun run typecheck`
- `bun run validate:rebrand`
- failing full-suite tests in the rebrand, env-compat, migration, and tenant
  credential surfaces.

## Implementation Requirements

- Remove only duplicated env assignment/declaration/cleanup lines.
- Keep the env-compat tests aligned with current canonical `ROX_*` reads.
- Keep ROX-owned validator allowlists concrete and tied to existing surfaces.
- Repair stale rebrand assertions without changing product naming.
- Fix the secure-storage header check so files written with the reserved
  8-byte magic field can be reloaded.
- Do not add dependencies.

## Validation Commands

- `bun run typecheck`
- `bun run validate:rebrand`
- `bun run lint`
- targeted failing test bundle:
  `bun test packages/shared/src/utils/__tests__/env-compat.test.ts scripts/__tests__/community-link-audit.test.ts scripts/__tests__/r7-docker-ci-build.test.ts scripts/__tests__/rebrand-code-identifiers.test.ts packages/shared/src/config/__tests__/user-data-migration.test.ts packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] Typecheck no longer fails on duplicate object/env declarations.
- [x] Rebrand validator accepts current ROX-owned surfaces.
- [x] Stale rebrand/env/migration/credential tests pass in the targeted bundle.
- [x] Lint remains green.
- [x] Whitespace check remains clean.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T340-origin-main-validation-baseline-repair.md`.
