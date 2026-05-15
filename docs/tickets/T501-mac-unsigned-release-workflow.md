# T501 — Mac unsigned-release workflow

Status: DONE
Phase: M.18
Owner: agent-A2 (RC2 swarm)
Spec: docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md

## Summary
New unsigned-beta Mac release workflow mirroring mac-signed-release.yml
but with Apple Developer signing/notarization steps removed. The dispatch
input is regex-validated before checkout, then the workflow builds the
validated release tag and produces the private ad-hoc hardened-runtime
ROX-ONE-arm64.dmg for v1.0.0-rc.2 distribution.

## Review-blocker repairs
- Checkout now uses `refs/tags/${{ steps.release-tag.outputs.release_tag }}`
  after the tag-pattern guard succeeds.
- Fixture boundary validation stays before the Electron build, while the live
  private mac release boundary validation runs after electron-builder has
  produced the packaged app.
- Private ad-hoc hardened-runtime packaging sets
  `CSC_IDENTITY_AUTO_DISCOVERY=false` and `ROX_DEV_RUNTIME=1`.
- The release artifact upload is narrowed to the DMG plus checksum manifest so
  the manifest covers the uploaded release binary.
- Required worklog added at
  `docs/worklog/T501-mac-unsigned-release-workflow.md`.

## v1.0.x migration
When Apple Developer cert is procured, configure 5 secrets per
mac-signed-release.yml and dispatch that workflow instead. This
unsigned variant can then be deprecated.
