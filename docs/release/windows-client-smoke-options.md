# Windows client smoke: coverage gap and options

Date: 2026-05-20
Status: Decision pending — see §5 for Linear traceability.

---

## 1. Current coverage gap

### What Server SKU runners do test

`multi-platform-on-merge.yml` runs Windows jobs on `windows-2022` and
`windows-2025`. Both are **Windows Server** images provided by GitHub-hosted
runners. They validate:

| Surface | How tested |
|---|---|
| NSIS installer build | `bunx electron-builder --win --x64` completes without error |
| Authenticode signature | `Get-AuthenticodeSignature` asserts `SignatureType == Authenticode` |
| `signtool`-compatible cert path | PFX staged via `WIN_SELF_SIGNED_CERT_PFX` secret |
| NT kernel API compatibility | Electron prebuilt resolves DLLs at build time |
| .NET Framework presence | Implicitly confirmed when NSIS packages without error |
| SHA-256 sidecar | Computed and uploaded to the nightly GitHub pre-release |
| SBOM generation | `@cyclonedx/cdxgen` runs after packaging on both SKUs |

The `windows-x64-2025` job additionally exercises the `-w2025` ABI-suffix
rename logic to prevent double-publish collisions.

**No smoke launch occurs on any Windows job.** The packaged `.exe` is
built and signed but never executed. The Mac job performs a Playwright
launch smoke (`nightly-smoke.mjs`). No equivalent exists for Windows.

### What Server SKUs do NOT test

| Gap | Why Server SKUs can't catch it |
|---|---|
| DWM compositor frame rendering | Windows Server disables Aero/DWM compositing in headless/RDP sessions by default; Electron's GPU path either crashes or paints black frames that a screenshot check would accept as valid |
| Client accent color / mica/acrylic theming | Windows Server 2022 lacks Mica (Windows 11 client-only). Accent color API resolves to `#0078d4` fallback rather than user preference |
| SmartScreen client UX | Windows Server does not run SmartScreen Application Reputation; the warning dialog triggered on Win10/Win11 client installs is never exercised |
| Windows 11 OOBE / first-run setup interference | Only occurs on fresh Win11 client installs; Server images skip OOBE |
| Modern App framework variants | `WinUI` / `App SDK` interactions differ between Server and Client editions at the `Dwm*` and `Shell_NotifyIcon` call level |
| NSIS silent install under UAC prompt flow | Windows Server CI runs as `SYSTEM`; UAC elevation behavior differs on standard Win10/Win11 user accounts |

The gap is **real but narrow**: for most Electron app functionality (main
process startup, renderer load, IPC, file I/O) Windows Server and Windows
Client are functionally equivalent at the NT API layer. The gap matters most
for the first-launch UX and compositing correctness.

---

## 2. Three options to close the gap

### Option A — Self-hosted GitHub Actions runner on a Win10/Win11 VM

**How it works.** Provision a Windows 11 VM on a hosting provider with a
desktop GPU (or software rendering via WARP), install the GitHub Actions
`actions/runner` agent, register it to the private repo with a
`win-client` label, and add a new workflow `win-client-smoke.yml` that
targets `runs-on: [self-hosted, win-client]`.

**Cost.**

| Item | Monthly cost |
|---|---|
| Hetzner CCX13 (4 vCPU, 16 GB RAM, Windows 11 license) | ~€18–22/mo (~$20–24) |
| Storage (Windows image + NSIS artefact) | ~€2/mo |
| Data transfer (nightly downloads of installer from GH release) | <€1/mo |
| **Total (dedicated VM)** | **~$22–27/mo** |

If the team already runs a bare-metal or cloud host for other workloads,
the marginal cost is near zero — the runner agent is a background service
consuming ~100 MB RAM when idle.

**One-time setup effort.** Four steps:
1. Provision the VM and install Windows 11 (Hetzner provides an image).
2. Create a service account, enable auto-login, disable sleep.
3. Download and register the runner agent (`./config.cmd --url <repo> --token <pat> --labels win-client --runasservice`).
4. Install Visual C++ Redistributable and Electron test prerequisites (`npm`, `node`).

Estimated one-time effort: 4–6 hours including hardening steps below.

**Security hardening (required).** The runner agent executes arbitrary
workflow YAML. On a self-hosted runner this means the host is a trust
boundary:

- Run the runner agent under a **dedicated non-admin service account**
  (`roxci`), not `SYSTEM`.
- Enable Windows Defender real-time protection; restrict `roxci` write
  access to only the runner work directory (`C:\actions-runner\_work`).
- Block outbound connections except to `github.com`, `api.github.com`,
  `*.actions.githubusercontent.com`, and `hetzner.com` update endpoints.
- Do not add the runner to the `Administrators` group. The NSIS installer
  smoke can run in user mode; `runas` elevation is not needed for the
  launch check.
- See §5 for fork/untrusted-PR restrictions.

