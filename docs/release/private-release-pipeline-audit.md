# Private Release Pipeline Audit (M.17 T256)

Date: 2026-05-13
Scope: `.github/workflows/private-release.yml` + `scripts/validate-private-release-pipeline.ts`
+ `apps/electron/electron-builder.yml` artifact surface.

## Current stages (pre-T256)

1. Trigger: `workflow_dispatch` AND `pull_request` AND `push` (main, mac/**) on broad path globs.
2. Single `macos-15` job: install Bun + uv, prepare logs dir.
3. Sequential gates: `validate:private-release-pipeline`, `validate:docs`, `lint`,
   `typecheck:all`, `bun test`, `electron:build`, `validate:bundle-policy`,
   `validate:mac-arm-build-workflow`.
4. Artifact: `rox-one-private-release-evidence` — logs + `apps/electron/dist` + `docs/release`,
   retention 14 days. No installer paths, no checksums.

## Gap analysis

| # | Gap                                                       | Risk                                                                 | Action (T256)                                                                                                  |
| - | --------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1 | `pull_request` + `push` triggers fire on every PR/main    | Burns macOS minutes, races concurrent RC drafts, leaks pre-RC builds | Manual `workflow_dispatch` only; PR + push triggers dropped                                                    |
| 2 | No tag-pattern guard                                      | Any branch can dispatch an RC; allows forgery via mis-named refs     | Pre-flight step rejects `github.ref` not matching `^refs/tags/v\d+\.\d+\.\d+(-rc\.\d+)?$` (or workflow input)  |
| 3 | Rebrand + agent-contract not asserted before build        | Stale `craft-*` tokens / `Status: DONE` drift ship in RC             | New "Pre-build validation gate" step runs `validate:rebrand` + `validate:agent-contract` BEFORE `electron:build` |
| 4 | `validate:mac-private-release-boundary` (M.18) not in CI  | RC could ship with `disable-library-validation` regression           | Pre-build gate also runs `validate:mac-private-release-boundary`                                               |
| 5 | `validate:release` orchestrator not enforced in workflow  | Local + CI gates can drift                                           | Workflow step explicitly invokes `validate:release` (which transitively runs the others)                       |
| 6 | Installer paths (`*.dmg`, `*.zip`) not uploaded           | RC reviewers have to rebuild locally                                 | Add `release-artifacts` upload covering `apps/electron/release/**/*.{dmg,zip}`                                 |
| 7 | No checksum manifest                                      | Cannot prove artifact integrity post-download                        | New step computes `SHA-256` for every installer and uploads `release-checksums.txt`                            |
| 8 | Pipeline contract validator does not assert items 1-7     | Drift can land without CI catching it                                | Extend `validate-private-release-pipeline.ts` to assert manual-dispatch-only, tag-guard, gates, checksums      |

## Acceptance

- Workflow rejects non-tag refs at the pre-flight step (no compute spent).
- Pre-build gate runs all four validators before `electron:build`.
- `release-artifacts` and `release-checksums.txt` upload artifacts on success.
- Validator covers gaps #1-#7. Re-running validator against same SHA is idempotent.

## Follow-up (T257)

- Wire the actual `npm publish` / GitHub Release step gated behind CI secrets.
- Provenance attestation (`actions/attest-build-provenance`) once signing identity lands.
- Windows + Linux mirrors of the checksum + tag-guard contract.
