# Decision 0111: Supply Chain Hardening

- Status: accepted
- Date: 2026-05-14

## Canonical
```text
supply-chain posture consists of three controls:

1. exact version pinning (PR #117)
   security-critical deps use exact versions, not ranges
   packages pinned: electron-updater, electron-log, undici, ws, zod
   lockfile is the authoritative install record
   updates require an explicit lockfile bump

2. SBOM + secret scan (PR #116)
   CycloneDX JSON SBOM generated after each electron:build
   SBOM uploaded as 90-day retained CI artifact
   gitleaks scans all commits on push and pull_request
   gitleaks failure is hard fail (exit 1), not advisory
   pre-push hook runs gitleaks when binary is present
   husky guard: command -v gitleaks prevents blocking devs without it

3. signed macOS build workflow (PR #112)
   mac-signed-release.yml is workflow_dispatch only
   requires five Apple secrets pre-flight checked before any build
   bundle identity validated against com.rox.one pattern
   codesign -dv verifies signature is not adhoc
   notarytool submits and waits; stapler staples before artifact upload
   workflow-injection risk mitigated by regex-validating the tag input

zod major-version split resolved:
  session-mcp-server and session-tools-core promoted from ^3.23.0 to 4.4.3
  all usage confirmed compatible with v4 API surface
  workspace root and both packages now share a single major version
```

## Why
- Exact version pinning prevents silent range resolutions from introducing unreviewed transitive changes to security-critical packages (satisfying the CLAUDE.md rule against `^` for security-critical deps).
- CycloneDX SBOM generation per release provides a machine-readable dependency inventory for compliance and vulnerability scanning; 90-day retention exceeds the release artifact window so SBOMs remain available for post-release audits.
- Gitleaks hard-fail on push/PR ensures secrets cannot land on `main` even if a developer bypasses the pre-push hook; the optional local gate reduces friction for developers who have not installed the binary.
- The signed-build workflow is `workflow_dispatch`-only (not triggered on push) to keep signing secrets out of the hot path; secrets are pre-flight checked so an unsigned bundle cannot escape as a release artifact.
- Resolving the Zod major-version split eliminates a subtle dependency fork that could surface incompatible schema behaviour between packages sharing a workspace.
