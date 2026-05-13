# T359 — v1.0.0 Release Prep: Ticket, 72h Soak Monitoring Plan, Rollback Plan

Status: DONE
Lane: M.21 (v1.0.0 release prep)

## Context

Phase 21 of the master roadmap closes the project by tagging `v1.0.0`, soaking
for 72 hours, and rolling back only if a soak-failure fires. The audit-log and
observability foundation (PR #99, M.14/T245) is merged. The auto-update path is
hardened (PR #156 weaknesses fixed by PR #179). The RC pre-flight checklist
(`docs/release/v1-rc-preflight-checklist.md`) and the RC soak protocol
(`docs/release/v1-rc-72h-soak-protocol.md`) cover the RC phase; this ticket
covers the **GA promotion** planning artifacts that live beyond the RC doc set.

## Goal

Land three operator-facing artifacts on `main` so M.21 execution is fully
plannable without authoring governance prose during the tag window:

1. **`docs/tickets/T359-v1-release-prep.md`** (this file) — the prep ticket
   with pre-release checklist, tag procedure, GitHub Release note generation
   instructions, and distribution channel list.
2. **`docs/release/v1-soak-monitoring.md`** — the 72-hour soak monitoring plan
   with metrics, sources, rollback thresholds, and on-call expectations.
3. **`docs/release/v1-rollback-plan.md`** — decision criteria, rollback
   mechanism, communication templates, and recovery path.

## Scope (DOCS-ONLY)

| File | Change |
| --- | --- |
| `docs/tickets/T359-v1-release-prep.md` | New file (this ticket). |
| `docs/release/v1-soak-monitoring.md` | New file — 72h monitoring plan. |
| `docs/release/v1-rollback-plan.md` | New file — rollback plan template. |
| `docs/worklog/T359-v1-release-prep.md` | New worklog. |
| `.swarm/master-roadmap-log.md` | Append `M.21-release-prep-authored` entry. |

No source code, no validators, no CI changes.

## Pre-Release Checklist

The following items must all be green before the operator runs `git tag v1.0.0`.
Items marked `(RC)` are inherited from `v1-rc-preflight-checklist.md` and must
remain green on the GA candidate SHA.

### 1. Phase 20 RC scenarios green (inherited from M.20)

| Scenario | Evidence location |
| --- | --- |
| S01 — registration flow | `docs/release/v1-rc-evidence-<DATE>.md` §4 |
| S02 — prompt pipeline | same |
| S03 — mission checkpoint | same |
| S04 — arena swarm VDI | same |
| S05 — team invite + RBAC | same |
| S06 — file upload / entity graph | same |
| S07 — sync conflict resolution | same |
| S08 (if added) | same |

Gate: all registered scenarios must show `PASS` in the evidence doc. Any
`FAIL` or `SKIP` blocks tagging.

### 2. Validator gate suite

Run on the exact SHA to be tagged, in order:

```sh
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
bun run validate:ci
bun run validate:release
```

All must exit 0. Record exit codes and runtimes in the evidence doc.

### 3. Signed Mac build

Trigger the `mac-arm-build` GitHub Actions workflow on the GA candidate SHA.
The workflow must complete notarization and produce a signed `.dmg`. Record
the workflow run URL in the evidence doc.

### 4. SBOM artifact

CycloneDX SBOM is emitted as a CI artifact on the GA candidate SHA. Attach
`sbom.json` (or `sbom.xml`) to the GitHub Release alongside the platform
artifacts. Verify the artifact exists before publishing.

### 5. Secret-leak scan

```sh
gitleaks detect --source . --log-opts "v1.0.0-rc.1..HEAD"
trufflehog git file://. --since-commit v1.0.0-rc.1
```

Both must exit 0. Record results in the evidence doc.

### 6. Open P0/P1 issues

Run the `release-validator` skill and confirm:

- P0 open issues: **0**
- P1 open issues: **0**

Any non-zero count blocks the GA tag.

## Tag Creation Procedure

```sh
# 1. Ensure you are on the soak-passing SHA
git fetch origin
git checkout main
git pull --ff-only

# 2. Verify the candidate SHA matches the soak-evidence doc
git log -1 --format="%H %s"

# 3. Create an annotated tag (signed if GPG key available)
git tag -a v1.0.0 -m "v1.0.0 — first stable ROX.ONE release"
# Or, with GPG signing:
git tag -s v1.0.0 -m "v1.0.0 — first stable ROX.ONE release"

# 4. Push the tag
git push origin v1.0.0

# 5. Verify the tag is visible on origin
git ls-remote origin refs/tags/v1.0.0
```

If the push is rejected (tag already exists from a botched RC), do **not**
force-push. Delete the remote tag explicitly, then re-push:

```sh
git push origin :refs/tags/v1.0.0   # delete remote tag
git push origin v1.0.0               # push clean tag
```

## GitHub Release Notes Auto-Generation

The release body template lives in
`docs/release/v1-github-release-template.md`. To publish the GitHub Release:

1. Fill in all `<…>` placeholder spans in the template (release date, soak
   close date, SHA, and per-artifact `sha256` checksums).
2. Generate checksums:
   ```sh
   sha256sum dist/ROX.ONE-1.0.0-mac-arm64.dmg \
             dist/ROX.ONE-Setup-1.0.0.exe \
             dist/ROX.ONE-1.0.0-amd64.AppImage \
             > dist/SHA256SUMS.txt
   ```
3. Create the release via GitHub CLI:
   ```sh
   gh release create v1.0.0 \
     --title "ROX.ONE v1.0.0" \
     --notes-file docs/release/v1-github-release-template.md \
     --latest \
     dist/ROX.ONE-1.0.0-mac-arm64.dmg \
     dist/ROX.ONE-Setup-1.0.0.exe \
     dist/ROX.ONE-1.0.0-amd64.AppImage \
     dist/SHA256SUMS.txt \
     sbom.json
   ```
4. Verify the release page renders correctly; confirm the "Latest release"
   badge appears on the repository landing page.

Alternatively, paste the rendered Markdown body into the GitHub UI and attach
artifacts by drag-and-drop, then publish.

## Distribution Channels

| Channel | Artifact | Notes |
| --- | --- | --- |
| macOS (Apple Silicon) | `ROX.ONE-1.0.0-mac-arm64.dmg` | Notarized; Gatekeeper-transparent |
| macOS (Intel) | `ROX.ONE-1.0.0-mac-x64.dmg` | If built; same notarization flow |
| Windows | `ROX.ONE-Setup-1.0.0.exe` | NSIS installer; code-signing required for SmartScreen bypass |
| Linux | `ROX.ONE-1.0.0-amd64.AppImage` | AppImage; `chmod +x` then run directly |
| Install script (Mac/Linux) | `scripts/install-app.sh` | curl-pipe install; pulls latest DMG/AppImage from GitHub Releases |
| Install script (Windows) | `scripts/install-app.ps1` | PowerShell; pulls latest `.exe` from GitHub Releases |
| GitHub Release page | All above + `SHA256SUMS.txt` + `sbom.json` | Primary distribution point |
| In-app auto-update | `electron-updater` feed | Served from private release pipeline (ADR-0109); hardened in PR #179 |

## Required Subagents

None — DOCS-ONLY ticket.

## TDD Requirements

Not applicable (documentation only). Validation is via:

```sh
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

## Acceptance Criteria

- [x] `docs/tickets/T359-v1-release-prep.md` exists with `Status: DONE`.
- [x] `docs/release/v1-soak-monitoring.md` exists with metrics table,
      rollback thresholds, and on-call section.
- [x] `docs/release/v1-rollback-plan.md` exists with decision criteria,
      rollback mechanism, communication templates, and recovery path.
- [x] `docs/worklog/T359-v1-release-prep.md` exists.
- [x] `.swarm/master-roadmap-log.md` contains `M.21-release-prep-authored`.
- [x] `bun run validate:rebrand` exits 0.
- [x] `bun run validate:agent-contract` exits 0.
- [x] `bun run validate:roadmap` exits 0.
- [x] PR opened against `main`.

## Worklog

See `docs/worklog/T359-v1-release-prep.md`.
