# OS Lab Coverage — ROX.ONE Packaged Launch (PZD-54)

**Generated:** 2026-05-20
**Branch:** `chore/pzd54-oslab`
**Source:** `.github/workflows/*.yml` read from `origin/main` (commit `31bbd5eb5`)

---

## Canonical Coverage Table

| OS Family | Version | Workflow(s) | Build | Smoke Launch | Install (pkg) | Signing | Rox Design Init | Gap |
|-----------|---------|-------------|:-----:|:------------:|:-------------:|:-------:|:---------------:|-----|
| **macOS** | 14 (Sonoma) | `mac-diag-smoke.yml` | Yes | Yes — Playwright screenshot ≥20 KB | n/a (dir mode) | ad-hoc only | No | No Developer ID signing; macOS 13 (Ventura) absent from push matrix |
| **macOS** | 15 (Sequoia) | `mac-diag-smoke.yml`, `multi-platform-on-merge.yml`, `cross-platform-launch.yml` | Yes | Yes — Playwright screenshot ≥20 KB | DMG (re-pack after smoke) | ad-hoc only | No | No Developer ID signing or notarization; `mac-signed-release.yml` is dispatch-only |
| **macOS** | 15 (Sequoia) — signed | `mac-signed-release.yml` | Yes | No (ROX_HEADLESS=1) | DMG + notarized | Developer ID + notarize + staple | No | Dispatch-only; no on-merge trigger; no Rox Design init check |
| **macOS** | 13 (Ventura) | *(none active)* | No | No | No | No | No | **Full gap** — workflow comment explicitly defers Ventura to self-hosted VM |
| **Windows** | 2022 | `multi-platform-on-merge.yml`, `cross-platform-launch.yml`, `windows-unsigned-release.yml` | Yes | Yes (smoke:packaged, headless) | NSIS .exe | Self-signed (optional, gated on secret) | No | Authenticode signing gated on `WIN_SELF_SIGNED_CERT_PFX` secret; no EV cert; no real launch UI test |
| **Windows** | 2025 | `multi-platform-on-merge.yml` | Yes | No (build + package only) | NSIS .exe (-w2025 suffix) | Self-signed (optional, gated on secret) | No | No smoke launch on 2025 runner; ABI-smoke only; no install validation |
| **Linux** | Ubuntu 22.04 | `linux-distros-smoke.yml`, `cross-platform-launch.yml`, `linux-signed-release.yml` | Yes | Yes — xvfb-run `--version` | DEB + AppImage | GPG detached sig (`linux-signed-release.yml`, dispatch-only) | No | GPG signing dispatch-only; no `--version` = headless only; no UI smoke |
| **Linux** | Ubuntu 24.04 | `linux-distros-smoke.yml`, `cross-platform-launch.yml` | Yes | Yes — xvfb-run `--version` | DEB | No | No | No signed release path; no GPG for Ubuntu 24.04 specifically |
| **Linux** | Debian 12 | `linux-distros-smoke.yml`, `cross-platform-launch.yml` (launcher-guard only) | Yes | Yes — xvfb-run `--version` | DEB | No | No | Launcher guard validates `install-app.sh` tokens only; no binary install smoke |
| **Linux** | Fedora 40 | `linux-distros-smoke.yml`, `cross-platform-launch.yml` (launcher-guard only) | Yes | Yes — xvfb-run `--version` | RPM | No | No | `--nodeps` RPM install workaround; no signed RPM; launcher guard only (no binary smoke) |
| **Linux** | AppImage (Ubuntu 22.04) | `linux-distros-smoke.yml` | Yes | Yes — `--appimage-extract-and-run --version` | AppImage | GPG (dispatch-only) | No | FUSE dependency; no UI launch; AppImage not tested on Debian/Fedora/NixOS containers |
| **NixOS** | nixos-24.05 (flake) | `nixos-smoke.yml`, `cross-platform-launch.yml` (launcher-guard) | Yes — Nix flake build | Yes — `--help` (no FHS/linker crash) | Nix flake wrapper | No | No | Phase 2 skipped when no release tag exists; `--no-sandbox` required (GH runner limitation); Electron sandbox disabled |

