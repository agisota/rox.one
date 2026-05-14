# T480 - GitHub validate parity

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T480-github-validate-parity.md

## 1. Task summary

Repair the GitHub Actions `validate` workflow drift exposed after CircleCI went
green on PR #217.

## 2. Repo context discovered

PR #217 head `155e26e3` is `MERGEABLE`. CircleCI validate #130, e2e-core #131,
mac-arm-build #132, and secret-scan #133 all passed on that SHA. GitHub Actions
`validate` failed after running `test:units`; the log shows Bun `1.3.10`, while
the green CircleCI lane uses Bun `1.3.13` and installs Playwright Chromium before
the validation suite.

## 3. Files inspected

- `.github/workflows/validate.yml`
- `.circleci/config.yml`
- `scripts/validate-ci-contract.ts`
- GitHub Actions validate run `25886452175`
- CircleCI builds `130`, `131`, `132`, `133`

## 4. Tests added first

Extended `scripts/validate-ci-contract.ts` before editing the workflow so it
requires `.github/workflows/validate.yml` to include Bun `1.3.13` and
`./node_modules/.bin/playwright install --with-deps chromium`.

## 5. Expected failing test output

`bun run validate:ci-contract` failed for the intended reason before the
workflow edit:

```text
[ci-contract] validate workflow missing: bun-version: "1.3.13"
error: script "validate:ci-contract" exited with code 1
```

## 6. Implementation changes

- Updated `.github/workflows/validate.yml` from Bun `1.3.10` to `1.3.13`.
- Added the Playwright Chromium install step before `Prepare validation logs`,
  matching the green CircleCI validate lane.
- Updated T479 documentation with the post-push CircleCI green evidence for
  `155e26e3`.

## 7. Validation commands run

- `bun run validate:ci-contract`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- CI contract validation passed.
- Docs validation passed and counted `446 tickets`, `7 required docs`.
- `git diff --check` passed with no whitespace errors.

## 9. Build output summary

No build is expected for this workflow-contract change.

## 10. Remaining risks

GitHub macOS ARM64 package still fails before steps on the macOS runner surface;
CircleCI mac-arm-build is the current green mac package proof. R.11 remains
blocked and not complete.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED fails on the stale GitHub validate workflow contract | PASS | `bun run validate:ci-contract` failed on missing `bun-version: "1.3.13"` before workflow edit |
| GitHub validate uses Bun `1.3.13` | PASS | `.github/workflows/validate.yml` now declares `bun-version: "1.3.13"` |
| GitHub validate installs Playwright Chromium before the validation suite | PASS | Workflow now runs `./node_modules/.bin/playwright install --with-deps chromium` before validation logs/suite |
| CI contract and docs validation pass locally | PASS | `bun run validate:ci-contract`, `bun run validate:docs`, and `git diff --check` passed |
| T480 commit is ready to push again for fresh CI | PASS | Worktree changes are locally validated and ready for a normal branch push |
| No destructive R.11 action is performed | PASS | No destructive R.11 command is recorded for T480 |
