# T500 — Linux GPG keys + secrets setup (worklog)

## What was done
Generated a 4096-bit RSA signing GPG key with a strong randomly-generated
passphrase (saved to /tmp/rox-gpg-passphrase.txt on the orchestrator host,
chmod 600). Exported the armored private key, base64-encoded it, and configured
three GitHub secrets via `gh secret set`:

- `ROX_LINUX_GPG_KEY` (base64 of armored private key)
- `ROX_LINUX_GPG_KEY_ID` (long format)
- `ROX_LINUX_GPG_PASSPHRASE` (matching passphrase)

Key ID: `249B47CB486E6AE9` (rsa4096, expires 2028-05-14).

## Why
`linux-signed-release.yml` was failing at the "Verify signing secrets present"
step with "missing required secret: ROX_LINUX_GPG_KEY/_KEY_ID/_PASSPHRASE".
Without these three secrets configured, the Linux signed-release pipeline
could not progress past secrets verification, and v1.0.0-rc.2 could not
ship Linux GPG-signed `.deb`/`.rpm`/`.AppImage` artifacts.

## Verification
- `gh secret list` shows all three `ROX_LINUX_GPG_*` entries (set 2026-05-15)
- `gpg --list-keys 249B47CB486E6AE9` confirms RSA-4096 / SC usage / 2028 expiry
- Pre-push hook (`validate-rebrand.cjs`) passed cleanly

## Follow-ups
- Operator must move `/tmp/rox-gpg-passphrase.txt` to a vault before /tmp is
  wiped (host reboot, container restart, etc.).
- Schedule passphrase rotation for v1.0.x with vault-managed value.
