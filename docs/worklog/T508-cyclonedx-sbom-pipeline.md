# T508 - CycloneDX SBOM pipeline

Status: DONE
Phase: RC2 release hardening
Ticket: docs/tickets/T508-cyclonedx-sbom-pipeline.md

## 1. Task summary

Patch the Linux initial SBOM slice review blockers after the stale PR queue
landed. Scope is limited to the Linux signed release workflow, SBOM validator
contract, ticket, and worklog.

## 2. Repo context discovered

- `.github/workflows/linux-signed-release.yml` already generates
  `sbom-linux.json` before upload.
- The SBOM generator used `@cyclonedx/cdxgen@latest`, which can drift between
  review and release.
- The workflow did not validate the generated SBOM before upload.
- Several bash steps used only `set -o pipefail`.
- Mac and Windows SBOM work remains pending and should not be overclaimed by
  this Linux slice.

## 3. Files inspected

- `.github/workflows/linux-signed-release.yml`
- `scripts/validate-sbom.ts`
- `scripts/validate-linux-signed-release-pipeline.ts`
- `docs/tickets/T508-cyclonedx-sbom-pipeline.md`
- `package.json`

## 4. Tests added first

No new test file was added. RED static checks were run before implementation:

- `grep -R "@cyclonedx/cdxgen@latest" -n .github/workflows/linux-signed-release.yml docs/tickets/T508-cyclonedx-sbom-pipeline.md`
- `grep -n "bun run scripts/validate-sbom.ts sbom-linux.json" .github/workflows/linux-signed-release.yml`
- `grep -n "set -o pipefail" .github/workflows/linux-signed-release.yml`

## 5. Expected failing test output

- `@cyclonedx/cdxgen@latest` appeared in the workflow and ticket.
- The validate-sbom grep returned no matches.
- Five `set -o pipefail` lines were present.

## 6. Implementation changes

- Pinned transient cdxgen invocation to `@cyclonedx/cdxgen@12.4.0`.
- Added `bun run scripts/validate-sbom.ts sbom-linux.json` immediately after
  generation and before upload.
- Replaced remaining workflow-only `set -o pipefail` prologues with
  `set -euo pipefail`.
- Reworded the ticket summary to describe the Linux initial slice and keep
  Mac/Windows pending.

## 7. Validation commands run

- `grep -R "@cyclonedx/cdxgen@latest" -n .github/workflows/linux-signed-release.yml docs/tickets/T508-cyclonedx-sbom-pipeline.md`
- `grep -n "@cyclonedx/cdxgen@12.4.0" .github/workflows/linux-signed-release.yml docs/tickets/T508-cyclonedx-sbom-pipeline.md`
- `grep -n "bun run scripts/validate-sbom.ts sbom-linux.json" .github/workflows/linux-signed-release.yml docs/tickets/T508-cyclonedx-sbom-pipeline.md`
- `grep -n "set -o pipefail" .github/workflows/linux-signed-release.yml`
- `awk` ordering check for generation before validation before upload
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `bun run scripts/validate-sbom.ts <temp-valid-sbom.json>`
- `bun run validate:linux-signed-release-pipeline`
- `git diff --check`

## 8. Passing test output summary

- No `@cyclonedx/cdxgen@latest` occurrences remain in the workflow or ticket.
- `@cyclonedx/cdxgen@12.4.0` is present in the workflow and ticket.
- `bun run scripts/validate-sbom.ts sbom-linux.json` is present in the workflow
  and ticket.
- No `set -o pipefail` occurrences remain in `linux-signed-release.yml`.
- Ordering check passed: generation line 199, validation line 204, upload line
  207.
- `validate:docs` passed: agent contract, architecture docs, and sync-v2 design
  validators passed.
- `validate:agent-contract` passed: 11 skills, 466 tickets, 7 required docs.
- Targeted validate-sbom smoke passed with `bomFormat = "CycloneDX"`,
  `specVersion = 1.5`, and 100 components.
