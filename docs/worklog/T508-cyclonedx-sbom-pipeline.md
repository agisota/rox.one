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
