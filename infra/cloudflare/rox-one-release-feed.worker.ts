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
//                          agisota/rox-one-terminal repo.
// =============================================================================

export interface Env {
  GITHUB_RELEASE_TOKEN: string
}

const REPO = 'agisota/rox-one-terminal'
const TAG_TTL_MS = 60_000 // cache the resolved "latest" tag for 60s
const ASSET_TTL_MS = 60_000 // cache asset metadata lookups for 60s
const BINARY_CACHE_MAX_AGE = 300 // public Cache-Control on streamed binaries
const TEXT_CACHE_MAX_AGE = 60 // public Cache-Control on JSON / YAML

type GitHubReleaseAsset = {
  name: string
  url: string
  size: number
}

type GitHubRelease = {
  tag_name: string
  draft?: boolean
  prerelease?: boolean
  assets?: GitHubReleaseAsset[]
}

// Module-scoped caches. Workers reuse module memory across requests within an
// isolate, so this is effectively a per-edge-pop in-process cache.
let latestTagCache: { value: string; expiresAt: number } | null = null
const releaseCache = new Map<string, { value: GitHubRelease; expiresAt: number }>()

export function resetReleaseFeedCachesForTest(): void {
  latestTagCache = null
  releaseCache.clear()
}

function withHeaders(body: BodyInit, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', headers.get('Cache-Control') ?? `public, max-age=${TEXT_CACHE_MAX_AGE}`)
  headers.set('X-Content-Type-Options', 'nosniff')
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

async function resolveLatestTag(env: Env): Promise<string | Response> {
  const now = Date.now()
  if (latestTagCache && latestTagCache.expiresAt > now) {
    return latestTagCache.value
  }
  const response = await githubRequest(`/repos/${REPO}/releases/latest`, env)
  if (!response.ok) {
    return plainText(response.status === 404 ? 404 : 502, `Latest release lookup failed: ${response.status}`)
  }
  const payload = (await response.json()) as { tag_name?: string }
  if (!payload.tag_name) {
    return plainText(502, 'Latest release missing tag_name')
  }
  latestTagCache = { value: payload.tag_name, expiresAt: now + TAG_TTL_MS }
  return payload.tag_name
}

async function fetchRelease(tag: string, env: Env): Promise<GitHubRelease | Response> {
  const now = Date.now()
  const cached = releaseCache.get(tag)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
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

async function streamAsset(asset: GitHubReleaseAsset, env: Env): Promise<Response> {
  const upstream = await fetch(asset.url, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${env.GITHUB_RELEASE_TOKEN}`,
      'User-Agent': 'rox-one-release-feed',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!upstream.ok) {
    return plainText(upstream.status === 404 ? 404 : 502, `Release asset fetch failed: ${upstream.status}`)
  }
  const headers = new Headers(upstream.headers)
  headers.set('Content-Type', contentTypeFor(asset.name))
  headers.set('Cache-Control', `public, max-age=${BINARY_CACHE_MAX_AGE}`)
  headers.set('X-Content-Type-Options', 'nosniff')
  if (shouldAttach(asset.name)) {
    headers.set('Content-Disposition', `attachment; filename="${asset.name}"`)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}

async function serveAssetByName(tag: string, assetName: string, env: Env): Promise<Response> {
  const asset = await resolveAsset(tag, assetName, env)
  if (asset instanceof Response) return asset
  return streamAsset(asset, env)
}

export async function handleReleaseFeedRequest(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_RELEASE_TOKEN) {
    return plainText(503, 'Release feed is not configured')
  }

  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'

  // Install scripts are always pulled from the latest release.
  if (pathname === '/install-app.sh' || pathname === '/install-app.ps1') {
    const tag = await resolveLatestTag(env)
    if (typeof tag !== 'string') return tag
    return serveAssetByName(tag, pathname.slice(1), env)
  }

  // /electron/latest and /electron/latest/manifest.json — both serve manifest.
  if (pathname === '/electron/latest' || pathname === '/electron/latest/manifest.json') {
    const tag = await resolveLatestTag(env)
    if (typeof tag !== 'string') return tag
    return serveAssetByName(tag, 'manifest.json', env)
  }

  // /electron/latest/{filename}
  const latestAssetMatch = pathname.match(/^\/electron\/latest\/([^/]+)$/)
  if (latestAssetMatch) {
    const tag = await resolveLatestTag(env)
    if (typeof tag !== 'string') return tag
    return serveAssetByName(tag, decodeURIComponent(latestAssetMatch[1]), env)
  }

  // /electron/{version}, /electron/{version}/manifest.json, /electron/{version}/{filename}
  // Version path → tag is `v{version}`.
  const versionMatch = pathname.match(/^\/electron\/(v?[0-9]+\.[0-9]+\.[0-9]+(?:-rc\.[0-9]+)?)(?:\/(.+))?$/)
  if (versionMatch) {
    const versionPart = versionMatch[1]
    const tag = versionPart.startsWith('v') ? versionPart : `v${versionPart}`
    const rest = versionMatch[2]
    if (!rest || rest === 'manifest.json') {
      return serveAssetByName(tag, 'manifest.json', env)
    }
    return serveAssetByName(tag, decodeURIComponent(rest), env)
  }

  return notFound()
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleReleaseFeedRequest(request, env)
  },
}