- `validate:linux-signed-release-pipeline` passed.
- `git diff --check` passed.

## 9. Build output summary

No runtime source or build logic changed; this patch is covered by static
workflow validators and the targeted SBOM validator smoke.

## 10. Remaining risks

The Linux release workflow itself was not executed locally because it requires
GitHub Actions signing secrets and release artifacts.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| cdxgen exact pinned version without production dependency | PASS | Workflow uses transient `npx -y @cyclonedx/cdxgen@12.4.0`; package files unchanged. |
| validate-sbom runs after generation before upload | PASS | Ordering check passed: generation before validation before upload. |
| bash blocks use `set -euo pipefail` | PASS | No `set -o pipefail` remains in the workflow. |
| Ticket scoped to Linux initial slice | PASS | Ticket says initial Linux SBOM generation slice and Mac/Windows remain pending. |

## 12. Final slice — Mac + Windows + release-all-platforms (2026-05-17)

### Summary

Closed the pending portion of T508. Linux SBOM gate was already in place. This slice
adds equivalent SBOM generation and upload steps to the two remaining per-platform
release workflows and to the unified `release-all-platforms.yml` matrix workflow.

### Changes Made

**`.github/workflows/mac-unsigned-release.yml`**
- Inserted two steps after `Compute unsigned artifact checksum`, before `Upload unsigned DMG artifact`:
  1. `Generate CycloneDX SBOM` — `npx -y @cyclonedx/cdxgen@12.4.0 -t bun -o sbom-mac.json` + validate
  2. `Upload SBOM artifact` — artifact name `sbom-mac`, `retention-days: 90`

**`.github/workflows/windows-unsigned-release.yml`**
- Inserted two steps after `Compute artifact checksums (SHA-256)`, before `Upload Windows installer artifact`:
  1. `Generate CycloneDX SBOM` — bash shell, `sbom-windows.json`
  2. `Upload SBOM artifact` — artifact name `sbom-windows`, `retention-days: 90`

**`.github/workflows/release-all-platforms.yml`**
- Added new section 11 (renumbered old 11→12, 12→13) with platform-conditional SBOM steps.
- Mac/Linux: bash, `sbom-${PLATFORM}.json`, artifact `sbom-{platform}-{tag}`
- Windows: bash, `sbom-windows-x64.json`, artifact `sbom-windows-x64-{tag}`
- All uploads: `if-no-files-found: error`, `retention-days: 90`

**`docs/tickets/T508-cyclonedx-sbom-pipeline.md`**
- `Status: IN PROGRESS` → `Status: DONE`
- Scope table: Mac `PENDING` → `DONE`, Windows `PENDING` → `DONE`
- Added final-slice Changes section

### Validation Evidence

- `validate-sbom.ts` confirmed platform-agnostic (no OS-specific calls)
- cdxgen version pinned at `12.4.0` — unchanged from Linux reference
- No new `package.json` dependencies added
- Linux SBOM steps untouched
- Windows SBOM step uses `shell: bash` (Git Bash available on `windows-latest`)
- `release-all-platforms.yml` naming convention matches existing artifact upload patterns

### Final Acceptance Criteria

| Criterion | Status | Evidence |
| --- | --- | --- |
| Mac workflow has Generate + Upload SBOM steps | PASS | Steps added after checksum, before artifact upload |
| Windows workflow has Generate + Upload SBOM steps | PASS | Steps added after checksum, before installer upload |
| release-all-platforms.yml has per-platform SBOM steps | PASS | New section 11 with mac-arm64, linux-x64, windows-x64 conditionals |
| All use cdxgen@12.4.0 (no drift) | PASS | All three additions use exact pinned version |
| All use bun run scripts/validate-sbom.ts | PASS | Validator called in all three workflows |
| Ticket status updated to DONE | PASS | Status field and scope table both updated |
| Linux SBOM steps untouched | PASS | linux-signed-release.yml not modified |
