export interface Env {
  ROX_ONE_MARKETING_ORIGIN: string
  ROX_ONE_WEBUI_ORIGIN: string
}

const PRODUCT_PATH_PREFIXES = [
  '/api/',
  '/client/',
  '/current_time',
  '/graphql/v2',
  '/login',
  '/signup/',
  '/register',
  '/reset-password',
  '/account',
  '/auth/',
  '/upgrade',
  '/login_options/',
  '/link_sso',
  '/proxy/',
  '/workspace/',
  '/session/',
  '/settings',
]

function isProductPath(pathname: string): boolean {
  return PRODUCT_PATH_PREFIXES.some((prefix) => {
    if (pathname === prefix) return true
    return prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname.startsWith(`${prefix}/`)
  })
}

function buildUpstreamRequest(request: Request, origin: string, env: Env): Request {
  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(origin)
  upstreamUrl.pathname = incomingUrl.pathname
  upstreamUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-forwarded-host', incomingUrl.host)
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''))
  if (origin === env.ROX_ONE_MARKETING_ORIGIN) {
    headers.delete('cookie')
    headers.delete('authorization')
  }

  return new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  })
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = isProductPath(url.pathname)
      ? env.ROX_ONE_WEBUI_ORIGIN
      : env.ROX_ONE_MARKETING_ORIGIN

    return fetch(buildUpstreamRequest(request, origin, env))
  },
}
