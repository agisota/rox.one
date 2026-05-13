# T323 - Rebrand package-scope test hygiene

Status: DONE

## Context

After rebasing the R.10 follow-up branch onto PR #71, the full `bun test`
run exposed a package-scope regression in an R.7 test file. The active
test source still contained the retired app package scope as a contiguous
literal, which violated the R.5 package-scope closeout gate even though the
assertion was checking for absence.

## Goal

Keep the R.7 electron script assertion intact while making the active test
source free of retired workspace package-scope literals.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

Use the existing R.5 package-scope gate as the regression test.

## Required Subagents

None.

## TDD Requirements

Run `bun test scripts/__tests__/rebrand-package-scope.test.ts` first and
confirm it fails on `scripts/__tests__/r7-docker-ci-build.test.ts`.

## Implementation Requirements

1. Do not change production/runtime behavior.
2. Preserve the R.7 assertion that `electron:dev:logs` does not reference
   the retired Electron app package.
3. Avoid contiguous retired workspace package-scope literals in active
   test source.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [x] The package-scope gate fails before implementation for the expected file.
- [x] The R.7 Docker / CI / build test still passes.
- [x] The package-scope gate passes.
- [x] Full validation remains green.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T323-rebrand-package-scope-test-hygiene.md`.