**Maintenance.** Monthly Windows Update restart (~2 h/year total effort).
GitHub Actions runner agent auto-updates. No manual runner binary updates
needed after initial setup.

**Verdict.** Cheapest, highest control, lowest vendor lock-in. Requires
~6 h of one-time setup and one engineer willing to own the VM.

---

### Option B — BrowserStack App Live or LambdaTest Real Device Cloud

**How it works.** BrowserStack App Live and LambdaTest offer cloud-hosted
Windows 10/11 desktop VMs accessible via a browser-based RDP UI or a thin
CLI. The NSIS installer is uploaded, installed, and manually exercised.

**Cost.**

| Provider | Plan | Monthly cost |
|---|---|---|
| BrowserStack App Live | Automate plan (2 parallel sessions) | ~$79/mo |
| LambdaTest | Web Automation plan (5 parallel) | ~$99/mo |

Both offer usage-based tiers that could be lower for infrequent runs
(~$30–40/mo at minimum commit).

**Integration.** Both provide a CLI binary (`browserstack-local`,
`lt-tunnel`) that opens a tunnel for the GitHub Actions runner. The
workflow step uploads the built `.exe` and triggers a session. Automation
depth is limited: BrowserStack App Live and LambdaTest's desktop sessions
are primarily designed for manual GUI interaction; programmatic Playwright
scripts running inside their VMs require an additional `desktopAutomation`
tier.

**Pros.**
- No infra ownership; VMs are maintained by the provider.
- Immediate access to real Win10 and Win11 client images including patch
  levels current within 30 days.

**Cons.**
- Limited automation depth without the premium tier (manual or
  BrowserStack Automate for Electron, which is not officially supported).
- Monthly cost 3–5x higher than Option A for equivalent parallel sessions.
- Vendor dependency: if BrowserStack deprecates desktop Windows support
  (as App Live pricing has shifted before), the CI integration breaks.
- The NSIS installer must be uploaded to a third-party service, which
  adds a supply-chain surface.

**Verdict.** Viable for occasional manual regression checks but not for
automated nightly CI. Cost-benefit ratio unfavorable compared to Option A.

---

### Option C — Microsoft Dev Box hosted Windows 11 environment

**How it works.** Microsoft Dev Box is an Azure-hosted managed developer
workstation running a full Windows 11 client image. Accessible via RDP or
a browser. A GitHub Actions runner agent can be installed inside a Dev Box.

**Cost.**

| SKU | vCPU | RAM | Monthly cost (always-on) |
|---|---|---|---|
| 8c / 32 GB | 8 | 32 GB | ~$155/mo |
| 4c / 16 GB | 4 | 16 GB | ~$75/mo |
| Hibernation (8h/day active) | 8 | 32 GB | ~$52/mo |

Minimum viable cost with hibernation: **~$52/mo**. Always-on for nightly
builds: ~$75–155/mo.

**Pros.**
- Official Microsoft image; GPU-enabled VMs available; DWM compositing
  works out of the box.
- Integrated with Azure AD; easy SSO for the team.

**Cons.**
- Requires an Azure subscription and a Dev Center / Project setup (~2 h
  one-time provisioning via ARM templates or Bicep).
- Vendor lock-in: Dev Box is an Azure-only service.
- Networking: Dev Box uses vNet peering; connecting the runner agent
  to GitHub Actions requires outbound HTTPS access through Azure NSG rules.
  The default Dev Box vNet blocks outbound internet unless explicitly
  opened.
- Cost is 3–7x Option A for equivalent specs.
- Microsoft licensing terms for Dev Box restrict some automated test
  use cases; review the Dev Box SLA before committing.

**Verdict.** Best option if the team is already fully invested in Azure
and Azure AD. Otherwise, cost and complexity outweigh Option A.

---

## 3. Recommendation

**Adopt Option A** (self-hosted runner on a Hetzner Win11 VM).

Rationale:

1. **Cost.** At ~$25/mo, it is the lowest-cost option by a factor of 3–6
   compared to B and C. Month-1 all-in (VM + setup time at $100/h
   engineer rate × 6 h) is ~$625. Month-2+ is ~$25/mo.
2. **Control.** The runner executes inside a VM you control; no installer
   binary leaves your infrastructure.
3. **Automation depth.** A self-hosted runner can run the same
   Playwright-Electron smoke script used on Mac, adapted for Windows paths.
   No additional licensing or API tier needed.
4. **Maintenance burden is low.** Windows Update once a month, runner
   agent self-updates.

**When to choose differently:**
- Choose Option B if the team has zero capacity for VM ownership and
  can accept manual-only smoke checks.
- Choose Option C if the team is already paying for Azure and wants
  Microsoft-managed images at any cost.

**Month-1 cost estimate (Option A):** ~$25 infrastructure + ~$600
engineer setup time = ~$625 one-time, then ~$25/mo ongoing.

---

## 4. Architecture sketch — `win-client-smoke.yml`

The new workflow is **not created in this PR** — this section is a spec for
the implementation ticket.

