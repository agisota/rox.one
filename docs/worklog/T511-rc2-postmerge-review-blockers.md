# T511 - RC2 post-merge review blocker repair

Status: DONE
Phase: RC2 post-merge stabilization
Ticket: docs/tickets/T511-rc2-postmerge-review-blockers.md

## 1. Task summary

Create one consolidation branch that reapplies the RC2 review-blocker fixes
missing from `origin/main` after stale-head PRs were merged.

## 2. Repo context discovered

`origin/main` already contained the RC2 tickets and short worklog backfills,
but retained stale blocker behavior in several files: unsafe T500 passphrase
guidance, unsigned workflow ordering gaps, blanket docs markdown gitleaks
allowlisting, unpinned SBOM generation, missing Renovate manual approval, and
an incomplete T510 audit.

## 3. Files inspected

- `.github/workflows/linux-signed-release.yml`
- `.github/workflows/mac-arm-build.yml`
- `.github/workflows/mac-unsigned-release.yml`
- `.github/workflows/windows-unsigned-release.yml`
- `.github/renovate.json`
- `.gitleaks.toml`
- `.husky/pre-commit`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/__tests__/gitleaks-pre-commit-smoke.test.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- RC2 tickets/worklogs T500, T501, T502, T503, T507, T508, T509, and T510.

## 4. Tests added first

The RED evidence for this consolidation was the stale `origin/main` state:

- `origin/main:.gitleaks.toml` still contained the blanket docs markdown
  allowlist.
- `origin/main:scripts/__tests__/gitleaks-pre-commit-smoke.test.ts` could pass
  without a real `gitleaks` binary.
- `origin/main:docs/tickets/T500-linux-gpg-secrets-setup.md` documented fixed
  local passphrase handling.
- The prepared repair commits for T501, T502, T503, T507, T508, T509, and T510
  were absent from `origin/main`.

## 5. Expected failing test output

The expected pre-repair failure mode was not one single unit test; it was a set
of static contract failures:

- Secret-scan hard gate weakened by blanket docs allowlist.
- Unsigned workflows could build the wrong ref or validate boundaries in the
  wrong order.
- Platform-specific artifact workflows required unrelated platform outputs.
- SBOM upload did not validate the generated file before artifact upload.
- Renovate preview mode could still open PRs without dashboard approval.
- T510 audit omitted registered RPC handlers and carried incorrect totals.

## 6. Implementation changes

- Cherry-picked the prepared T500, T501, T502, T503, T507, T508, T509, and T510
  repair commits onto a fresh `origin/main` worktree.
- Resolved worklog conflicts in favor of the complete 11-section worklogs.
- Preserved legitimate existing worklogs from `origin/main` instead of deleting
  them while replaying the older T510 repair commit.
- Removed exact deprecated fixed temporary secret-path examples from the T500
  worklog so static secret-handling checks are clean.
- Added this T511 ticket/worklog to document the consolidation branch.

## 7. Validation commands run

- `bun test scripts/__tests__/gitleaks-pre-commit-smoke.test.ts`
- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:linux-signed-release-pipeline`
- `bun run validate:private-release-pipeline`
- `bun run validate:linux-boundary-fixtures`
- `bun run validate:linux-private-release-boundary`
- `bun run validate:windows-boundary-fixtures`
- `bun run validate:windows-private-release-boundary`
- `bun run validate:mac-boundary-fixtures`
- `bun run validate:mac-private-release-boundary`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run typecheck:all`
- `bun run lint`
- `bun run scripts/validate-sbom.ts <temp-valid-sbom.json>`
- workflow `actionlint` over changed release workflows
- Renovate JSON parse check
- static grep checks for unsafe T500 strings, blanket gitleaks docs allowlist,
  Renovate manual approval, SBOM pin/validation, and T510 handler coverage
- `git diff --check`

## 8. Passing test output summary

- Gitleaks hook smoke: 2 pass, 0 fail.
- Packaged-artifacts validator tests: 15 pass, 0 fail.
- Mac ARM, private release pipeline, Linux signed release, Linux boundary, Mac
  boundary, and Windows boundary validators passed; platform-native live
  signing checks were skipped on this Linux host as expected.
- `validate:agent-contract` passed with 477 tickets and 7 required docs.
- `validate:docs` passed agent-contract, architecture-docs, and sync-v2 design.
- `validate:rebrand` passed.
- `typecheck:all` passed after using the existing checked-out dependency tree;
  an attempted fresh `/tmp` install failed with `ENOSPC` during Electron
  postinstall, so no dependency files were committed.
- `lint` passed with existing warnings only and no errors.
- `validate-sbom` accepted a generated CycloneDX 1.5 fixture with 100
  components.
- Actionlint returned no diagnostics for the changed release workflows.
- `git diff --check` produced no output.

## 9. Build output summary

No application build was run for this repair branch. The changes are release
workflow, validator, test, and documentation updates. Live release workflows
still require GitHub-hosted runners and signing/release secrets.

## 10. Remaining risks

- Real macOS and Windows release packaging was not run locally.
- Native codesign, stapler, and signtool checks are skipped on this Linux host
  by design.
- Hosted CI still needs to prove the branch after PR creation.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Unsafe fixed passphrase path removed | PASS | Static grep for deprecated T500 markers has no matches. |
| Release workflow validators pass | PASS | Mac, Linux, and Windows targeted validators passed locally. |
| Gitleaks docs blanket allowlist removed | PASS | Static grep for the blanket docs allowlist has no matches. |
| Renovate manual approval enforced | PASS | `.github/renovate.json` parses and sets `dependencyDashboardApproval: true`; automerge remains false. |
| T510 audit includes registered `server.ts` and `messaging.ts` | PASS | Static review found both handlers in the audit findings and follow-up ticket table. |
| Docs contract and whitespace checks pass | PASS | `validate:docs`, `validate:agent-contract`, `validate:rebrand`, and `git diff --check` passed. |
