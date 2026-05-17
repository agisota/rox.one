# rox-one Cloudflare workers

Two Workers live here:

| Worker | File | Routes |
|---|---|---|
| Release feed | `rox-one-release-feed.worker.ts` | `app.rox.one/electron/*`, `app.rox.one/install-app.{sh,ps1}` |
| Edge router | `rox-one-router.worker.ts` | `rox.one/*` (front-door router) |

This README documents the release-feed worker because it is what serves
desktop downloads from rox.one.

## What the release feed does

The worker is a thin, **tag-dynamic** proxy in front of the private GitHub
release for `agisota/rox-one-terminal`.

```
client → app.rox.one/electron/latest/{file}
       → Cloudflare edge (this worker)
       → GitHub API (resolve tag, fetch asset URL)
       → presigned S3 URL (the worker re-issues the request without the PAT)
       → client gets the bytes
```

The previous version of this worker hardcoded `v0.9.2` and Mac-only assets.
This version resolves the latest release via the GitHub API at request time
and proxies whatever assets are attached to it (mac `.dmg`/`.zip`, linux
`.AppImage`/`.deb`/`.rpm`, windows `.exe`, blockmaps, `latest-*.yml`,
`manifest.json`, install scripts).

## Required environment

| Variable | Scope | Notes |
|---|---|---|
| `GITHUB_RELEASE_TOKEN` | Secret | Fine-grained PAT with **Contents: Read** on `agisota/rox-one-terminal`. Used for both metadata lookups and asset fetches. |

## URL surface

| Path | Behaviour |
|---|---|
| `/electron/latest` <br> `/electron/latest/manifest.json` | Returns the `manifest.json` asset from the latest release. (The CI workflow `release-all-platforms.yml` emits this asset via the `publish-manifest` job.) |
| `/electron/latest/{filename}` | Streams the named asset from the latest release. Sets `Content-Disposition: attachment` for `.dmg`/`.zip`/`.exe`/`.AppImage`/`.deb`/`.rpm`. |
| `/electron/{version}` <br> `/electron/{version}/manifest.json` <br> `/electron/{version}/{filename}` | Same as `/latest/...` but pinned to the release tagged `v{version}`. Useful for reproducible downloads. |
| `/install-app.sh` <br> `/install-app.ps1` | Streams the installer script from the latest release. |
| Anything else | 404. |

## Security: redirect handling (do not regress)

`/repos/.../releases/assets/{id}` returns **HTTP 302** with a presigned S3 URL
in the `Location` header. Cloudflare Workers' default `fetch` follows
redirects automatically AND retains the `Authorization` header across the
redirect — which would leak our GitHub PAT to `objects.githubusercontent.com`.

`streamAsset()` uses `redirect: 'manual'`, inspects the 302 `Location`
header, and re-issues the second fetch **without** any `Authorization`
header. The presigned URL carries its own signature in the query string.

Regression test: see `infra/__tests__/rox-one-release-feed-worker.test.ts`,
the `does NOT forward GITHUB_RELEASE_TOKEN to the S3 redirect target` case.

## CORS

All responses (success, error, streamed binary, JSON manifest) carry:

```
Access-Control-Allow-Origin: *
Vary: Origin
```

The marketing site at `rox.one` fetches `https://app.rox.one/electron/latest/manifest.json` from JS — `rox.one` and `app.rox.one` are *same-site* but *different-origin*, so CORS applies. Permissive `*` is safe here: the surface is public, read-only, credential-free.

`OPTIONS` preflight responds with `204` and allows `GET, HEAD, OPTIONS`. Preflight runs before the `GITHUB_RELEASE_TOKEN` check, so a missing secret does not break CORS.

## Caching

Two module-scoped caches survive across requests within a single Worker
isolate (≈ a few seconds to a few hours, edge-pop-dependent):

- `latestTagCache` — the resolved "latest" tag name. 60 s TTL.
- `releaseCache` — the GitHub release metadata, keyed by tag. 60 s TTL per tag.

Expired entries are evicted on read so the `releaseCache` Map cannot grow
unbounded across the lifetime of a long-lived isolate.

Response cache headers:

- Binaries: `Cache-Control: public, max-age=300`.
- JSON / YAML / text: `Cache-Control: public, max-age=60`.

## Deploy

```bash
# 1. Author your local wrangler config from the example:
cp infra/cloudflare/wrangler.rox-one-release-feed.example.toml \
   infra/cloudflare/wrangler.rox-one-release-feed.toml

# 2. Set the GitHub PAT as a secret (one-time):
wrangler secret put GITHUB_RELEASE_TOKEN \
  --config infra/cloudflare/wrangler.rox-one-release-feed.toml

# 3. Deploy:
wrangler deploy \
  --config infra/cloudflare/wrangler.rox-one-release-feed.toml
```

## Smoke checks after deploy

```bash
# Manifest is fresh and matches the latest tag's package version:
curl -s https://app.rox.one/electron/latest/manifest.json | jq '.version, .binaries | keys'

# A binary download yields a 200 and the right content-type:
curl -sI https://app.rox.one/electron/latest/ROX-ONE-arm64.dmg \
  | grep -E '^(HTTP|content-type|content-disposition):'

# Pinned-version path resolves:
curl -s https://app.rox.one/electron/0.9.2/manifest.json | jq '.version'

# Install scripts proxy:
curl -sI https://app.rox.one/install-app.sh | grep -i content-type
```

## Roll back

The previous worker version is in git history. To restore it:

```bash
git log --oneline -- infra/cloudflare/rox-one-release-feed.worker.ts
git show <commit-hash>:infra/cloudflare/rox-one-release-feed.worker.ts > /tmp/old-worker.ts
# Inspect, swap, redeploy.
```

If you just need to roll back to the previous Worker deployment (no code
edit required):

```bash
wrangler rollback --config infra/cloudflare/wrangler.rox-one-release-feed.toml
```

## Tests

```bash
bun test infra/__tests__/rox-one-release-feed-worker.test.ts
```

Coverage:

- Manifest pass-through
- Per-platform binary proxying (mac `.zip`, linux `.AppImage`, windows `.exe`)
- Version-pinned paths
- Install script proxying
- 404 on unknown asset
- 503 when `GITHUB_RELEASE_TOKEN` is unset
- **Security:** no `Authorization` header on the S3 second hop
