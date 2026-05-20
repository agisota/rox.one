# rox.one site download handoff

Owner: ROX.ONE release engineering
Audience: rox.one website team (Cloudflare Pages project `rox-one`)
Status: living document — updated each time the R2 mirror or Worker
contract changes.

## Why this exists

The ROX.ONE Electron app is built four times per push to `main`
(one per platform: mac-arm64, linux-x64, windows-x64, windows-x64-2025)
via `.github/workflows/multi-platform-on-merge.yml`. Each build is
published to a GitHub pre-release tagged `nightly-<short-sha>` AND
mirrored to Cloudflare R2 so the rox.one website can serve binaries
publicly without exposing the private GitHub repository.

This document is the contract between the release pipeline and the
download surface on rox.one.

## Download URL pattern

```
https://app.rox.one/electron/{channel}/{filename}
```

| Channel    | Source tag           | Worker behaviour                              |
|------------|----------------------|-----------------------------------------------|
| `latest`   | latest stable `v*`   | redirects to GH release asset, R2 fallback    |
| `beta`     | latest `v*-beta.*`   | redirects to GH release asset, R2 fallback    |
| `nightly`  | latest `nightly-*`   | redirects to GH release asset, R2 fallback    |
| `<tag>`    | exact tag pin        | pinned URL — never moves once minted          |

Examples (rendered on the site):

```
# Latest stable Mac ARM64 DMG
https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg

# Pinned beta build
https://app.rox.one/electron/v1.0.1-beta.3/ROX-ONE-arm64.dmg

# Newest nightly Linux AppImage
https://app.rox.one/electron/nightly/ROX-ONE-x86_64.AppImage
```

The Worker (`infra/cloudflare/rox-one-release-feed.worker.ts`) handles
the routing logic. The site does NOT need to know about R2 directly.

## R2 origin layout

When R2 mirroring is active, objects live under the prefix:

```
s3://${R2_BUCKET_NAME}/electron/<channel>/<filename>
s3://${R2_BUCKET_NAME}/electron/<channel>/<tag>/<filename>
```

Public base URL: `https://<R2_PUBLIC_BASE_URL>/electron/...` (custom
domain bound via Cloudflare; do NOT serve `pub-<hash>.r2.dev` directly
in production).

Worker flip strategy:

1. **Phase 5a (current).** Worker serves from GitHub releases. R2 is a
   parallel write — the site links remain GH-backed.
2. **Phase 5b (post-stabilisation).** Worker flips to R2-first, falls
   back to GitHub on 404. This change is internal to the Worker; the
   public URL pattern above does NOT change.

The site should treat `https://app.rox.one/electron/...` as the only
contract. Origin URLs (R2 or GH) may change without notice.

## Per-platform install instructions

The site's Downloads page should expose four buttons. Suggested copy
and asset filenames below.

### macOS (Apple Silicon)

- Button label: "Download for Mac (Apple Silicon)"
- File: `ROX-ONE-arm64.dmg` (~120 MB)
- URL: `https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg`
- Requires: macOS 12.0 (Monterey) or newer (Monterey, Ventura, Sonoma, Sequoia, Tahoe).
- First-launch warning: see `docs/release/macos-first-launch.md`
  (to be created). The app is ad-hoc signed; on first open users
  must right-click -> Open -> Open again to bypass Gatekeeper.

### Linux x64

- Button label: "Download for Linux"
- Files (in order of preference):
  - `ROX-ONE-x86_64.AppImage` — universal, no install
  - `ROX-ONE.deb` — Debian / Ubuntu
  - `ROX-ONE.rpm` — Fedora / RHEL
- URL: `https://app.rox.one/electron/latest/ROX-ONE-x86_64.AppImage`
- Requires: glibc 2.31+, X11 or Wayland.
- For NixOS users, link to `https://github.com/agisota/rox.one#nixos`.

### Windows x64

- Button label: "Download for Windows"
- File: `ROX-ONE-x64.exe` (NSIS installer)
- URL: `https://app.rox.one/electron/latest/ROX-ONE-x64.exe`
- Requires: Windows 10 1809+ / Windows 11.
- SmartScreen warning expected on first install (the installer is
  self-signed). Link to `docs/release/windows-self-signed-install.md`
  with the "More info -> Run anyway" walkthrough.

### Nightly download (optional)

