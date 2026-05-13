export interface Env {
  GITHUB_RELEASE_TOKEN: string
}

const REPO = 'agisota/rox-one-terminal'
const TAG = 'v0.9.2'
const VERSION = TAG.slice(1)

type ReleaseAssetConfig = {
  contentType: string
  disposition?: string
}

type GitHubReleaseAsset = {
  name: string
  url: string
}

const ASSETS: Record<string, ReleaseAssetConfig> = {
  'ROX-ONE-arm64.dmg': {
    contentType: 'application/x-apple-diskimage',
    disposition: 'attachment; filename="ROX-ONE-arm64.dmg"',
  },
  'ROX-ONE-arm64.dmg.blockmap': {
    contentType: 'application/octet-stream',
  },
  'ROX-ONE-arm64.zip': {
    contentType: 'application/zip',
    disposition: 'attachment; filename="ROX-ONE-arm64.zip"',
  },
  'ROX-ONE-arm64.zip.blockmap': {
    contentType: 'application/octet-stream',
  },
  'install-app.sh': {
    contentType: 'text/x-shellscript; charset=utf-8',
  },
  'install-app.ps1': {
    contentType: 'text/plain; charset=utf-8',
  },
}

const latestMacYml = `version: 0.9.2
files:
  - url: ROX-ONE-arm64.zip
    sha512: JhHmL88DNI7BQov+6fkPYpze5XA0Nh8aRiTa1mt3HIDShsJCa3SCFVotFIG7dQj7IG5F+2BHf5N8VAMweMDpNQ==
    size: 309366025
    arch: arm64
  - url: ROX-ONE-arm64.dmg
    sha512: VfPiZhy5lb+aEs65wQoFX+G1C91rNz+wdKOoTZxUgNxDnjZF52RblhRUmwDgmUjNfJkaWvqEJLEys6yv0mnvrw==
    size: 320120298
    arch: arm64
path: ROX-ONE-arm64.zip
sha512: JhHmL88DNI7BQov+6fkPYpze5XA0Nh8aRiTa1mt3HIDShsJCa3SCFVotFIG7dQj7IG5F+2BHf5N8VAMweMDpNQ==
releaseDate: '2026-05-13T18:01:10.852Z'
`

function withHeaders(body: BodyInit, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', headers.get('Cache-Control') ?? 'public, max-age=60')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(body, { ...init, headers })
}

function notFound(): Response {
  return withHeaders('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

async function fetchReleaseAssetMetadata(assetName: string, env: Env): Promise<Response | GitHubReleaseAsset> {
  if (!env.GITHUB_RELEASE_TOKEN) {
    return withHeaders('Release feed is not configured\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const release = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_RELEASE_TOKEN}`,
      'User-Agent': 'rox-one-release-feed',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!release.ok) {
    return withHeaders(`Release metadata fetch failed: ${release.status}\n`, {
      status: release.status === 404 ? 404 : 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const releasePayload = (await release.json()) as { assets?: GitHubReleaseAsset[] }
  const asset = releasePayload.assets?.find((candidate) => candidate.name === assetName)
  if (!asset) return notFound()

  return asset
}

async function fetchPrivateReleaseAsset(assetName: string, env: Env): Promise<Response> {
  const assetConfig = ASSETS[assetName]
  if (!assetConfig) return notFound()

  const asset = await fetchReleaseAssetMetadata(assetName, env)
  if (asset instanceof Response) return asset

  const upstream = await fetch(asset.url, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${env.GITHUB_RELEASE_TOKEN}`,
      'User-Agent': 'rox-one-release-feed',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!upstream.ok) {
    return withHeaders(`Release asset fetch failed: ${upstream.status}\n`, {
      status: upstream.status === 404 ? 404 : 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const headers = new Headers(upstream.headers)
  headers.set('Content-Type', assetConfig.contentType)
  headers.set('Cache-Control', 'public, max-age=300')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (assetConfig.disposition) headers.set('Content-Disposition', assetConfig.disposition)

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}

function latestManifest(): Response {
  return withHeaders(
    JSON.stringify(
      {
        version: VERSION,
        build_time: '2026-05-13T18:01:10.852Z',
        binaries: {
          'darwin-arm64': {
            url: 'https://app.rox.one/electron/latest/ROX-ONE-arm64.zip',
            sha256: '8050c770eaaeaf5eb93ac4099e84eda71d885d55cf48d5829469a5846296b25f',
            size: 309366025,
            filename: 'ROX-ONE-arm64.zip',
          },
        },
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  )
}

export function handleReleaseFeedRequest(request: Request, env: Env): Promise<Response> | Response {
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'

  if (
    pathname === '/electron/latest' ||
    pathname === '/electron/latest/manifest.json' ||
    pathname === `/electron/${VERSION}` ||
    pathname === `/electron/${VERSION}/manifest.json`
  ) {
    return latestManifest()
  }

  if (pathname === '/electron/latest/latest-mac.yml' || pathname === `/electron/${VERSION}/latest-mac.yml`) {
    return withHeaders(latestMacYml, { headers: { 'Content-Type': 'application/x-yaml; charset=utf-8' } })
  }

  if (pathname === '/electron/latest/latest.yml' || pathname === `/electron/${VERSION}/latest.yml`) {
    return withHeaders(`Windows release is not available for v${VERSION}\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (pathname === '/install-app.sh') {
    return fetchPrivateReleaseAsset('install-app.sh', env)
  }

  if (pathname === '/install-app.ps1') {
    return fetchPrivateReleaseAsset('install-app.ps1', env)
  }

  const latestAssetMatch = pathname.match(/^\/electron\/latest\/([^/]+)$/)
  if (latestAssetMatch) {
    return fetchPrivateReleaseAsset(decodeURIComponent(latestAssetMatch[1]), env)
  }

  const versionedPrefix = `/electron/${VERSION}/`
  if (pathname.startsWith(versionedPrefix)) {
    return fetchPrivateReleaseAsset(decodeURIComponent(pathname.slice(versionedPrefix.length)), env)
  }

  return notFound()
}

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    return handleReleaseFeedRequest(request, env)
  },
}
