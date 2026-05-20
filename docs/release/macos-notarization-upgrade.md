# macOS Notarization Upgrade Path

**Status:** Not yet activated. Reference document for when ROX.ONE transitions
from ad-hoc signing to a real Apple Developer ID + notarization.

**Decision gate:** See [§8 Decision matrix](#8-decision-matrix) before starting.

---

## TL;DR

ROX.ONE currently ships ad-hoc-signed macOS DMGs. Users on macOS Sequoia see a
«cannot be verified» Gatekeeper dialog on first launch. When the team crosses the
activation threshold (>1 000 active macOS users or paid product), follow this
document to provision an Apple Developer ID, update two config files, and enable
`mac-signed-release.yml` — the workflow already exists and is fully wired.

---

## 1. Why notarization

### Gatekeeper first-launch UX

Every macOS app opened from the internet passes through Gatekeeper. For an
ad-hoc-signed bundle Gatekeeper shows:

> **"ROX.ONE" cannot be opened because Apple cannot check it for malicious
> software.**

The user must open System Settings > Privacy & Security and click **Open Anyway**
— a two-step friction that converts badly on first install and generates support
tickets.

A Developer ID-signed and notarized DMG gets through Gatekeeper silently:
the user double-clicks, sees the standard «ROX.ONE is downloaded from the
internet. Are you sure?» sheet, clicks **Open**, and the app launches. No
System Settings trip required.

### Sequoia (macOS 15) tightening

Apple tightened notarization enforcement in macOS Sonoma 14.5 and continued in
Sequoia (15). Binaries that would previously land in the «Open Anyway» fallback
path now show a hard block in some contexts, particularly on first launch after
quarantine removal. The trend is toward making the ad-hoc path permanently
unavailable in a future release.

### Notary Service v1 is deprecated

Apple deprecated Notary Service v1 (`altool --notarize-file`) in 2023. The
replacement is `notarytool`, shipped with Xcode 13+. The workflow in
`mac-signed-release.yml` already calls `xcrun notarytool submit`. Do not
introduce or revive any `altool`-based path.

---

## 2. What we buy

| Item | Cost | Where |
|---|---|---|
| Apple Developer Program membership | $99/year | [developer.apple.com/enroll](https://developer.apple.com/enroll) |
| Developer ID Application certificate | Included | Certificates, Identifiers & Profiles in Apple Developer portal |
| Developer ID Installer certificate | Included (only needed for `.pkg`) | Same portal — skip for now (we ship DMG, not pkg) |
| Apple ID for `notarytool` | Free | Any Apple ID; recommend a team-shared one |
| App-specific password | Free | appleid.apple.com > Sign-In & Security > App-Specific Passwords |

The Developer ID Application certificate signs the `.app` bundle. The Apple ID
and app-specific password are credentials `notarytool` uses to submit the DMG to
Apple's notarization service. Neither the full Apple ID password nor a personal
account is used in CI.

---

## 3. What we change

### `apps/electron/electron-builder.yml`

The `mac` section currently carries:

```yaml
mac:
  identity: "-"
  # notarize:
  #   teamId: ${APPLE_TEAM_ID}
```

Change to:

```yaml
mac:
  # identity is not set here — electron-builder picks up the Developer ID
  # Application certificate automatically from CSC_LINK / keychain when
  # CSC_IDENTITY_AUTO_DISCOVERY is not false.
  notarize:
    teamId: "${APPLE_TEAM_ID}"
```

Key points:

- Remove `identity: "-"`. The ad-hoc identity (`-`) overrides any certificate
  and produces an ad-hoc signature even when `CSC_LINK` is present. Removing the
  key allows electron-builder to use the imported Developer ID Application cert.
- Uncomment and fill `notarize.teamId`. This field is the 10-character Apple
  Developer team identifier (visible in the Apple Developer portal under
  Membership). The `APPLE_TEAM_ID` env var is already wired in
  `mac-signed-release.yml`.
- The `entitlements` and `hardenedRuntime: true` lines stay unchanged. The
  existing `build/entitlements.mac.plist` is valid for both ad-hoc and Developer
  ID signing. Notarization requires the hardened runtime — `hardenedRuntime: true`
  satisfies that requirement.

### `build/entitlements.mac.plist`

No change required. The five entitlements already present (`allow-jit`,
`allow-unsigned-executable-memory`, `disable-library-validation`,
`allow-dyld-environment-variables`, `network.client`) are accepted by the
notarization service. The `disable-library-validation` entitlement is
notarization-eligible but Apple may request justification during App Review if
you ever pursue Mac App Store distribution; for Developer ID distribution it is
unrestricted.

### `.github/workflows/multi-platform-on-merge.yml`

The on-merge nightly workflow builds unsigned (ad-hoc) macOS artifacts for
smoke testing. It explicitly sets `CSC_IDENTITY_AUTO_DISCOVERY: "false"` at the
job level and passes no Apple credentials — this is intentional. Do not wire
notarization into the nightly workflow.

When notarization is active, only `mac-signed-release.yml` (manual dispatch)
produces notarized artifacts. The nightly remains ad-hoc for speed.

If you want to gate the nightly mac step on the presence of Apple secrets
(matching the Windows self-signed pattern), add this prep step to the
`mac-arm64` matrix path only:

```yaml
- name: Prepare Apple signing identity (mac-arm64, gated)
  if: matrix.platform == 'mac-arm64' && env.MAC_CSC_LINK != ''
  shell: bash
  env:
    MAC_CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
    MAC_CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    set -euo pipefail
    TMPDIR_PFX=$(mktemp -d)
    P12_PATH="${TMPDIR_PFX}/rox-one-mac.p12"
    printf '%s' "${MAC_CSC_LINK}" | base64 -d > "${P12_PATH}"
    echo "CSC_LINK=${P12_PATH}" >> "$GITHUB_ENV"
    echo "CSC_KEY_PASSWORD=${MAC_CSC_KEY_PASSWORD}" >> "$GITHUB_ENV"
    echo "CSC_IDENTITY_AUTO_DISCOVERY=true" >> "$GITHUB_ENV"
    echo "APPLE_ID=${APPLE_ID}" >> "$GITHUB_ENV"
    echo "APPLE_APP_SPECIFIC_PASSWORD=${APPLE_APP_SPECIFIC_PASSWORD}" >> "$GITHUB_ENV"
    echo "APPLE_TEAM_ID=${APPLE_TEAM_ID}" >> "$GITHUB_ENV"
```

Do not add this to the nightly until the team explicitly decides to notarize
nightly builds. Notarization adds 5–15 minutes per run and consumes Apple API
quota.

---

## 4. Existing `mac-signed-release.yml`

The signed-release workflow at `.github/workflows/mac-signed-release.yml` is
already fully wired. It is triggered only via `workflow_dispatch` (never
automatically) and requires five secrets to be present before any signing step
runs.

### Secret contract

| GitHub Secret | Purpose |
|---|---|
| `CSC_LINK` | Base64-encoded Developer ID Application `.p12` / `.pfx` |
| `CSC_KEY_PASSWORD` | Password for the p12 |
| `APPLE_ID` | Apple ID email used for `notarytool` |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for `notarytool` |
| `APPLE_TEAM_ID` | 10-character Apple Developer team identifier |

### What the workflow does

1. Validates the dispatch input tag against `v[0-9]+.[0-9]+.[0-9]+(-rc.[0-9]+)?`.
2. Pre-flight: fails immediately if any of the five secrets is absent — prevents
   a misconfigured run from silently producing an ad-hoc artifact.
3. Runs `validate:mac-boundary-fixtures` and `validate:mac-private-release-boundary`
   before invoking electron-builder.
4. Packages with `bunx electron-builder --mac --arm64 --publish=never`, wiring all
   five secrets as env vars so electron-builder and `@electron/notarize` pick them up.
5. Verifies the codesign identifier (`com.rox.one`), team identifier, and confirms
   the bundle is not ad-hoc signed.
6. Calls `xcrun notarytool submit ... --wait --timeout 30m` then
   `xcrun stapler staple` and `xcrun stapler validate`.
7. Uploads the notarized DMG as a workflow artifact (`rox-one-signed-mac-arm64`,
   14-day retention) alongside SHA-256 checksums.

The workflow currently builds arm64 only. Add `--x64` to the electron-builder
invocation to produce a notarized x64 DMG in the same run.

---

## 5. Cost and effort

| Item | Time | Cost |
|---|---|---|
| Enroll in Apple Developer Program | 1–2 business days (identity verification) | $99/year |
| Generate Developer ID Application cert in Xcode or portal | ~10 min | — |
| Export cert as `.p12`, base64-encode, add GitHub Secrets | ~15 min | — |
| Create app-specific password on appleid.apple.com | ~5 min | — |
| Enable `notarize` in `electron-builder.yml` and open this PR | ~5 min | — |
| First notarization run (verify end-to-end) | ~30 min CI time | — |
| **Total one-time setup** | **~30 min human time** | **$99/year** |

Recurring cost per release: notarization adds roughly 5–15 minutes to each
`mac-signed-release.yml` run (Apple's service SLA). No additional dollar cost
per submission.

### Cert export procedure (one time)

```bash
# On a mac with Xcode installed and the cert in the keychain:
security find-identity -v -p codesigning | grep "Developer ID Application"
# Note the SHA-1 hash of the cert, e.g. AABBCCDD1122...

security export \
  -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -P "your-p12-password" \
  -o rox-one-devid.p12 \
  AABBCCDD1122...

base64 -i rox-one-devid.p12 | pbcopy
# Paste into GitHub Secret: CSC_LINK
```

---

## 6. Verification

After a successful `mac-signed-release.yml` run, download the DMG artifact and
run these two checks locally on a mac:

```bash
# 1. Verify the stapled notarization ticket
xcrun stapler validate ROX-ONE-arm64.dmg
# Expected: ROX-ONE-arm64.dmg: The validate action worked!

# 2. Verify Gatekeeper acceptance
spctl -a -vvv -t install ROX-ONE-arm64.dmg
# Expected output includes:
#   ROX-ONE-arm64.dmg: accepted
#   source=Notarized Developer ID
```

If `spctl` returns `rejected` or `source=ad-hoc`, the signing or notarization
step failed. Check the notarytool log uploaded as a workflow artifact at
`.ci-logs/mac-signed-release/notarytool.log`.

### Additional codesign deep check

```bash
# Mount the DMG, then check the app bundle:
hdiutil attach ROX-ONE-arm64.dmg -mountpoint /tmp/rox-dmg
codesign -dv --verbose=4 /tmp/rox-dmg/ROX.ONE.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
# Authority must include "Developer ID Application: ..."
# Signature must NOT contain "adhoc"
hdiutil detach /tmp/rox-dmg
```

---

## 7. Rollback

If notarization fails mid-release and you need to ship an ad-hoc build, toggle
the identity back without modifying shared code:

1. In `apps/electron/electron-builder.yml`, restore `identity: "-"` and comment
   out `notarize`.
2. Commit as `chore: temp revert to ad-hoc mac signing (notarization degraded)`.
3. Trigger the nightly workflow (`workflow_dispatch`) — it already builds with
   `CSC_IDENTITY_AUTO_DISCOVERY: "false"` and produces a valid ad-hoc DMG.
4. Distribute via the same GitHub release mechanism. Add a note to the release
   body: *«macOS: Gatekeeper will require Open Anyway on first launch; this is
   temporary while we resolve notarization.»*

The rollback is invisible to Windows and Linux users. Mac users see the same
friction they experienced pre-notarization. No downtime.

A cleaner alternative to modifying `electron-builder.yml` is to gate signing in
the workflow on secret presence (the same pattern as the Windows self-signed
cert). Add `if: env.CSC_LINK != ''` to the signing step so a run without the
secret automatically falls back to an unsigned (or ad-hoc) build. This avoids
any code change for rollback.

---

## 8. Decision matrix

Notarization is not currently active. Use this matrix to evaluate when the
investment is worth it.

| Signal | Weight | Current value | Threshold |
|---|---|---|---|
| Active macOS users | High | <1 000 (estimated) | >1 000 |
| Paid product or paid tier | High | No | Yes |
| SmartScreen-equivalent support tickets about mac install | Medium | <5/week | >20/week |
| Time-to-first-launch matters for onboarding funnel | Medium | Not measured | Measurable drop in activation |
| Team has a shared Apple Developer ID account | Required | No | Yes |

**Current verdict: no-go.**

All four conditions — >1 000 active macOS users, paid product, support ticket
volume, and a provisioned Apple Developer account — must be met before activation.
The $99/year membership is negligible at that stage; the setup time (~30 min) is
the only friction.

Revisit this matrix at each quarterly planning cycle or when a milestone signals
readiness (e.g., first paid customer, public launch, App Store consideration).

---

## 9. Operational checklist (PZD-33-style)

Run this checklist in order when the decision matrix clears and notarization is
approved.

```
[ ] 1. PROVISION — Enroll in Apple Developer Program at developer.apple.com/enroll.
        Use the company Apple ID (not personal). Allow 1-2 days for identity check.

[ ] 2. PROVISION — In Certificates, Identifiers & Profiles, create a new
        "Developer ID Application" certificate. Download and double-click to install
        into the mac keychain.

[ ] 3. PROVISION — Export the cert as a .p12 (see §5 cert export procedure).
        Note the export password.

[ ] 4. PROVISION — On appleid.apple.com, generate an app-specific password for
        "ROX.ONE CI". Note the generated password.

[ ] 5. GH SECRETS — In GitHub repo Settings > Secrets and variables > Actions,
        add or update the following repository secrets:
          CSC_LINK                    = base64-encoded .p12 content
          CSC_KEY_PASSWORD            = .p12 export password
          APPLE_ID                    = Apple ID email for notarytool
          APPLE_APP_SPECIFIC_PASSWORD = app-specific password from step 4
          APPLE_TEAM_ID               = 10-character team ID from the portal

[ ] 6. CODE — In apps/electron/electron-builder.yml, remove `identity: "-"` and
        uncomment the `notarize:` block. The APPLE_TEAM_ID value in the yml uses
        the env var — leave the placeholder as-is.

[ ] 7. CI — Trigger mac-signed-release.yml via workflow_dispatch with a valid
        release tag (e.g. v1.1.0-rc.1). Monitor the "Verify signing secrets present"
        step first; it fails fast if any secret is missing.

[ ] 8. VERIFY — Download the DMG artifact from the workflow run.
        Run `xcrun stapler validate ROX-ONE-arm64.dmg` — expect "worked!".
        Run `spctl -a -vvv -t install ROX-ONE-arm64.dmg` — expect "accepted".

[ ] 9. VERIFY — On a mac without the Developer ID cert in keychain (or use a
        fresh VM), open the DMG. Confirm Gatekeeper shows the standard "downloaded
        from internet" sheet (not the "cannot be verified" block).

[ ] 10. DOCS — Update this document's Status field from "Not yet activated" to
         "Active since vX.Y.Z" and record the Apple Team ID (not secrets) here.

[ ] 11. COMMS — Post a one-liner in the release notes: "macOS: app now passes
         Gatekeeper automatically; Open Anyway prompt no longer required."
```

---

## References

- `apps/electron/electron-builder.yml` — `mac.identity` and `mac.notarize` fields
- `apps/electron/build/entitlements.mac.plist` — hardened runtime entitlements (M.18 T250)
- `.github/workflows/mac-signed-release.yml` — full signing + notarization workflow
- `.github/workflows/multi-platform-on-merge.yml` — nightly build (ad-hoc, no notarization)
- `docs/release/mac-trust-boundary-audit.md` — M.18 T250 entitlement risk register
- `docs/release/windows-self-signed-install.md` — parallel pattern for Windows SmartScreen
- Apple: [Notarizing macOS Software Before Distribution](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- Apple: [xcrun notarytool](https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool)