For testers, the site MAY expose a separate "Nightly builds" section
linking to `https://app.rox.one/electron/nightly/manifest.json` and
letting users pick a build from the displayed list. Nightlies are
auto-deleted after 7 days.

## manifest.json schema

Each release publishes a `manifest.json` describing the assets the
site can consume programmatically.

Live URLs:

- `https://app.rox.one/electron/latest/manifest.json` (stable channel)
- `https://app.rox.one/electron/beta/manifest.json` (beta channel)
- `https://app.rox.one/electron/nightly/manifest.json` (newest nightly)
- `https://app.rox.one/electron/<tag>/manifest.json` (pinned)

Shape:

```json
{
  "version": "1.0.1-beta.3",
  "channel": "beta",
  "commit": "<40-char-sha>",
  "build_time": "2026-05-20T03:00:00Z",
  "build_timestamp": 1773720000000,
  "binaries": {
    "darwin-arm64": {
      "url": "https://app.rox.one/electron/beta/ROX-ONE-arm64.dmg",
      "sha256": "<64-hex>",
      "size": 123456789,
      "filename": "ROX-ONE-arm64.dmg"
    },
    "linux-x64": {
      "url": "https://app.rox.one/electron/beta/ROX-ONE-x86_64.AppImage",
      "sha256": "<64-hex>",
      "size": 234567890,
      "filename": "ROX-ONE-x86_64.AppImage"
    },
    "win32-x64": {
      "url": "https://app.rox.one/electron/beta/ROX-ONE-x64.exe",
      "sha256": "<64-hex>",
      "size": 145678901,
      "filename": "ROX-ONE-x64.exe"
    }
  }
}
```

Keys the site is expected to read:

| Key                          | Purpose                                  |
|------------------------------|------------------------------------------|
| `version`                    | Display string (drops the `v` prefix)    |
| `channel`                    | `stable` / `beta` / `nightly`            |
| `build_time`                 | ISO 8601 UTC for "Last updated"          |
| `binaries.<platform>.url`    | Direct download link for that platform   |
| `binaries.<platform>.sha256` | Optional: render below the download button as "verify checksum" |
| `binaries.<platform>.size`   | Optional: render as "Download size"      |
| `binaries.<platform>.filename` | Display name                           |

Platforms keys are stable: `darwin-arm64`, `linux-x64`, `win32-x64`.
Future additions (e.g. `darwin-x64`) will be additive — never rename
existing keys.

## release-notes.json schema

Accompanies `manifest.json` at the same URL prefix:

```
https://app.rox.one/electron/<channel>/release-notes.json
```

Shape:

```json
{
  "version": "1.0.1-beta.3",
  "channel": "beta",
  "releasedAt": "2026-05-20T03:00:00Z",
  "releases": [
    {
      "version": "1.0.1-beta.3",
      "channel": "beta",
      "releasedAt": "2026-05-20T03:00:00Z",
      "title": "ROX.ONE v1.0.1-beta.3",
      "content": "<markdown release notes>"
    }
  ]
}
```

The site SHOULD render `content` as Markdown on the Downloads page
under a "What's new" collapsible. The schema is identical to the one
the Electron app's in-app updater consumes — keep them in sync.

## Cache headers (Worker-controlled)

The Cloudflare Worker sets the following headers; the site does not
need to manage caching itself:

| Path pattern                                  | Cache-Control                  |
|-----------------------------------------------|--------------------------------|
| `/electron/<tag>/<filename>` (pinned)         | `public, max-age=31536000, immutable` |
| `/electron/latest/<filename>` (mutable)       | `public, max-age=60`           |
| `/electron/beta/<filename>` (mutable)         | `public, max-age=60`           |
| `/electron/nightly/<filename>` (mutable)      | `public, max-age=30`           |
| `/electron/<channel>/manifest.json`           | `public, max-age=60`           |
| `/electron/<channel>/release-notes.json`      | `public, max-age=60`           |

If the site needs sub-minute updates after a release lands, the
release pipeline's `Ping Cloudflare Worker cache-bust` step (gated on
`CLOUDFLARE_API_TOKEN`) purges the relevant manifest URLs.

## Operational contacts

- Pipeline owner: ROX.ONE release engineering (this repo)
- R2 bucket admin: same
- Worker code: `infra/cloudflare/rox-one-release-feed.worker.ts`
  (this repo)
- Site repo: `rox-one` (separate Cloudflare Pages project)

Open issues / changes that affect the site must reference this file
so the contract stays in one place.
