# T254 worklog — Linux signed-build CI workflow

## 1. Goal

Mirror the T251 Mac signed-build CI workflow for Linux. Take the
T253 trust-boundary validator's posture (canonical AppImage
filename, freedesktop desktop entry, optional gpg detached sidecar)
and ship the actual signed-build pipeline that produces a real
detached `.sig` from a real gpg key held in repo secrets, plus a
SHA-256 checksum manifest and a workflow artifact upload of the
signed AppImage + sidecar.

## 2. Surfaces inspected

- `.github/workflows/mac-signed-release.yml` (T251 source of truth)
- `scripts/validate-private-release-pipeline.ts` (T256 pipeline
  validator pattern)
- `scripts/validate-linux-private-release-boundary.ts` (T253 bundle
  contract — frozen; not modified)
- `apps/electron/electron-builder.yml` `linux:` block (T253 wiring —
  artifactName `ROX-ONE-${arch}.${ext}`)
- `package.json` `validate:linux-*` scripts
- `docs/tickets/T251-signed-build-workflow.md` for ticket shape

## 3. Design decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | Separate workflow file `linux-signed-release.yml` | Mirrors the Mac (`mac-signed-release.yml`) cleanly; no risk of cross-platform contamination, easy diff for reviewers. |
| 2 | Three gpg secrets, not five (Mac has five) | Linux signing surface is intrinsically smaller — there is no notarization service to authenticate against. `KEY` + `KEY_ID` + `PASSPHRASE` is the minimum-viable trio. |
| 3 | `gpg --pinentry-mode loopback --passphrase-fd 0` | Standard non-interactive CI signing pattern. Passphrase reaches gpg via stdin pipe, never via argv (would leak in `ps aux`). |
| 4 | `gpg --armor` for the `.sig` sidecar | Armored signatures survive arbitrary transport (uploads, mirrors, copy-paste). Binary `.sig` would save ~30% bytes but is not worth the operational hazard for a signing sidecar shipped at the same scale as the AppImage. |
| 5 | Validator scans line-by-line, not regex-across-newlines | First attempt used `/run:[^|]*\$\{\{ inputs.tag \}\}/` which incorrectly matched across a later env: block referencing `${{ inputs.tag }}`. Replaced with a line-scoped scanner that tracks `env:` block scope by indent. |
| 6 | `if-no-files-found: error` for the signed artifact | Hard-fail upload on missing AppImage or `.sig`. The `evidence` upload keeps `warn` because logs may legitimately be empty if the workflow crashed before producing them. |
| 7 | `retention-days: 14` | Matches T251 + T256. Long enough for a release dry-run review cycle; short enough that stale signed binaries do not linger in workflow storage. |

## 4. Implementation steps

1. Wrote `.github/workflows/linux-signed-release.yml` mirroring
   `mac-signed-release.yml` structure: trigger block,
   concurrency, permissions, runner (`ubuntu-22.04`), env, then
   steps in T251 order (checkout → tag guard → secrets pre-flight
   → bun setup → install → log dir → fixture/boundary/pipeline
   gates → electron build → electron-builder package →
   gpg-sign+verify → checksum → upload artifact → upload
   evidence).
2. Committed + pushed the workflow alone (commit 1) so the branch
   exists on origin before the validator references it.
3. Wrote `scripts/validate-linux-signed-release-pipeline.ts` with
   the same shape as `scripts/validate-private-release-pipeline.ts`
   (T256) — package.json contract block, workflow file existence,
   required-token list, forbidden-token list, ordering checks,
   inline-expression guard.
4. Added `validate:linux-signed-release-pipeline` script to
   `package.json` between the existing T253 linux scripts and the
   e2e-core scenarios script.
5. Ran the new validator — initially failed on the inline-
   expression guard because the regex matched across lines.
   Rewrote the guard as a per-line scanner that respects `env:`
   block scope.
6. Re-ran the full validation gate set: pipeline ✓, rebrand ✓,
   agent-contract ✓, roadmap ✓.

## 5. Validation gates

- `bun run validate:linux-signed-release-pipeline`
  → `[linux-signed-release-pipeline] ok: manual-dispatch +
     tag-guard + gpg-secrets pre-flight + signing + checksum
     asserted`
- `bun run validate:rebrand`
  → `rebrand validation passed: no forbidden tokens outside the
     allowlist`
- `bun run validate:agent-contract`
  → `[agent-contract] ok: 11 skills, 319 tickets, 7 required docs`
- `bun run validate:roadmap`
  → `validate:roadmap OK — 46 phases, 110 tickets across detail
     files`

## 6. LOC summary

| File | LOC |
| ---- | --- |
| `.github/workflows/linux-signed-release.yml` | 213 |
| `scripts/validate-linux-signed-release-pipeline.ts` | 191 |
| `package.json` | +1 line |

All within budget (≤250 workflow, ≤200 validator).

## 7. Risks / unknowns

- **Real key onboarding**: this ticket only ships the shape. When
  the gpg key is actually generated and uploaded to repo secrets,
  the secrets pre-flight will need a smoke run via
  `workflow_dispatch` against a dummy tag before the first real
  release. Captured as T255 follow-up.
- **AppImage path discovery**: we use `find -name '*.AppImage'`
  because the artifact name template `ROX-ONE-${arch}.${ext}` in
  `electron-builder.yml` may evolve. If the linux: block is later
  updated to add a `-${version}` segment, the find call still
  resolves correctly (it greedy-matches the first AppImage under
  `apps/electron/release`).
- **gpg version drift**: `ubuntu-22.04` ships gpg 2.2.x. The
  `--pinentry-mode loopback --passphrase-fd 0` pattern is stable
  across 2.2 + 2.4, so a runner upgrade to ubuntu-24.04 (gpg
  2.4.x) will not break the pipeline.

## 8. Follow-ups

- **T255** — Windows Authenticode signed-build CI workflow.
- **M.18 closeout** — with T254 the Mac + Linux signed-build CI
  workflows are both green-path; Windows is the last leg.
