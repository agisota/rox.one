# T501 — Mac unsigned-release workflow

Status: DONE
Phase: M.18
Owner: agent-A2 (RC2 swarm)
Spec: docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md

## Summary
New unsigned-beta Mac release workflow mirroring mac-signed-release.yml
but with all Apple signing/notarization steps removed. Produces
ROX-ONE-arm64.dmg (and friends) for v1.0.0-rc.2 distribution.

## v1.0.x migration
When Apple Developer cert is procured, configure 5 secrets per
mac-signed-release.yml and dispatch that workflow instead. This
unsigned variant can then be deprecated.
