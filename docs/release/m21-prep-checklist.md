# M.21 Prep Checklist — v1.0.0 GA Promotion

This checklist runs **after the 72h soak window closes green** on
`v1.0.0-rc.1` (or the latest rc.N). It is the operator handover document
between soak completion and the public `v1.0.0` tag.

Reference:
- `docs/release/v1-rc-72h-soak-protocol.md` — soak rules
- `docs/release/v1-rc-tag-decision-matrix.md` — GO/NO-GO criteria
- `docs/release/v1-github-release-template.md` — Release body template
- `docs/release/v1-soak-monitoring.md` — what to watch during soak

---

## Phase A — Soak closure verification

Run on the soak-closing SHA (the tag this RC pins to):

- [ ] Soak window is ≥ 72 hours from tag time (per `v1-rc-72h-soak-protocol.md`)
- [ ] Zero P0 incidents during soak (per `v1-soak-monitoring.md`)
- [ ] Zero `release-blocker` issues opened during soak:
      `gh issue list --label release-blocker --state open`
- [ ] All RC-tag CI workflows green or accepted-yellow:
      `gh run list --commit <RC_TAG_SHA>` (treat documented caveats as yellow)
- [ ] `bun run rc:preflight` green at HEAD of `main`
- [ ] Signed-build artifacts produced + sha256-verifiable:
      - macOS arm64 dmg
      - macOS x64 dmg
      - Windows installer exe
      - Linux deb + rpm + AppImage
      - Docker `rox-one-server` image

## Phase B — Document promotion

- [ ] `CHANGELOG.md` `[1.0.0]` entry: replace `TBD (after 72h soak)` with the actual release date
- [ ] `CHANGELOG.md`: scan for any `[Unreleased]` items that need re-categorising into 1.0.0 vs 1.0.1
- [ ] `docs/release/v1-known-limitations.md`: final sweep for any limitation that landed during soak
- [ ] Cross-check `m20-phase-20-closeout.md` deliverable list matches what's shipping

## Phase C — Tag the GA

- [ ] On clean soak SHA, run:
      ```bash
      git tag -a v1.0.0 -F <annotation-body-file> <SOAK_SHA>
      git push origin v1.0.0
      ```
- [ ] Annotation body composition: copy from the rc.1 tag annotation, replace `v1.0.0-rc.N` → `v1.0.0`, replace "Release Candidate" → "Final Release", strip rollback section (no longer applicable post-promotion)
- [ ] Verify tag on origin:
      ```bash
      git ls-remote --tags origin v1.0.0
      ```

## Phase D — Publish GitHub Release

- [ ] Render `docs/release/v1-github-release-template.md` operator section into final release body
- [ ] Replace placeholders:
      - `<YYYY-MM-DD>` release date
      - `<YYYY-MM-DD>` soak-window-closed date
      - `<sha256-of-mac-arm64-dmg>` etc. checksum placeholders
- [ ] Compose checksum manifest:
      ```bash
      sha256sum ROX.ONE-1.0.0-arm64.dmg ROX.ONE-1.0.0-x64.dmg \
                ROX.ONE-Setup-1.0.0.exe ROX.ONE-1.0.0.AppImage \
                > SHA256SUMS.txt
      ```
- [ ] Create release:
      ```bash
      gh release create v1.0.0 \
        --title "ROX.ONE v1.0.0" \
        --notes-file <rendered-body.md> \
        ROX.ONE-1.0.0-arm64.dmg \
        ROX.ONE-1.0.0-x64.dmg \
        ROX.ONE-Setup-1.0.0.exe \
        ROX.ONE-1.0.0.AppImage \
        SHA256SUMS.txt
      ```
- [ ] Mark "Latest release" — do NOT mark "Pre-release"
- [ ] Delete the `v1.0.0-rc.N` draft release (cleanup):
      `gh release delete v1.0.0-rc.<N> --yes` (the RC tag remains for traceability)

## Phase E — Distribution

- [ ] Docker image push:
      ```bash
      docker pull ghcr.io/agisota/rox-one-server:<rc-tag>
      docker tag ghcr.io/agisota/rox-one-server:<rc-tag> ghcr.io/agisota/rox-one-server:1.0.0
      docker tag ghcr.io/agisota/rox-one-server:<rc-tag> ghcr.io/agisota/rox-one-server:latest
      docker push ghcr.io/agisota/rox-one-server:1.0.0
      docker push ghcr.io/agisota/rox-one-server:latest
      ```
- [ ] Auto-update channel: bump stable channel manifest to `1.0.0` (per
      auto-update workflow conventions)
- [ ] Notify downstream consumers (community channels, mailing list, etc.)

## Phase F — Post-release hygiene

- [ ] Bump version in `package.json` to next pre-release (e.g., `1.1.0-pre.0`) on a `chore/post-release-bump` branch
- [ ] Open milestone `v1.1.0` for tracking
- [ ] Archive the soak monitoring board (`v1-soak-monitoring.md` outputs)
- [ ] Update `docs/release/r11-active-goal-inventory-*.md` if R.11 is the next gated operation
- [ ] File retrospective ticket: `docs/tickets/T???-v1-retrospective.md`

## Rollback contingency

If a P0 surfaces between Phase C tag and Phase D publish:

1. `git tag -d v1.0.0` locally
2. `git push --delete origin v1.0.0`
3. Do NOT delete the rc.N tag — it preserves the soak-passing SHA for re-roll
4. File `T???-v1.0.0-promotion-rollback-<reason>.md` ticket
5. Land fix on main as a separate PR
6. Re-evaluate: hotfix → re-tag v1.0.0, or new RC cycle if scope larger
