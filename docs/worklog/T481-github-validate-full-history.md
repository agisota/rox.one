# T481 - GitHub validate full history

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T481-github-validate-full-history.md

## 1. Task summary

Repair the remaining GitHub Actions `validate` failure on PR #217 by making
history-sensitive repository contracts run against full checkout history.

## 2. Repo context discovered

CircleCI validate, e2e-core, mac-arm-build, and secret-scan are green on PR #217
head `e9811f7b`. GitHub Actions `validate` now runs Bun `1.3.13`, installs
Playwright Chromium, and reaches the unit suite, but fails only the R.10
permanent rebrand gate because the shallow PR merge checkout reports the
synthetic merge commit `d2edb69` as the latest T321 path commit.

## 3. Files inspected

- `.github/workflows/validate.yml`
- `scripts/validate-ci-contract.ts`
- `scripts/__tests__/rebrand-permanent-gate.test.ts`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/tickets/T321-roadmap-coherence-validator-repair.md`
- GitHub Actions validate run `25886918907`
- PR merge ref `d2edb6983ae6cc3b356d2e2f78119b4bbfd9dddb`

## 4. Tests added first

Extended `scripts/validate-ci-contract.ts` before editing the workflow so it
requires `fetch-depth: 0` in the GitHub validate checkout step.

## 5. Expected failing test output

`bun run validate:ci-contract` failed for the intended reason before the
workflow edit:

```text
[ci-contract] validate workflow missing: fetch-depth: 0
error: script "validate:ci-contract" exited with code 1
```

## 6. Implementation changes

- Updated `.github/workflows/validate.yml` so `actions/checkout@v4` uses
  `fetch-depth: 0`.
- Kept the R.10 mapping evidence unchanged because full history still resolves
  T321 to `c42e3d59`.

## 7. Validation commands run

- `bun run validate:ci-contract`
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

- CI contract validation passed.
- R.10 permanent gate passed: `6 pass`, `0 fail`, `12 expect() calls`.
- Rebrand validation passed with no forbidden tokens outside the allowlist.
- Docs validation passed and counted `447 tickets`, `7 required docs`.
- `git diff --check` passed with no whitespace errors.

## 9. Build output summary

No build is expected for this workflow-contract change.

## 10. Remaining risks

GitHub macOS ARM64 package still fails before executing job steps on the GitHub
macOS runner surface; CircleCI mac-arm-build remains the green mac package
proof. R.11 remains blocked and not complete.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED fails on the shallow GitHub validate checkout contract | PASS | `bun run validate:ci-contract` failed on missing `fetch-depth: 0` before workflow edit |
| GitHub validate uses `fetch-depth: 0` | PASS | `.github/workflows/validate.yml` checkout step now sets `fetch-depth: 0` |
| The R.10 permanent gate passes locally with full history | PASS | `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` passed |
| CI contract, rebrand validation, docs validation, and diff whitespace checks pass locally | PASS | `bun run validate:ci-contract`, `bun run validate:rebrand`, `bun run validate:docs`, and `git diff --check` passed |
| T481 commit is ready to push for fresh CI | PASS | Worktree changes are locally validated and ready for a normal branch push |
| No destructive R.11 action is performed | PASS | No destructive R.11 command is recorded for T481 |
