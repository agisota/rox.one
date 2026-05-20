# Windows installer: SmartScreen warning on first launch

ROX.ONE Windows installers are signed with a self-signed code-signing
certificate. The signature is **cryptographically valid** — it proves the
installer came from us and has not been tampered with — but it is **not
trusted by the Windows certificate store** because we are not yet using a
commercial Authenticode certificate from a public certificate authority.

This means: on the **first** launch of a fresh install, Windows shows the
SmartScreen «Windows protected your PC» warning.

## What to do

1. When SmartScreen pops up, click **More info**.
2. Click **Run anyway**.

After that, ROX.ONE launches normally, and subsequent launches and updates
do not show the warning.

## Why we use self-signed

A commercial Organization Validated (OV) Authenticode certificate costs
$150-300/year and is the right answer once ROX.ONE has paying customers
for whom the SmartScreen friction is a real blocker. Until then, paying
for a cert that still triggers SmartScreen for the first ~10 000 downloads
(before Microsoft seeds reputation) doesn't move the needle.

We re-evaluate this trade-off quarterly. If you'd rather not deal with the
warning, you can build from source — see the main README.

## Why it's safe

- Every release is built in GitHub Actions from a public commit SHA you can
  verify.
- Every release has a CycloneDX SBOM (software bill of materials) attached
  to the GitHub release.
- The installer signature ties the binary to the build, so any in-flight
  tampering would invalidate it.
- The MS Defender SmartScreen warning is a UX layer, not a verdict — it
  flags «unknown publisher», not «known malicious».

## Antivirus false positives

Some antivirus engines (especially aggressive heuristic-based ones)
occasionally flag self-signed Electron apps. If yours does:

1. Submit the binary to your AV vendor as a false positive.
2. Whitelist the install directory (`%LOCALAPPDATA%\Programs\ROX.ONE\`).
3. Optionally fall back to the AppImage build under Linux/WSL while the
   AV vendor processes the report.

## Future: upgrading to OV

When we move to a commercial OV cert, the upgrade is invisible to existing
users: the same `electron-updater` feed serves the new (now-CA-trusted)
signed builds, SmartScreen accepts them silently, and no reinstall is
needed. Updates flow through normally.
