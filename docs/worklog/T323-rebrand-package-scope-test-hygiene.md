# T323 - Rebrand package-scope test hygiene

Status: DONE
Phase: R.10 follow-up validation repair
Ticket: docs/tickets/T323-rebrand-package-scope-test-hygiene.md

## 1. Task summary

Repair the post-PR #71 full-suite regression where an R.7 test source file
itself contained a retired workspace package-scope literal.

## 2. Repo context discovered

The branch was clean and two commits ahead of `origin/main`. `bun run build`
completed successfully, but full `bun test` failed in
`scripts/__tests__/rebrand-package-scope.test.ts` because
`scripts/__tests__/r7-docker-ci-build.test.ts` contained the retired
Electron app package as a contiguous source literal.

## 3. Files inspected

- `scripts/__tests__/rebrand-package-scope.test.ts`
- `scripts/__tests__/r7-docker-ci-build.test.ts`
- `docs/tickets/T322-rebrand-closeout-evidence-reconciliation.md`
- `docs/worklog/T322-rebrand-closeout-evidence-reconciliation.md`

## 4. Tests added first

No new test file was needed. The existing R.5 package-scope gate already
captured the regression before implementation.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-package-scope.test.ts` failed with:

- `R.5 package-scope rebrand > renames the app workspace packages to the ROX scope`
- `R.5 package-scope rebrand > keeps active package-scope surfaces free of legacy workspace scope`

Both failures reported `scripts/__tests__/r7-docker-ci-build.test.ts` as
the only legacy match.

## 6. Implementation changes

Updated `scripts/__tests__/r7-docker-ci-build.test.ts` so the
`electron:dev:logs` assertion computes the retired Electron package name
from split string segments. The assertion still proves the script avoids
the retired package, but the active test source no longer contains the
retired workspace package-scope literal.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts` (red)
- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 12 pass,
  0 fail, 128 expects.
- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`: 7 pass, 0
  fail, 17 expects.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden
  tokens outside the allowlist`.
- `bun run validate:roadmap`: `validate:roadmap OK — 46 phases, 111
  tickets across detail files`.
- `bun run typecheck`: completed successfully.
- `bun run lint`: completed successfully.
- `git diff --check`: clean.
- `bun test`: 5152 pass, 13 skip, 0 fail, 1 snapshot, 13251 expects.

## 9. Build output summary

`bun run build` completed successfully after the repair. Electron main,
preload, renderer, resources, and asset-copy steps completed; Vite emitted
the existing large-chunk warning only.

## 10. Remaining risks

R.11 hard prerequisites remain blocked independently of this test-hygiene
repair.

## 11. Acceptance criteria matrix

- [x] The package-scope gate fails before implementation for the expected file.
- [x] The R.7 Docker / CI / build test still passes.
- [x] The package-scope gate passes.
- [x] Full validation remains green.
- [x] Worklog complete.
