# macOS signing — Rox Design payload nested binaries

## Status

PR proposing the default fix for **B-SIGN-3** (Linear [PZD-49](https://linear.app/pzd/issue/PZD-49)). DRAFT pending macOS-host investigation: the recommendation here defaults to "re-sign with our Developer ID" (Option A). If upstream Open Design 0.7.0 ships the nested binary pre-signed by a trusted authority, a reviewer with macOS access should verify and may prefer Option B (preserve upstream signature via `signIgnore:`).

## Problem

The Rox Design runtime payload (prepared by `bun run rox-design:prepare`) places a nested Mach-O binary at:

```
apps/electron/resources/rox-design/open-design/bin/node
```

This is the Node runtime used by Open Design sidecars. When `electron-builder` signs the ROX.ONE bundle with our Developer ID and submits it to Apple's notarization service, the notarization step rejects bundles that contain nested Mach-O binaries that are NOT part of the signing tree.

Without this fix, `mac-signed-release.yml` would fail at the `Codesign verify signed bundle` step (or at notarization staple) when the Rox Design payload is populated.

## Option A — re-sign with our Developer ID (default in this PR)

`electron-builder.yml`:

```yaml
mac:
  binaries:
    - resources/rox-design/open-design/bin/node
```

What it does: electron-builder applies our `CSC_LINK` Developer ID to the nested binary during the signing pass. Notarization accepts because the entire bundle (including nested binaries) is signed by one identity.

When this is right:
- Upstream Open Design does not sign the bundled `node` binary; or
- Upstream signs it but with an identity we don't want to preserve.

## Option B — preserve upstream signature

`electron-builder.yml`:

```yaml
mac:
  signIgnore:
    - resources/rox-design/open-design/bin/node
```

What it does: electron-builder skips the nested binary during signing. Notarization accepts ONLY if the upstream binary is itself notarization-eligible (signed by a trusted Developer ID).

When this is right:
- Open Design upstream signs the binary with a recognized Developer ID and we want to preserve that provenance for supply-chain auditability.

## Investigation steps for the macOS-host reviewer

Run on a host with Open Design 0.7.0 installed:

```bash
# Verify nested binary signature state
codesign -dvv /Applications/Open\ Design.app/Contents/Resources/open-design/bin/node

# Check notarization eligibility
spctl --assess --type execute --verbose=4 /Applications/Open\ Design.app/Contents/Resources/open-design/bin/node

# Inspect entitlements
codesign -d --entitlements - /Applications/Open\ Design.app/Contents/Resources/open-design/bin/node
```

Decision matrix:

| Upstream state | Recommended option |
|---|---|
| Unsigned | Option A (re-sign) |
| Ad-hoc signed | Option A (re-sign) |
| Signed by recognized Developer ID, notarization-eligible | Either option works; Option B preserves provenance |
| Signed by Developer ID with restrictive entitlements that conflict with our hardened runtime | Option A (re-sign) — strip the upstream entitlements |

## Validation after the fix lands

```bash
# Trigger mac-signed-release.yml on a branch with a populated payload
gh workflow run mac-signed-release.yml --ref <branch>

# After the run completes, verify the signed bundle
codesign --verify --deep --strict apps/electron/release/mac-arm64/ROX.ONE.app
xcrun stapler validate apps/electron/release/ROX-ONE-arm64.dmg

# Confirm the nested binary signature
codesign -dvv apps/electron/release/mac-arm64/ROX.ONE.app/Contents/Resources/app/resources/rox-design/open-design/bin/node
```

Expected: bundle and nested binary both report the same Developer ID identity (Option A) OR bundle reports our identity and nested binary reports upstream identity (Option B).

## Out-of-scope

- Additional nested Mach-O binaries inside Open Design that may need the same treatment (audit the full `app/node_modules` tree on a real payload; current best-effort lists only `open-design/bin/node` from the payload `REQUIRED_PATHS`).
- Supply-chain signing strategy beyond Rox Design (handled separately by R12/R13 milestone).

## Related

- Linear: [PZD-49](https://linear.app/pzd/issue/PZD-49)
- Audit: `docs/audits/2026-05-20-pr268-release-readiness-audit.md` (B-SIGN-3)
- Sibling fixes: [PZD-48](https://linear.app/pzd/issue/PZD-48) (B-CI-1 — gate hoisting; PR #297 + PR #300), [PZD-51](https://linear.app/pzd/issue/PZD-51) (B-REPRO-2 — payload archive supply chain).
