# T254 - Linux signed-build CI workflow (GPG sign + AppImage upload)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into the
ROX.ONE Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T250 hardened the macOS trust boundary. T251 wired the macOS
signed-build + notarization CI workflow. T252 mirrored T250 for
Windows. T253 mirrored T250 for Linux (AppImage + freedesktop
desktop entry + gpg sidecar shape). T254 closes the M.18
cross-platform signed-build set by mirroring the **T251** macOS
signed-build CI workflow for Linux: gpg-detached signing of the
AppImage, SHA-256 checksum manifest, and workflow-artifact upload
of the signed installer + sidecars.

## Scope

This ticket ships three artifacts and one package.json wire-up:

1. **`.github/workflows/linux-signed-release.yml`** — new
   `workflow_dispatch`-only workflow. Inputs: `tag` (required,
   matches `^v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$`). Steps:
   tag-pattern guard → secrets pre-flight (ROX_LINUX_GPG_KEY,
   ROX_LINUX_GPG_KEY_ID, ROX_LINUX_GPG_PASSPHRASE) → bun setup →
   install → validate linux-boundary fixtures → validate linux
   trust-boundary → validate linux-signed-release pipeline shape →
   electron build → `electron-builder --linux --publish=never` →
   `gpg --batch --import` → `gpg --detach-sign --armor` →
   `gpg --verify` (Good-signature grep) → `sha256sum` manifest →
   upload signed `.AppImage` + `.sig` + checksum manifest +
   evidence artifact.
2. **`scripts/validate-linux-signed-release-pipeline.ts`** — new
   pipeline-shape validator. Asserts the workflow's manual-dispatch
   contract, tag regex anchor, secrets pre-flight references for
   all three gpg secrets, fixture/boundary/build ordering, gpg
   signing step (`--detach-sign --armor` + `Good signature` grep),
   SHA-256 checksum manifest, and artifact upload of
   `*.AppImage` + `*.AppImage.sig`. Also runs a line-scoped
   command-injection guard rejecting untrusted GitHub expressions
   (`inputs.tag`, gpg secrets) inlined inside `run:` script bodies.
3. **`package.json`** — adds
   `validate:linux-signed-release-pipeline` script wired to the
   new validator file.

## Files

- new: `.github/workflows/linux-signed-release.yml` (213 LOC)
- new: `scripts/validate-linux-signed-release-pipeline.ts` (~191 LOC)
- modified (1-line add): `package.json`
- new: `docs/tickets/T254-linux-signed-build-workflow.md`
- new: `docs/worklog/T254-linux-signed-build-workflow.md`

## Design decisions

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | `workflow_dispatch` only, no `push`/`pull_request` triggers | Real gpg signing burns credentials and produces an artifact that should ship by intent, not by accident. Mirrors T251 + T256. |
| 2 | Three secrets (`ROX_LINUX_GPG_KEY`, `..._KEY_ID`, `..._PASSPHRASE`) | Minimal viable signing surface — private key, key fingerprint for `--local-user`, and passphrase via `--pinentry-mode loopback --passphrase-fd 0`. Symmetric with Mac's five (CSC + Apple ID + team), Windows' future Authenticode (T255). |
| 3 | Detached `--armor` `.sig` sidecar, not embedded | AppImage runtime cannot natively re-verify an embedded signature; a detached sidecar is the conventional Linux-package signing pattern (also used by Tor, ProtonMail, Bitwarden AppImages). Consumers can offline-verify with the public key. |
| 4 | `find ... -name '*.AppImage' -print -quit` to locate artifact | electron-builder's Linux artifact name depends on version + arch and is parameterized in `electron-builder.yml` (currently `ROX-ONE-${arch}.${ext}`). Discovering at runtime avoids brittle string-equality on the path. |
| 5 | Separate validator (`scripts/validate-linux-signed-release-pipeline.ts`) instead of extending the T253 boundary validator | T253 instructions explicitly freeze the boundary validator — extend only by separate validator file. Keeps responsibility boundaries clean: T253 validates the bundle shape; T254 validates the workflow shape. |
| 6 | Line-scoped command-injection guard | Earlier regex `run:[^|]*\$\{\{...\}\}` was too greedy across line boundaries. A per-line scanner that knows when it is inside an `env:` block correctly flags `${{ ... }}` references that escape the env-var binding. |
| 7 | `ubuntu-22.04` runner pinned | Match the AppImage build target used in T253 fixtures and `electron-builder.yml`. Avoids the floating-major `ubuntu-latest` issue that bit other repos when GitHub rolled `latest` to 24.04. |

## Validation gates

- `bun run validate:linux-signed-release-pipeline` — pass.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass with T254
  `Status: DONE`.
- `bun run validate:roadmap` — pass.

## Constraints

- No real gpg credentials added to the repo or CI environment.
  Secrets contract is documented as a shape-only requirement.
- Mac (T250/T251) and Windows (T252) surfaces untouched.
- `scripts/validate-linux-private-release-boundary.ts` (T253)
  unchanged — the new pipeline validator lives in a separate file.
- `.swarm/master-roadmap-log.md` untouched.

## Follow-ups

- **T255** — Windows signed-build CI workflow (Authenticode via
  Azure Code Signing or DigiCert KeyLocker, fed by repo secrets).
- **M.18 closeout** — with T254 the cross-platform signed-build
  CI mirror is complete for Mac + Linux. Only Windows
  Authenticode (T255) remains before public production can lift
  the signing blocker.