---

## Context

### Coverage strategy

ROX.ONE uses a layered CI strategy. The innermost layer — automated on every push to `main` — covers macOS 15 (Sequoia arm64), Ubuntu 22.04, Ubuntu 24.04, Windows 2022, and Windows 2025 via `cross-platform-launch.yml` and `multi-platform-on-merge.yml`. These jobs verify build success, packaged binary execution (headless or Playwright screenshot), and artifact metadata validation. A second layer of distro-specific smoke tests (`linux-distros-smoke.yml`, `nixos-smoke.yml`) covers Debian 12, Fedora 40, and NixOS but runs only on `feat/multiplatform-*` branches or manual dispatch, not on every merge to `main`. Signed-release workflows (`mac-signed-release.yml`, `linux-signed-release.yml`) are always dispatch-only and require externally provisioned secrets.

### What "smoke launch" means per OS

On macOS, the smoke test captures a Playwright screenshot of the packaged `.app` with `ROX_DIAG=1` and enforces a 20 KB minimum file size to distinguish a real UI render from a white-window hang. On Linux, the smoke test invokes `xvfb-run rox-one --version` inside a container matching the target distro image — this validates the binary starts cleanly under Xvfb but does not verify any UI rendering. On NixOS, the smoke test runs `--help` through the Nix flake wrapper and asserts the absence of FHS/dynamic-linker errors. On Windows, the smoke test invokes `electron:smoke:packaged` in headless mode (`ROX_HEADLESS=1`); no GUI launch is verified by CI on Windows.

### Known gaps and risk register

Three gaps carry the highest release risk. First, **macOS 13 (Ventura)** has zero automated coverage — the `mac-diag-smoke.yml` comment explicitly documents that GitHub-hosted `macos-13` runners are allocation-unreliable and blocks PRs without launch evidence; Ventura proof currently requires a self-hosted VM which is not provisioned. Second, **Windows code signing** is fully contingent on the `WIN_SELF_SIGNED_CERT_PFX` secret being provisioned in the repository; without it, both the nightly and unsigned-release Windows jobs produce unsigned NSIS installers that trigger SmartScreen warnings on every end-user install — the `windows-unsigned-release.yml` header documents the migration path (DigiCert/Sectigo EV cert → `CSC_LINK`/`CSC_KEY_PASSWORD`). Third, **macOS signed/notarized DMG** (`mac-signed-release.yml`) requires five Apple Developer secrets and is dispatch-only; on-merge nightly builds use `CSC_IDENTITY_AUTO_DISCOVERY=false` and produce ad-hoc-signed builds that Gatekeeper will quarantine for users downloading outside the App Store or without the `right-click → Open` workaround.

---

## Workflow Reference Index

| Workflow file | Trigger | OS targets |
|---|---|---|
| `mac-diag-smoke.yml` | `push fix/multiplatform-mac-*`, `workflow_dispatch` | macos-14, macos-15 |
| `mac-signed-release.yml` | `workflow_dispatch` | macos-15-xlarge (arm64) |
| `mac-unsigned-release.yml` | `workflow_dispatch` | macos-15-xlarge (arm64) |
| `linux-distros-smoke.yml` | `push feat/multiplatform-linux-*`, `workflow_dispatch` | ubuntu-22.04 + containers (ubuntu:22.04, ubuntu:24.04, debian:12, fedora:40) |
| `linux-signed-release.yml` | `workflow_dispatch` | ubuntu-22.04 |
| `nixos-smoke.yml` | `push feat/multiplatform-nixos-*`, `workflow_dispatch` | ubuntu-22.04 + Nix (nixos-24.05) |
| `multi-platform-on-merge.yml` | `push main` | macos-15-xlarge, ubuntu-22.04, windows-2022, windows-2025 |
| `cross-platform-launch.yml` | `push main`, `pull_request` | macos-15, ubuntu-22.04, ubuntu-24.04, windows-latest, windows-2022 + containers (debian:12, fedora:40, nixos/nix) |
| `windows-unsigned-release.yml` | `workflow_dispatch` | windows-latest |
