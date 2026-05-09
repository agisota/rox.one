export interface Env {
  GITHUB_RELEASE_TOKEN: string
}

const REPO = 'agisota/rox-one-terminal'
const TAG = 'v0.9.1'

const ASSETS: Record<string, { id: number; contentType: string; disposition?: string }> = {
  'ROX-ONE-arm64.dmg': {
    id: 415899638,
    contentType: 'application/x-apple-diskimage',
    disposition: 'attachment; filename="ROX-ONE-arm64.dmg"',
  },
  'ROX-ONE-arm64.dmg.blockmap': {
    id: 415899636,
    contentType: 'application/octet-stream',
  },
  'ROX-ONE-arm64.zip': {
    id: 415899637,
    contentType: 'application/zip',
    disposition: 'attachment; filename="ROX-ONE-arm64.zip"',
  },
  'ROX-ONE-arm64.zip.blockmap': {
    id: 415899642,
    contentType: 'application/octet-stream',
  },
  'install-app.sh': {
    id: 415900506,
    contentType: 'text/x-shellscript; charset=utf-8',
  },
  'install-app.ps1': {
    id: 415900507,
    contentType: 'text/plain; charset=utf-8',
  },
}

const latestMacYml = `version: 0.9.1
files:
  - url: ROX-ONE-arm64.zip
    sha512: tPHLHYY99vcm3bFE6G/4Bulfr20UUVrSYG0CzT6gQESmvz25dv7+t4v5UUdDOxBRJPCRfi+e1ckdbuKqCAJXQQ==
    size: 317278715
    arch: arm64
  - url: ROX-ONE-arm64.dmg
    sha512: uHuoKmpsOsnqAprmDkOvapmzXGEdk/IJWDWEEUT9tE9tpFJrujuT1zWxxWULU0hwSa3c0xvhEclqii8ipAORsw==
    size: 328215910
    arch: arm64
path: ROX-ONE-arm64.zip
sha512: tPHLHYY99vcm3bFE6G/4Bulfr20UUVrSYG0CzT6gQESmvz25dv7+t4v5UUdDOxBRJPCRfi+e1ckdbuKqCAJXQQ==
releaseDate: '2026-05-09T01:23:37.966Z'
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

async function fetchPrivateReleaseAsset(assetName: string, env: Env): Promise<Response> {
  const asset = ASSETS[assetName]
  if (!asset) return notFound()

  if (!env.GITHUB_RELEASE_TOKEN) {
    return withHeaders('Release feed is not configured\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const upstream = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, {
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
  headers.set('Content-Type', asset.contentType)
  headers.set('Cache-Control', 'public, max-age=300')
  headers.set('X-Content-Type-Options', 'nosniff')
  if (asset.disposition) headers.set('Content-Disposition', asset.disposition)

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}

function latestManifest(): Response {
  return withHeaders(
    JSON.stringify(
      {
        version: '0.9.1',
        build_time: '2026-05-09T01:23:37.966Z',
        binaries: {
          'darwin-arm64': {
            url: 'https://app.rox.one/electron/latest/ROX-ONE-arm64.zip',
            sha256: '3a124e2619c9880051716132e345d22badd61301a01c9e2ef275cc90d0ecc19f',
            size: 317278715,
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

  if (pathname === '/electron/latest' || pathname === '/electron/latest/manifest.json') {
    return latestManifest()
  }

  if (pathname === '/electron/latest/latest-mac.yml') {
    return withHeaders(latestMacYml, { headers: { 'Content-Type': 'application/x-yaml; charset=utf-8' } })
  }

  if (pathname === '/electron/latest/latest.yml') {
    return withHeaders('Windows release is not available for v0.9.1\n', {
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

  return notFound()
}

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    return handleReleaseFeedRequest(request, env)
  },
}
