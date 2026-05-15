# T502 — Windows unsigned-release workflow

Status: DONE
Phase: M.18
Owner: agent-A3 (RC2 swarm)
Spec: docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md

## Summary

New unsigned-beta Windows release workflow. Produces
ROX-ONE-Setup-*.exe + latest.yml for v1.0.0-rc.2 distribution.
No code-signing — Windows SmartScreen will warn on first install.

## v1.0.x migration

When Windows code-signing certificate is procured ($200-500/year from
DigiCert/Sectigo), add CSC_LINK and CSC_KEY_PASSWORD secrets and
enable signing in electron-builder.yml win.certificateFile config.