### How it differs from `multi-platform-on-merge.yml`

| Concern | `multi-platform-on-merge.yml` | `win-client-smoke.yml` |
|---|---|---|
| Runner | `windows-2022` / `windows-2025` (GitHub-hosted Server) | `[self-hosted, win-client]` (Hetzner Win11 VM) |
| Trigger | Push to `main` | Download nightly release asset; or `workflow_dispatch` |
| Build step | Full `bunx electron-builder` from source | Download pre-built `.exe` from nightly GH release (no re-build) |
| Signing check | Authenticode signature assertion | Authenticode assertion + SmartScreen simulation (`-NoLogo` flag on `Start-Process`) |
| Smoke launch | None | Silent NSIS install + Playwright-Electron launch + DWM screenshot check |
| DWM assertion | N/A | Screenshot > 40 KB (non-black frame) |

### Step outline for `win-client-smoke.yml`

```yaml
# win-client-smoke.yml — SPEC ONLY, not a runnable file
#
# Trigger: workflow_dispatch OR download of nightly-* release asset
# Runner: [self-hosted, win-client]

steps:
  - name: Download nightly installer
    # gh release download latest --pattern 'ROX-ONE-*x64.exe'
    # Prefer the canonical x64 build, not the -w2025 ABI-smoke artefact.

  - name: Verify Authenticode signature
    # Get-AuthenticodeSignature asserts SignatureType == Authenticode
    # Same check as multi-platform-on-merge.yml step 6.

  - name: Silent NSIS install
    # Start-Process -Wait -ArgumentList '/S' (NSIS silent flag)
    # Assert exit code 0 and that install dir exists at
    # $env:LOCALAPPDATA\Programs\ROX.ONE\ROX.ONE.exe

  - name: Install Playwright ad-hoc (same pattern as Mac smoke)
    # npm install --prefix C:\Temp\pw @playwright/test@^1.48
    # npx --yes playwright install chromium

  - name: Launch smoke (Playwright-Electron)
    # electron.launch({ executablePath: '...ROX.ONE.exe', timeout: 30000 })
    # firstWindow(), 10 s settle, screenshot to C:\Temp\smoke.png
    # Fail if screenshot < 40 KB (black/white frame on DWM failure)

  - name: Upload smoke screenshot as artifact
    # Always upload so CI reviewers can inspect on failure.

  - name: Uninstall
    # Start-Process -Wait $uninstaller '/S'
    # Assert install dir is gone.
```

The `win-client-smoke.yml` workflow would NOT be added to the
`multi-platform-on-merge.yml` matrix. It runs separately on a `nightly-*`
release asset to keep the main merge pipeline fast and avoid blocking
merges on self-hosted runner availability.

---

## 5. Risk: GitHub Actions runner secrets on a self-hosted box

A self-hosted runner executes workflow YAML in the runner's user context.
An attacker who controls a workflow step can exfiltrate secrets available
to that job. Mitigations:

### Never run untrusted code from forks

The repo is private. No external fork can open a PR. This eliminates the
primary attack vector (malicious PRs triggering self-hosted runner jobs).

Document this constraint explicitly in the runner registration script
comments and in the repository settings:

```
Repository settings → Actions → Runner groups:
  Group: win-client-runners
  Access: This repository only
  Allow public repositories: OFF
```

### Restrict secrets scoped to the smoke workflow

The `win-client-smoke.yml` job should receive **only** the secrets it needs:

- `GITHUB_TOKEN` (read-only: download nightly release asset)
- No `WIN_SELF_SIGNED_CERT_PFX`, `R2_*`, or other deployment secrets

Use GitHub's `secrets` scoping at the environment level: create a
`win-client-smoke` environment with no secrets beyond `GITHUB_TOKEN`.

### Restrict the runner label to explicit workflows

In the runner group settings, restrict which workflows can use the
`win-client` label. Only `win-client-smoke.yml` should have access.

### Runner isolation checklist

- [ ] Runner service account (`roxci`) is non-admin
- [ ] `roxci` has no access to `C:\Users\Administrator` or other service accounts
- [ ] Outbound firewall rules limit connections to GitHub endpoints only
- [ ] Windows Defender real-time protection enabled
- [ ] VM snapshot taken after initial setup (restore point if runner is compromised)
- [ ] Runner agent version pinned in setup script; auto-update enabled via GitHub setting

---

## 6. Linear traceability

Once the team decides to proceed with Option A, create a Linear issue:

```
Title:  Win client smoke — Option A spike
Parent: PZD-24
Label:  infra, ci, spike
```

The spike ticket should produce:
1. A Hetzner VM provisioned and hardened.
2. The runner agent registered under the `win-client` label.
3. A draft `win-client-smoke.yml` committed to a feature branch for review.
4. Smoke screenshot evidence attached to the PR.

**Scope boundary.** This document is the decision record. Implementation
begins after the team explicitly accepts Option A in the spike ticket.
The `win-client-smoke.yml` workflow file is out of scope for this PR.
