// =============================================================================
//  rox-one-release-feed worker
//
//  Resolves the latest release tag at request time and proxies whatever
//  artifacts that release publishes, including Linux .AppImage, Windows .exe,
//  and the aggregate manifest.json emitted by the publish-manifest CI job.
//
//  Backwards compatibility: every URL the old worker served still works.
//  /electron/latest/{file}, /electron/{version}/{file}, /install-app.sh,
//  /install-app.ps1, /electron/latest/manifest.json, /electron/latest/latest-mac.yml
//  all continue to function — they just resolve dynamically instead of from
//  hardcoded constants.
//
//  Required environment:
//    GITHUB_RELEASE_TOKEN — fine-grained PAT with "Contents: read" on the
//                          agisota/rox.one repo.
// =============================================================================

export interface Env {
  GITHUB_RELEASE_TOKEN: string
}

const REPO = 'agisota/rox.one'
const TAG_TTL_MS = 60_000 // cache the resolved "latest" tag for 60s
const ASSET_TTL_MS = 60_000 // cache asset metadata lookups for 60s
const BINARY_CACHE_MAX_AGE = 300 // public Cache-Control on streamed binaries
const TEXT_CACHE_MAX_AGE = 60 // public Cache-Control on JSON / YAML

type GitHubReleaseAsset = {
  name: string
  url: string
  size: number
  updated_at?: string
}

type GitHubRelease = {
  tag_name: string
  draft?: boolean
  prerelease?: boolean
  assets?: GitHubReleaseAsset[]
}

// Module-scoped caches. Workers reuse module memory across requests within an
// isolate, so this is effectively a per-edge-pop in-process cache.
type ReleaseChannel = 'stable' | 'beta'

const STABLE_TAG_RE = /^v[0-9]+\.[0-9]+\.[0-9]+$/
const BETA_TAG_RE = /^v[0-9]+\.[0-9]+\.[0-9]+-(?:beta|rc)\.[0-9]+$/
const REQUIRED_BETA_ASSETS = ['manifest.json', 'beta-mac.yml', 'beta.yml', 'beta-linux.yml'] as const

let latestTagCache: { value: string; expiresAt: number } | null = null
const channelTagCache = new Map<ReleaseChannel, { value: string; expiresAt: number }>()
const releaseCache = new Map<string, { value: GitHubRelease; expiresAt: number }>()

export function resetReleaseFeedCachesForTest(): void {
  latestTagCache = null
  channelTagCache.clear()
  releaseCache.clear()
}

// The release-feed surface is public, read-only, and credential-free, so a
// permissive CORS policy is safe and lets the marketing site at rox.one
// fetch manifest.json from app.rox.one (different origin, same site).
// Applied uniformly to JSON, YAML, error responses, and streamed assets so
// browser-side consumers always see the response body rather than an opaque
// CORS error.
function applyCors(headers: Headers): void {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Vary', 'Origin')
}

function withHeaders(body: BodyInit, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', headers.get('Cache-Control') ?? `public, max-age=${TEXT_CACHE_MAX_AGE}`)
  headers.set('X-Content-Type-Options', 'nosniff')
  applyCors(headers)
  return new Response(body, { ...init, headers })
}

function plainText(status: number, message: string, cacheControl = 'no-store'): Response {
  return withHeaders(message.endsWith('\n') ? message : `${message}\n`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cacheControl },
  })
}

function notFound(): Response {
  return plainText(404, 'Not found')
}

