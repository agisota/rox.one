# T256 - Private CI/CD release pipeline hardening

Status: DONE

## Context

We are building a white-label fork of ROX.ONE OSS into the
ROX.ONE Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

The repository ships `.github/workflows/private-release.yml` and
`scripts/validate-private-release-pipeline.ts`. T256 (Phase M.17)
hardens the private RC pipeline so it is manual-dispatch only,
tag-protected, validated before build, and ships installer
artifacts plus SHA-256 checksums.

## Scope

Four surfaces + an audit doc:

1. **`.github/workflows/private-release.yml`**: drop
   `pull_request` + `push` triggers; keep `workflow_dispatch` only
   with an optional `tag` input. Add pre-flight "Validate release
   tag pattern" step rejecting refs not matching
   `^v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$` (consumes `INPUT_TAG`
   via env to avoid command injection). Add "Pre-build validation
   gate" running `validate:rebrand` + `validate:agent-contract` +
   `validate:release` + `validate:mac-private-release-boundary`
   BEFORE `electron:build`. Add "Compute release artifact
   checksums" (SHA-256 per `.dmg`/`.zip`/`.exe`/`.AppImage`) and
   upload actions `release-artifacts` + `release-checksums`.
2. **`scripts/validate-private-release-pipeline.ts`**: assert
   manual-dispatch only (forbid `pull_request:` / `push:`), assert
   tag-protection regex anchor, assert ordering (tag-guard <
   install, pre-build gate < build), assert installer + checksum
   upload step names + globs, forbid inline
   `${{ github.event.inputs.tag }}` in any `run:` block, assert
   audit-doc anchors.
3. **`docs/release/private-release-pipeline-audit.md`** (NEW, 41
   LOC): stage map + 8-row gap analysis + acceptance + T257
   follow-ups.
4. **`docs/tickets/T256-*.md` + `docs/worklog/T256-*.md`**: this
   ticket + worklog with `Status: DONE`.

## Out of scope

- Real `gh release create` / `npm publish` wiring (T257; needs CI
  secrets).
- Provenance attestation (`actions/attest-build-provenance`; T257).
- Windows / Linux mirrors of the checksum + tag-guard contract
  (T258 / T259).

## Rules followed

- No actual release/tagging performed.
- No secrets added anywhere.
- ≤400 LOC source/script/docs changes.
- Idempotent: re-running `validate:private-release-pipeline`
  against the same SHA yields the same exit code.

## Validation gates

- `bun run validate:private-release-pipeline` — pass (new shape).
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass with T256 `Status: DONE`.
- `bun run validate:roadmap` — pass.
- `bun run validate:ci-contract` — pass.
- `bun run validate:mac-private-release-boundary` — pass (non-darwin).

## Follow-ups

- **T257** — wire signed `gh release create` / publish behind CI
  secrets; add provenance attestation.
- **T258** — Windows private-release boundary mirror.
- **T259** — Linux AppImage private-release boundary mirror.

## Worklog

See `docs/worklog/T256-private-release-pipeline-hardening.md`.
