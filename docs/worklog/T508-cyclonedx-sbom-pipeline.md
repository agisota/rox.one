# T508 — CycloneDX SBOM in release pipelines (worklog)

## What was done
Added two steps to .github/workflows/linux-signed-release.yml (after checksum, before artifact upload): "Generate CycloneDX SBOM" runs npx -y @cyclonedx/cdxgen@latest -t bun -o sbom-linux.json; "Upload SBOM artifact" uploads via actions/upload-artifact@v4 (if-no-files-found: error, retention 90d). Created scripts/validate-sbom.ts checking JSON parse, bomFormat="CycloneDX", specVersion>=1.5, >=100 components. Mac and Windows SBOM steps added via orchestrator rebase after A2/A3 workflows on main.

## Why
User CLAUDE.md: "SBOM required: generate CycloneDX SBOM for each release." No release workflow generated SBOM before. Per-platform SBOMs attached to GitHub Release give supply-chain attestation consumers machine-readable dependency views.

## Verification
- npx -y @cyclonedx/cdxgen@latest --version → 12.4.0
- bun run typecheck:all exit 0
- validate-sbom.ts exits 1 with usage when no args
