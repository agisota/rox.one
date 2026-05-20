# Decision T091a: SHA-256-pinned supply chain for Rox Design embedded runtime payload

- Status: proposed
- Date: 2026-05-20
- Implements: T091 (Rox Design managed-view bridge), PZD-51 (B-REPRO-2 reproducibility gate)
- Source ticket: `docs/tickets/T091-rox-design-managed-view-bridge.md`
- Audit: `docs/audits/2026-05-20-pr268-release-readiness-audit.md`

## Context

The Rox Design embedded runtime (Open Design 0.7.0, ~251 MB gitignored payload) is loaded from `apps/electron/resources/rox-design/` at build/packaging time. This payload must be reproducible and independently verifiable across CI lanes (Linux, Windows, macOS).

**Problem:**

- Open Design ships only as a macOS `.app`; payload preparation requires a mac host.
- Without a reproducibility layer, Linux/Windows release lanes either skip Rox Design or use a pre-staged payload, which is fragile and non-auditable.
- A poisoned or tampered payload could reach production undetected if no verification gate existed downstream of download.
- Release-readiness audit (2026-05-20, PZD-51) flagged this as a **P0 blocker** until a reproducible supply chain was documented.

**Key insight:**

A 4-layer defence-in-depth model allows Linux/Windows CI lanes to download a canonical, SHA-256-pinned archive produced on a mac runner, verify it locally, and proceed without needing mac hardware at prep time.

## Decision

Implement a 4-layer SHA-256-pinned supply chain for the Rox Design runtime payload:

### Layer 1: Producer

`scripts/build-rox-design-payload-archive.ts` + `.github/workflows/build-rox-design-payload-archive.yml` (self-hosted mac runner)

- Extracts `Open Design.app/Contents/Resources` → `rox-design/` on a macOS host.
- Compresses to `.tar.gz`, computes SHA-256, and stores the archive in a release artifact (GitHub Artifacts or S3).
- Updates `runtime-payload-versions.json` with the new archive entry:
  ```json
  {
    "0.7.0": {
      "archiveSha256": "abc123...",
      "buildDate": "2026-05-20T...",
      "url": "https://..."
    },
    "current": "0.7.0"
  }
  ```
- Triggered manually when a new Open Design upstream version is available.

### Layer 2: Consumer

`scripts/prepare-rox-design-runtime.ts --from-archive --expected-sha256 <hash>`

- Downloads the archive from the artifact store.
- Verifies SHA-256 before extraction (blocks on mismatch).
- Extracts to `apps/electron/resources/rox-design/`.
- On successful extract, embeds the observed SHA-256 in `MANIFEST.json` for Layer 3 validation.
- Called by release workflows and local `bun run rox-design:prepare --from-archive`.
- If `--from-archive` is not set and no archive is available, falls back to Layer 0 (host-local prepare mode).

### Layer 3: Gate

`scripts/check-rox-design-runtime-payload.ts`

- Validates `MANIFEST.json` schema and presence of `REQUIRED_PATHS`.
- Cross-checks `MANIFEST.archiveSha256` against `runtime-payload-versions.json[.current]` (optional, verbose mode).
- Called by:
  - Electron builder `beforeBuild` hook (`apps/electron/scripts/beforeBuild.cjs`).
  - Explicit pre-flight check in release workflows (defence-in-depth).
- Fails the build if payload is missing, corrupted, or version-mismatched.

### Layer 4: Defence-in-Depth

Explicit workflow steps + `beforeBuild` hook

- Release workflows include a dedicated payload-check step before Electron builder invocation.
- `beforeBuild` hook ensures the gate fires **regardless of entry point** (local dev, CI, manual runs).
- Poisoned payloads are caught at minimum 2 layers; incentivizes breadth over a single point of failure.

## Consequences

**Positive:**

- **Reproducibility:** bit-identical packaged artifacts across all CI runs, regardless of runner OS.
- **Linux/Windows independence:** release lanes no longer require mac hardware at payload prep time; they download and verify a canonical archive.
- **Defence-in-depth:** a poisoned payload is caught at 4 independent layers (download SHA, gate, beforeBuild, workflow step).
- **Graceful soft-rollout:** Layer 0 (host-local prepare mode) remains active as a fallback until `runtime-payload-versions.json[.current]` is set; no hard cutover.
- **Auditability:** SHA-256 hashes pinned in code and artifacts; each release can prove which exact Open Design version was used.

**Negative:**

- **Chicken-and-egg bootstrap:** the first canonical archive must be produced manually on a mac runner before Layer 2 activates. Mitigated by Layer 0 fallback during bootstrap window.
- **Signing complexity:** Mach-O nested signing (B-SIGN-3) is orthogonal; macOS notarization and code-signing procedures remain complex. Tracked separately in ADR-TBD and `docs/release/mac-signing.md`.
- **Archive storage:** artifacts or S3 backend must be configured before workflows are live. Requires upfront infra setup.
- **Manifest brittleness:** `MANIFEST.json` schema and `REQUIRED_PATHS` list must stay synchronized with Open Design upstream. A version bump with new resources can break Layer 3 until `REQUIRED_PATHS` is updated.

**Mitigations:**

- Layer 0 (host-local prepare mode) is kept as a fallback for local development and bootstrap.
- Archive storage is documented in `docs/release/rox-design-payload-supply-chain.md`.
- `REQUIRED_PATHS` is auto-discovered or generated during Producer stage; see Layer 1 workflow comments for details.

## Implementation PRs

All on `agisota/rox.one`:

- **#297:** `beforeBuild` hook gate (`apps/electron/scripts/beforeBuild.cjs`).
- **#300:** Explicit workflow gate step (defence-in-depth post-extract).
- **#306:** Consumer `scripts/prepare-rox-design-runtime.ts` with `--from-archive` and SHA-256 pinning.
- **#310:** Producer `scripts/build-rox-design-payload-archive.ts` + workflow template + `runtime-payload-versions.json` placeholder.
- **#313:** Wire 5 release workflows (`macos`, `windows`, `linux`, `docker`, `web`) to consume canonical archive via Layer 2.
- **#315:** Cross-check Layer 3 (`MANIFEST.archiveSha256` vs. `versions.json[.current]`).

## Related Documents

- `docs/release/rox-design-payload-supply-chain.md` — operational guide for producers and consumers.
- `docs/release/mac-signing.md` — orthogonal signing and notarization procedures.
- `docs/worklog/T091-rox-design-managed-view-bridge.md` — development worklog and decision history.
- `docs/audits/2026-05-20-pr268-release-readiness-audit.md` — release-readiness findings that triggered this ADR.

## Companion ADRs

- **ADR-T537a:** Vendor Open Design as in-process module rather than embed as external webview.
- **ADR-T537b:** Theme the embedded Design surface via CSS custom properties, not a UI fork.

## Tickets

- **PZD-51 (B-REPRO-2, P0):** Reproducible payload supply chain.
- **PZD-48 (B-CI-1):** Linux/Windows release lane independence.
- **PZD-49 (B-SIGN-3):** Mach-O signing (orthogonal, separate ADR planned).