function contentTypeFor(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'application/x-yaml; charset=utf-8'
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8'
  if (lower.endsWith('.sh')) return 'text/x-shellscript; charset=utf-8'
  if (lower.endsWith('.ps1')) return 'text/plain; charset=utf-8'
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage'
  if (lower.endsWith('.zip')) return 'application/zip'
  if (lower.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'
  if (lower.endsWith('.appimage')) return 'application/octet-stream'
  if (lower.endsWith('.deb')) return 'application/vnd.debian.binary-package'
  if (lower.endsWith('.rpm')) return 'application/x-rpm'
  if (lower.endsWith('.blockmap')) return 'application/octet-stream'
  return 'application/octet-stream'
}

function shouldAttach(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return (
    lower.endsWith('.dmg') ||
    lower.endsWith('.zip') ||
    lower.endsWith('.exe') ||
    lower.endsWith('.appimage') ||
    lower.endsWith('.deb') ||
    lower.endsWith('.rpm')
  )
}

async function githubRequest(path: string, env: Env): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_RELEASE_TOKEN}`,
      'User-Agent': 'rox-one-release-feed',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

function isStableRelease(release: GitHubRelease): boolean {
  return release.draft !== true && release.prerelease !== true && STABLE_TAG_RE.test(release.tag_name)
}

function releaseHasAssets(release: GitHubRelease, names: readonly string[]): boolean {
  const assetNames = new Set(release.assets?.map((asset) => asset.name) ?? [])
  return names.every((name) => assetNames.has(name))
}

function isBetaRelease(release: GitHubRelease): boolean {
  return (
    release.draft !== true &&
    release.prerelease === true &&
    BETA_TAG_RE.test(release.tag_name) &&
    releaseHasAssets(release, REQUIRED_BETA_ASSETS)
  )
}

async function fetchReleaseList(env: Env): Promise<GitHubRelease[] | Response> {
  const response = await githubRequest(`/repos/${REPO}/releases?per_page=30`, env)
  if (!response.ok) {
    return plainText(response.status === 404 ? 404 : 502, `Release list lookup failed: ${response.status}`)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return plainText(502, 'Release list payload is not JSON')
  }
  if (!Array.isArray(payload)) {
    return plainText(502, 'Release list payload is not an array')
  }
  return payload as GitHubRelease[]
}

async function resolveStableViaGitHubLatest(env: Env, now: number): Promise<string | Response> {
  const response = await githubRequest(`/repos/${REPO}/releases/latest`, env)
  if (!response.ok) {
    return plainText(response.status === 404 ? 404 : 502, `Latest release lookup failed: ${response.status}`)
  }
  const payload = (await response.json()) as { tag_name?: string; prerelease?: boolean; draft?: boolean }
  if (!payload.tag_name) {
    return plainText(502, 'Latest release missing tag_name')
  }
  if (!STABLE_TAG_RE.test(payload.tag_name)) {
    return plainText(502, `Latest release tag is not stable: ${payload.tag_name}`)
  }
  latestTagCache = { value: payload.tag_name, expiresAt: now + TAG_TTL_MS }
  channelTagCache.set('stable', { value: payload.tag_name, expiresAt: now + TAG_TTL_MS })
  return payload.tag_name
}

async function resolveChannelTag(channel: ReleaseChannel, env: Env): Promise<string | Response> {
  const now = Date.now()
  const cached = channelTagCache.get(channel)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  channelTagCache.delete(channel)
  if (channel === 'stable') latestTagCache = null

  const releases = await fetchReleaseList(env)
  if (releases instanceof Response) {
    if (channel === 'stable') {
      return resolveStableViaGitHubLatest(env, now)
    }
    return releases
  }

  const selected = releases.find(channel === 'stable' ? isStableRelease : isBetaRelease)
  if (!selected) {
    if (channel === 'stable') {
      return resolveStableViaGitHubLatest(env, now)
    }
    return plainText(404, 'No beta release found')
  }

  channelTagCache.set(channel, { value: selected.tag_name, expiresAt: now + TAG_TTL_MS })
  if (channel === 'stable') {
    latestTagCache = { value: selected.tag_name, expiresAt: now + TAG_TTL_MS }
  }
  return selected.tag_name
}

async function resolveLatestTag(env: Env): Promise<string | Response> {
  const now = Date.now()
  if (latestTagCache && latestTagCache.expiresAt > now) {
    return latestTagCache.value
  }
  return resolveChannelTag('stable', env)
}

async function fetchRelease(tag: string, env: Env): Promise<GitHubRelease | Response> {
  const now = Date.now()
  const cached = releaseCache.get(tag)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  // Evict expired entry on read so the Map can't grow unbounded across the
  // isolate's lifetime as new version-pinned paths get hit over time.
  if (cached) releaseCache.delete(tag)

  const response = await githubRequest(`/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`, env)
  if (!response.ok) {
    return plainText(response.status === 404 ? 404 : 502, `Release metadata fetch failed: ${response.status}`)
  }
  const payload = (await response.json()) as GitHubRelease
  releaseCache.set(tag, { value: payload, expiresAt: now + ASSET_TTL_MS })
  return payload
}

async function resolveAsset(
  tag: string,
  assetName: string,
  env: Env,
): Promise<GitHubReleaseAsset | Response> {
  const release = await fetchRelease(tag, env)
  if (release instanceof Response) return release
  const asset = release.assets?.find((candidate) => candidate.name === assetName)
  if (!asset) return notFound()
  return asset
}

// HEAD requests skip the body but should preserve all metadata headers the
// GET response would have set. We synthesize this from the release metadata
// (which we already have cached) instead of touching GitHub a second time —
// matters for download accelerators, link previews, and curl -I checks.
//
// Trade-off: HEAD is metadata-truthful but availability-best-effort within
// the ASSET_TTL_MS cache window. If an asset is deleted between cache fill
// and HEAD call (up to 60s), HEAD still returns 200. A subsequent GET would
// fail at the streamAsset stage with 502. Acceptable for our use case.
function headResponse(asset: GitHubReleaseAsset): Response {
  // Mirror GET's type-aware cache policy so HEAD doesn't lie about freshness:
  // text manifests / scripts are short-cached (60s) while binaries are
  // long-cached (300s).
  const cacheControl = isTextLike(asset.name)
    ? `public, max-age=${TEXT_CACHE_MAX_AGE}`
    : `public, max-age=${BINARY_CACHE_MAX_AGE}`
  const headers = new Headers()
  headers.set('Content-Type', contentTypeFor(asset.name))
  headers.set('Content-Length', String(asset.size))
  headers.set('Cache-Control', cacheControl)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Accept-Ranges', 'bytes')
  setLastModified(headers, asset)
  setContentDisposition(headers, asset.name)
  applyCors(headers)
  return new Response(null, { status: 200, headers })
}

function setLastModified(headers: Headers, asset: GitHubReleaseAsset): void {
  if (!asset.updated_at) return
  const parsed = new Date(asset.updated_at)
  if (Number.isNaN(parsed.getTime())) return
  headers.set('Last-Modified', parsed.toUTCString())
}

// Asset names come from GitHub release metadata and ARE attacker-influenceable
// by anyone who can publish a release. Embed them with RFC 6266 percent-
// encoding so a name containing `"` / `\` / CR / LF cannot inject header
// bytes. A simple ASCII filename fallback is also supplied for clients that
// don't understand RFC 5987's filename* syntax.
function setContentDisposition(headers: Headers, assetName: string): void {
  if (!shouldAttach(assetName)) return
  const safeAscii = assetName.replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(assetName)
  headers.set('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`)
}

function isTextLike(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return (
    lower.endsWith('.json') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.sh') ||
    lower.endsWith('.ps1')
  )
}

async function streamAsset(asset: GitHubReleaseAsset, env: Env): Promise<Response> {
  // GitHub returns a 302 from /releases/assets/{id} (with Accept:
  // application/octet-stream) to a presigned S3 URL. We MUST follow the
  // redirect manually and strip the Authorization header on the second hop —
  // Cloudflare Workers' default `redirect: 'follow'` retains the header
  // across cross-origin redirects, which would leak the GitHub PAT to
  // objects.githubusercontent.com / S3.
  const apiResponse = await fetch(asset.url, {
    redirect: 'manual',
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${env.GITHUB_RELEASE_TOKEN}`,
      'User-Agent': 'rox-one-release-feed',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  // Only the 3xx statuses that carry a Location header are real redirects we
  // need to follow. 304 (Not Modified) also lives in 3xx but is body-less and
  // must be passed through, not treated as a redirect.
  const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

  let upstream: Response
  if (REDIRECT_CODES.has(apiResponse.status)) {
    const location = apiResponse.headers.get('location')
    if (!location) {
      return plainText(502, 'Release asset redirect missing Location header')
    }
    // Resolve relative Locations against the asset URL (RFC 7231 permits
    // relative; GitHub today emits absolute, but defend the invariant).
    let target: URL
    try {
      target = new URL(location, asset.url)
    } catch {
      return plainText(502, 'Release asset redirect Location is not a valid URL')
    }
    // Protocol allowlist — never follow into javascript: / data: / file: / etc.
    if (target.protocol !== 'https:') {
      return plainText(502, `Refusing to follow non-https redirect to ${target.protocol}`)
    }
    // Second hop: no Authorization header. The presigned URL carries its own
    // signature in the query string; sending our PAT to S3 would be a leak.
    upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'rox-one-release-feed',
      },
    })
  } else {
    upstream = apiResponse
  }

  if (!upstream.ok) {
    return plainText(upstream.status === 404 ? 404 : 502, `Release asset fetch failed: ${upstream.status}`)
  }
  // Whitelist upstream headers we want to forward. Default-passthrough is
  // dangerous: S3 returns Set-Cookie, x-amz-id-2, x-amz-request-id, Server,
  // x-amz-version-id, etc. Combined with our `Cache-Control: public, ...`
  // and `Access-Control-Allow-Origin: *`, any Set-Cookie on a redirect
  // target would get cached at the edge and replayed to every downloader.
  // Even absent cookies, AWS infra headers are unnecessary disclosure.
  const headers = new Headers()
  for (const name of UPSTREAM_PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('Content-Type', contentTypeFor(asset.name))
  // Mirror HEAD: text-like assets get the short TTL, binaries the long one.
  headers.set(
    'Cache-Control',
    isTextLike(asset.name) ? `public, max-age=${TEXT_CACHE_MAX_AGE}` : `public, max-age=${BINARY_CACHE_MAX_AGE}`,
  )
  headers.set('X-Content-Type-Options', 'nosniff')
  setLastModified(headers, asset)
  setContentDisposition(headers, asset.name)
  applyCors(headers)
  return new Response(upstream.body, { status: upstream.status, headers })
}

// Minimum set of upstream headers worth forwarding. Anything outside this
// list (Set-Cookie, x-amz-*, Server, etc.) is intentionally dropped.
const UPSTREAM_PASSTHROUGH_HEADERS = ['content-length', 'etag', 'accept-ranges'] as const

async function serveAssetByName(
  tag: string,
  assetName: string,
  env: Env,
  method: 'GET' | 'HEAD' = 'GET',
): Promise<Response> {
  const asset = await resolveAsset(tag, assetName, env)
  if (asset instanceof Response) return asset
  if (method === 'HEAD') return headResponse(asset)
  return streamAsset(asset, env)
}

export async function handleReleaseFeedRequest(request: Request, env: Env): Promise<Response> {
  // Preflight: respond with the same permissive CORS policy as actual
  // responses. Pre-auth (intentional — CORS preflight must not require
  // credentials per the CORS spec). Vary on the request-header entries so
  // shared caches don't poison preflights across different consumers.
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method',
      },
    })
  }

  if (!env.GITHUB_RELEASE_TOKEN) {
    // Don't tell unauthenticated callers WHY we're 503 — that would confirm
    // the PAT is missing/rotated and accelerate exploitation. Log specifics
    // server-side so operators can still diagnose from Workers logs.
    console.warn('release-feed: GITHUB_RELEASE_TOKEN missing or empty')
    return plainText(503, 'Service Unavailable')
  }

  // Only GET and HEAD are meaningful for a download feed; reject anything else
  // with 405. RFC 7231 §6.5.5 requires the Allow header on 405 responses.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const headers = new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      Allow: 'GET, HEAD, OPTIONS',
    })
    applyCors(headers)
    return new Response(`Method not allowed: ${request.method}\n`, { status: 405, headers })
  }
  const method = request.method as 'GET' | 'HEAD'

  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'

  // Install scripts are always pulled from the latest stable release.
  if (pathname === '/install-app.sh' || pathname === '/install-app.ps1') {
    const tag = await resolveChannelTag('stable', env)
    if (typeof tag !== 'string') return tag
    return serveAssetByName(tag, pathname.slice(1), env, method)
  }

  // Channel paths:
  // - /electron/latest is a backward-compatible alias for stable.
  // - /electron/stable resolves to the newest non-prerelease vX.Y.Z tag.
  // - /electron/beta resolves to the newest vX.Y.Z-beta.N or vX.Y.Z-rc.N prerelease tag.
  const channelMatch = pathname.match(/^\/electron\/(latest|stable|beta)(?:\/(.+))?$/)
  if (channelMatch) {
    const channel = channelMatch[1] === 'beta' ? 'beta' : 'stable'
    const rest = channelMatch[2]
    const tag = await resolveChannelTag(channel, env)
    if (typeof tag !== 'string') return tag
    const assetName = !rest || rest === 'manifest.json' ? 'manifest.json' : decodeURIComponent(rest)
    return serveAssetByName(tag, assetName, env, method)
  }

  // /electron/{version}, /electron/{version}/manifest.json, /electron/{version}/{filename}
  // Version path supports stable and prerelease tags with or without leading `v`.
  const versionMatch = pathname.match(/^\/electron\/(v?[0-9]+\.[0-9]+\.[0-9]+(?:-(?:rc|beta)\.[0-9]+)?)(?:\/(.+))?$/)
  if (versionMatch) {
    const versionPart = versionMatch[1]
    const tag = versionPart.startsWith('v') ? versionPart : `v${versionPart}`
    const rest = versionMatch[2]
    if (!rest || rest === 'manifest.json') {
      return serveAssetByName(tag, 'manifest.json', env, method)
    }
    return serveAssetByName(tag, decodeURIComponent(rest), env, method)
  }

  return notFound()
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleReleaseFeedRequest(request, env)
  },
}
