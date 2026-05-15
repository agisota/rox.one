# T500 — Linux GPG keys + secrets setup

Status: DONE
Phase: M.18
Owner: agent-A1 (RC2 swarm)
Spec: docs/superpowers/specs/2026-05-15-v1.0.0-rc.2-design.md

## Summary
Generated a 4096-bit RSA signing GPG key and configured three GitHub
secrets (ROX_LINUX_GPG_KEY, ROX_LINUX_GPG_KEY_ID, ROX_LINUX_GPG_PASSPHRASE)
so linux-signed-release.yml passes its "Verify signing secrets present"
gate.

## Notes
- Key ID: 249B47CB486E6AE9
- Key expires: 2028-05-14 (2y from gen on 2026-05-15)
- Passphrase material must remain in the operator vault and GitHub Actions
  secret store only; no fixed local passphrase path is an approved artifact.
- When v1.0.x ships with rotated passphrase, follow the same procedure;
  update KEY_ID for re-issued key.
