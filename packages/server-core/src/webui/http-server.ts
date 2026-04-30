/**
 * Web UI HTTP handler and standalone server.
 *
 * The core logic lives in `createWebuiHandler()` which returns a web-standard
 * fetch handler `(Request) => Promise<Response>`. This handler can be:
 *
 * 1. **Embedded** — attached to the WsRpcServer's HTTPS server via the
 *    node-adapter so that HTTP and WSS share a single port.
 * 2. **Standalone** — wrapped in `Bun.serve()` via `startWebuiHttpServer()`
 *    for separate-port deployments or development.
 */

import { join, extname } from 'node:path'
import {
  RateLimiter,
  initPasswordHash,
  verifyPassword,
  createSessionToken,
  createAccountSessionToken,
  validateSession,
  validateAccountSession,
  buildSessionCookie,
  buildLogoutCookie,
} from './auth'
import { generateCallbackPage } from '@rox-agent/shared/auth'
import type { PlatformServices } from '../runtime/platform'
import type { AccountStore, PublicUser, SessionIdentity } from '../accounts'
import { AccountAuthError, AccountConflictError } from '../accounts'
import type { AccountEmailService } from './email'
import {
  createAccountCabinetBilling,
  createAccountCabinetBillingFromLedger,
  createAccountCabinetEvents,
  createAccountCabinetEventsFromHistory,
  createAccountCabinetOrganizations,
  createDisabledTopUpIntent,
} from './account-cabinet'
import type { AccountUsageLedger } from './account-ledger'
import type { AccountEventHistory } from './account-events'
import {
  createDvnetTopUpIntent,
  DvnetWebhookSignatureError,
  InMemoryDvnetBillingIntentStore,
  processDvnetWebhook,
  type DvnetBillingIntentStore,
} from './account-billing'
import {
  createCloudSessionBoundary,
  createLocalSessionBoundary,
} from './account-session-boundary'
import {
  AccountTeamForbiddenError,
  AccountTeamInviteError,
  createAccountCabinetOrganizationsFromTeams,
  type AccountTeamStore,
} from './account-teams'
import type { ManagedCloudWorkspaceStore } from './account-cloud-workspaces'
import {
  createStorageBucketRecord,
  resolveS3EndpointPreference,
  toStorageStatusDto,
} from '../storage/object-storage'

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.map': 'application/json',
}

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
}

function redactAuthUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    for (const key of ['token', 'code', 'state']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '[redacted]')
    }
    return url.toString()
  } catch {
    return rawUrl.replace(/([?&](?:token|code|state)=)[^&\s]+/gi, '$1[redacted]')
  }
}

const PEER_IP_HEADER = 'x-rox-peer-ip'
const DVNET_WEBHOOK_MAX_BYTES = 64 * 1024

function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('::ffff:')) return trimmed.slice('::ffff:'.length)
  if (trimmed === '::1') return '127.0.0.1'
  return trimmed.replace(/^\[|\]$/g, '')
}

function isLoopbackHost(host: string | null | undefined): boolean {
  const trimmed = host?.trim().toLowerCase().replace(/^\[|\]$/g, '')
  const normalized = trimmed?.replace(/:\d+$/, '')
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
}

function isLoopbackIp(ip: string | null): boolean {
  return ip === '127.0.0.1' || ip === '::1'
}

function parseTrustedProxyEnv(): Set<string> {
  const raw = process.env.ROX_WEBUI_TRUSTED_PROXIES || process.env.ROX_TRUSTED_PROXIES || ''
  return new Set(raw.split(/[,\s]+/).map(item => normalizeIp(item)).filter((item): item is string => Boolean(item)))
}

function isTrustedProxyPeer(peerIp: string | null, trustedProxies: Set<string>): boolean {
  if (trustedProxies.has('*')) return true
  if (!peerIp) return false
  return trustedProxies.has(peerIp) || isLoopbackIp(peerIp)
}

function shouldTrustForwardedHeaders(req: Request): boolean {
  if (process.env.ROX_TRUST_FORWARDED_HEADERS !== '1') return false
  const peerIp = normalizeIp(req.headers.get(PEER_IP_HEADER))
  return isTrustedProxyPeer(peerIp, parseTrustedProxyEnv())
}

function getForwardedValue(req: Request, key: 'proto' | 'host'): string | null {
  const forwarded = req.headers.get('forwarded')
  if (!forwarded) return null

  const match = forwarded.match(new RegExp(`${key}="?([^;,"]+)"?`, 'i'))
  return match?.[1]?.trim() || null
}

function getRequestProto(req: Request): string {
  if (!shouldTrustForwardedHeaders(req)) {
    return new URL(req.url).protocol.replace(/:$/, '')
  }
  return req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    || getForwardedValue(req, 'proto')
    || new URL(req.url).protocol.replace(/:$/, '')
}

function getRequestHost(req: Request): string | null {
  if (!shouldTrustForwardedHeaders(req)) {
    return req.headers.get('host')
  }
  return req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    || getForwardedValue(req, 'host')
    || req.headers.get('host')
}

function formatHostWithPort(host: string, port: number): string {
  try {
    const parsed = new URL(`http://${host}`)
    const hostname = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname
    return `${hostname}:${port}`
  } catch {
    const withoutPort = host.replace(/:\d+$/, '')
    return `${withoutPort}:${port}`
  }
}

export function shouldUseSecureCookies(req: Request, secureCookies?: boolean): boolean {
  if (secureCookies != null) return secureCookies
  if (getRequestProto(req) === 'https') return true
  return !isLoopbackHost(getRequestHost(req) ?? new URL(req.url).hostname)
}

export interface ResolveWebSocketUrlOptions {
  publicWsUrl?: string
  wsProtocol: 'ws' | 'wss'
  wsPort: number
}

export function resolveWebSocketUrl(
  req: Request,
  { publicWsUrl, wsProtocol, wsPort }: ResolveWebSocketUrlOptions,
): string {
  if (publicWsUrl) return publicWsUrl

  const host = getRequestHost(req)
  if (host) {
    return `${wsProtocol}://${formatHostWithPort(host, wsPort)}`
  }

  return `${wsProtocol}://127.0.0.1:${wsPort}`
}

// ---------------------------------------------------------------------------
// Handler options (shared between embedded and standalone modes)
// ---------------------------------------------------------------------------

/** Dependencies for the /api/oauth/callback HTTP route (server-side OAuth completion). */
export interface OAuthCallbackDeps {
  flowStore: { getByState: (state: string) => any; remove: (state: string) => void }
  credManager: { exchangeAndStore: (...args: any[]) => Promise<any> }
  sessionManager: { completeAuthRequest: (...args: any[]) => Promise<void> }
  pushSourcesChanged: (workspaceId: string) => void
}

export interface WebuiHandlerOptions {
  /** Path to built web UI dist/ directory. */
  webuiDir: string
  /** Secret used to sign JWTs — typically ROX_SERVER_TOKEN. */
  secret: string
  /** Optional separate web UI password. Falls back to `secret` for verification. */
  password?: string
  /** Explicit Secure-cookie override. When unset, infer from the request / proxy headers. */
  secureCookies?: boolean
  /** Optional browser-facing WebSocket URL override for reverse-proxy deployments. */
  publicWsUrl?: string
  /** RPC WebSocket protocol used when building a browser-facing fallback URL. */
  wsProtocol: 'ws' | 'wss'
  /** RPC WebSocket port used when building a browser-facing fallback URL. */
  wsPort: number
  /** Health check function (injected from existing server handler). */
  getHealthCheck: () => { status: string }
  /** Logger. */
  logger: PlatformServices['logger']
  /** OAuth callback deps — when provided, enables /api/oauth/callback route. */
  oauthCallbackDeps?: OAuthCallbackDeps
  /** Optional hosted-account store. When present, WebUI uses email/password account auth. */
  accountStore?: AccountStore
  /** Whether open signup is enabled for hosted account mode. Default: true when accountStore exists. */
  signupEnabled?: boolean
  /** Public base URL used in email verification and password reset links. */
  publicAppUrl?: string
  /** Transactional email delivery for verification/reset/security messages. */
  accountEmailService?: AccountEmailService
  /** Optional account usage ledger for balance and billing history. */
  accountUsageLedger?: AccountUsageLedger
  /** Optional account event history for the account cabinet events panel. */
  accountEventHistory?: AccountEventHistory
  /** Optional account team store for organizations, invites, and RBAC. */
  accountTeamStore?: AccountTeamStore
  /** Optional managed cloud workspace metadata store. */
  accountCloudWorkspaceStore?: ManagedCloudWorkspaceStore
  /** Optional DV.net billing configuration. Secrets stay server-side. */
  accountDvnetBilling?: {
    storeUuid: string
    paymentBaseUrl: string
    webhookSecret: string
  }
  /** Optional DV.net intent store; defaults to process-local memory for embedded deployments/tests. */
  accountDvnetBillingIntentStore?: DvnetBillingIntentStore
  /** Optional account bootstrap hook, e.g. grant first user access to existing workspaces. */
  bootstrapAccount?: (user: PublicUser) => Promise<void>
  /**
   * Trusted proxy IPs/CIDRs. When set, proxy headers (x-forwarded-for, x-forwarded-proto)
   * are only trusted from these sources. When empty/unset, proxy headers are ignored
   * and 'direct' is used as the rate-limit key.
   */
  trustedProxies?: string[]
}

// ---------------------------------------------------------------------------
// Handler factory — the core request handler
// ---------------------------------------------------------------------------

export interface WebuiHandler {
  /** Web-standard fetch handler. */
  fetch: (req: Request) => Promise<Response>
  /** Call on shutdown to release timers. */
  dispose: () => void
  /** Inject OAuth callback deps after bootstrap (lazy wiring). */
  setOAuthCallbackDeps: (deps: OAuthCallbackDeps) => void
}

/**
 * Create a web-standard fetch handler for the WebUI.
 *
 * This handler can be used directly with `Bun.serve({ fetch })`,
 * or adapted for Node's HTTP server via `nodeHttpAdapter()`.
 */
export function createWebuiHandler(options: WebuiHandlerOptions): WebuiHandler {
  const {
    webuiDir,
    secret,
    password,
    secureCookies,
    publicWsUrl,
    wsProtocol,
    wsPort,
    getHealthCheck,
    logger,
    trustedProxies,
    accountStore,
  } = options

  const rateLimiter = new RateLimiter(5, 60_000)
  const cleanupTimer = setInterval(() => rateLimiter.cleanup(), 120_000)

  const loginPassword = password || secret
  const trustedProxySet = new Set(trustedProxies ?? [])
  const accountAuthEnabled = Boolean(accountStore)
  const signupEnabled = options.signupEnabled ?? accountAuthEnabled
  const dvnetBillingIntentStore = options.accountDvnetBillingIntentStore ?? new InMemoryDvnetBillingIntentStore()

  // Hash the login password at startup (async, but resolves before first auth attempt in practice)
  const passwordReady = initPasswordHash(loginPassword)

  /** Extract client IP — only trusts proxy headers when trustedProxies is configured. */
  function getClientIp(req: Request): string {
    const peerIp = normalizeIp(req.headers.get(PEER_IP_HEADER))
    if (trustedProxySet.size > 0) {
      if (isTrustedProxyPeer(peerIp, trustedProxySet)) {
        return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? req.headers.get('x-real-ip')
          ?? peerIp
          ?? 'direct'
      }
    }
    return peerIp ?? 'direct'
  }

  function isEmail(value: unknown): value is string {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }

  function isStrongEnoughPassword(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 8
  }

  function getPublicBaseUrl(req: Request): string {
    const configured = options.publicAppUrl?.trim().replace(/\/+$/, '')
    if (configured) return configured

    const host = getRequestHost(req)
    if (host) return `${getRequestProto(req)}://${host}`

    return new URL(req.url).origin
  }

  function buildPublicUrl(req: Request, path: string): string {
    return new URL(path, getPublicBaseUrl(req)).toString()
  }

  async function sendVerificationEmail(user: PublicUser, req: Request): Promise<void> {
    if (!accountStore) return
    const token = await accountStore.createEmailToken({ userId: user.id, purpose: 'verify_email' })
    const url = buildPublicUrl(req, `/api/auth/verify-email?token=${encodeURIComponent(token.rawToken)}`)
    if (options.accountEmailService) {
      await options.accountEmailService.sendVerificationEmail({
        to: user.email,
        displayName: user.displayName,
        url,
        expiresAt: token.expiresAt,
      })
    } else {
      logger.info(`[webui] Email verification link for ${user.email}: ${redactAuthUrl(url)}`)
    }
  }

  async function sendPasswordResetEmail(user: PublicUser, req: Request): Promise<void> {
    if (!accountStore) return
    const token = await accountStore.createEmailToken({ userId: user.id, purpose: 'password_reset' })
    const url = buildPublicUrl(req, `/reset-password?token=${encodeURIComponent(token.rawToken)}`)
    if (options.accountEmailService) {
      await options.accountEmailService.sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayName,
        url,
        expiresAt: token.expiresAt,
      })
    } else {
      logger.info(`[webui] Password reset link for ${user.email}: ${redactAuthUrl(url)}`)
    }
  }

  async function validateWebuiSession(cookieHeader: string | null): Promise<{ kind: 'account'; identity: SessionIdentity } | { kind: 'legacy' } | null> {
    if (accountStore) {
      const identity = await validateAccountSession(cookieHeader, secret, accountStore)
      return identity ? { kind: 'account', identity } : null
    }

    const legacy = await validateSession(cookieHeader, secret)
    return legacy ? { kind: 'legacy' } : null
  }

  async function requireAccountSession(req: Request): Promise<SessionIdentity | Response> {
    if (!accountStore) {
      return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
    }

    const session = await validateWebuiSession(req.headers.get('cookie'))
    if (!session || session.kind !== 'account') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return session.identity
  }

  async function createAccountCookie(user: PublicUser, req: Request, useSecureCookies: boolean, authMethod: 'password' | 'email_verification' | 'password_reset' = 'password'): Promise<string | Response> {
    if (!accountStore) {
      return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
    }

    const session = await accountStore.createSession({
      userId: user.id,
      userAgent: req.headers.get('user-agent'),
      ipAddress: getClientIp(req),
      authMethod,
    })
    const identity = await accountStore.getSessionIdentity(session.id)
    if (!identity) {
      return Response.json({ error: 'Failed to create session' }, { status: 500 })
    }
    const jwt = await createAccountSessionToken(secret, identity)
    return buildSessionCookie(jwt, useSecureCookies)
  }

  async function issueAccountCookie(user: PublicUser, req: Request, useSecureCookies: boolean, authMethod: 'password' | 'email_verification' | 'password_reset' = 'password'): Promise<Response> {
    const cookie = await createAccountCookie(user, req, useSecureCookies, authMethod)
    if (typeof cookie !== 'string') return cookie
    return Response.json({ ok: true, user }, {
      status: 200,
      headers: {
        'Set-Cookie': cookie,
      },
    })
  }

  async function fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    const useSecureCookies = shouldUseSecureCookies(req, secureCookies)

    // ── Health endpoint (no auth) ──
    if (path === '/health') {
      const health = getHealthCheck()
      return Response.json(health, {
        status: health.status === 'ok' ? 200 : 503,
      })
    }

    // ── Login page (no auth) ──
    if (path === '/login' || path === '/login/' || path === '/reset-password' || path === '/reset-password/') {
      const loginFile = Bun.file(join(webuiDir, 'login.html'))
      if (await loginFile.exists()) {
        return new Response(loginFile, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
      return new Response('Login page not found', { status: 404 })
    }

    // ── Static assets that login page needs (no auth) ──
    if (path === '/favicon.ico' || path.startsWith('/login-assets/')) {
      const file = Bun.file(join(webuiDir, path))
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': getMimeType(path) },
        })
      }
      return new Response('Not Found', { status: 404 })
    }

    // ── Public auth mode endpoint used by the login page ──
    if (path === '/api/auth/mode' && req.method === 'GET') {
      return Response.json({
        mode: accountAuthEnabled ? 'account' : 'legacy',
        signupEnabled,
        emailVerificationRequired: accountAuthEnabled,
        passwordResetEnabled: accountAuthEnabled,
        tokenLoginEnabled: !accountAuthEnabled,
      })
    }

    // ── Hosted account signup endpoint ──
    if (path === '/api/auth/register' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      if (!signupEnabled) {
        return Response.json({ error: 'Signup is disabled' }, { status: 403 })
      }

      const ip = getClientIp(req)
      if (!rateLimiter.check(ip)) {
        logger.warn(`[webui] Rate limited signup attempt from ${ip}`)
        return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
      }

      let body: { email?: string; password?: string; displayName?: string | null }
      try {
        body = await req.json() as { email?: string; password?: string; displayName?: string | null }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }

      if (!isEmail(body.email)) {
        return Response.json({ error: 'Valid email is required' }, { status: 400 })
      }
      if (!isStrongEnoughPassword(body.password)) {
        return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      try {
        const user = await accountStore.createUser({
          email: body.email,
          password: body.password,
          displayName: typeof body.displayName === 'string' ? body.displayName : null,
        })
        await options.bootstrapAccount?.(user)
        await sendVerificationEmail(user, req)
        logger.info(`[webui] Registered account ${user.email} from ${ip}`)
        return Response.json({
          ok: true,
          verificationRequired: true,
          user: {
            email: user.email,
            displayName: user.displayName,
          },
        })
      } catch (error) {
        if (error instanceof AccountConflictError) {
          return Response.json({ error: 'Email is already registered' }, { status: 409 })
        }
        throw error
      }
    }

    // ── Hosted account email verification ──
    if (path === '/api/auth/verify-email' && req.method === 'GET') {
      if (!accountStore) {
        return Response.redirect(new URL('/login', req.url).toString(), 302)
      }
      const token = url.searchParams.get('token')
      if (!token) {
        return Response.redirect(new URL('/login?verified=missing', req.url).toString(), 302)
      }

      const tokenUser = await accountStore.consumeEmailToken('verify_email', token)
      if (!tokenUser) {
        return Response.redirect(new URL('/login?verified=invalid', req.url).toString(), 302)
      }

      const user = await accountStore.markEmailVerified(tokenUser.id)
      const cookie = await createAccountCookie(user, req, useSecureCookies, 'email_verification')
      if (typeof cookie !== 'string') return cookie
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL('/', req.url).toString(),
          'Set-Cookie': cookie,
        },
      })
    }

    // ── Resend verification email by email address. Response is intentionally neutral. ──
    if (path === '/api/auth/verify-email/resend' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ ok: true })
      }
      const ip = getClientIp(req)
      if (!rateLimiter.check(ip)) {
        return Response.json({ ok: true })
      }
      let body: { email?: string }
      try {
        body = await req.json() as { email?: string }
      } catch {
        return Response.json({ ok: true })
      }
      if (isEmail(body.email)) {
        const user = await accountStore.getUserByEmail(body.email)
        if (user && !user.emailVerifiedAt && user.status !== 'disabled') {
          await sendVerificationEmail(user, req)
        }
      }
      return Response.json({ ok: true })
    }

    // ── Hosted account login endpoint ──
    if (path === '/api/auth/login' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }

      const ip = getClientIp(req)
      if (!rateLimiter.check(ip)) {
        logger.warn(`[webui] Rate limited login attempt from ${ip}`)
        return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
      }

      let body: { email?: string; password?: string }
      try {
        body = await req.json() as { email?: string; password?: string }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }

      if (!isEmail(body.email) || typeof body.password !== 'string') {
        return Response.json({ error: 'Email and password are required' }, { status: 400 })
      }

      const user = await accountStore.verifyPassword(body.email, body.password)
      if (!user) {
        logger.warn(`[webui] Failed account login from ${ip}`)
        return Response.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      if (user.status === 'disabled') {
        return Response.json({ error: 'Account is disabled' }, { status: 403 })
      }
      if (!user.emailVerifiedAt) {
        return Response.json({ error: 'Email verification required', code: 'email_unverified' }, { status: 403 })
      }

      logger.info(`[webui] Successful account login for ${user.email} from ${ip}`)
      return issueAccountCookie(user, req, useSecureCookies)
    }

    // ── Password reset request. Response is neutral to avoid account enumeration. ──
    if (path === '/api/auth/password-reset/request' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ ok: true })
      }
      const ip = getClientIp(req)
      if (!rateLimiter.check(ip)) {
        return Response.json({ ok: true })
      }
      let body: { email?: string }
      try {
        body = await req.json() as { email?: string }
      } catch {
        return Response.json({ ok: true })
      }
      if (isEmail(body.email)) {
        const user = await accountStore.getUserByEmail(body.email)
        if (user && user.status !== 'disabled') {
          await sendPasswordResetEmail(user, req)
        }
      }
      return Response.json({ ok: true })
    }

    if (path === '/api/auth/password-reset/confirm' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      let body: { token?: string; newPassword?: string }
      try {
        body = await req.json() as { token?: string; newPassword?: string }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }
      if (typeof body.token !== 'string' || !isStrongEnoughPassword(body.newPassword)) {
        return Response.json({ error: 'Valid reset token and new 8+ character password are required' }, { status: 400 })
      }

      const tokenUser = await accountStore.consumeEmailToken('password_reset', body.token)
      if (!tokenUser || tokenUser.status === 'disabled') {
        return Response.json({ error: 'Reset link is invalid or expired' }, { status: 400 })
      }

      await accountStore.setPassword(tokenUser.id, body.newPassword)
      await accountStore.markEmailVerified(tokenUser.id)
      await accountStore.revokeUserSessions(tokenUser.id)
      const user = await accountStore.getUser(tokenUser.id)
      if (!user) return Response.json({ error: 'User not found' }, { status: 404 })
      const cookie = await createAccountCookie(user, req, useSecureCookies, 'password_reset')
      if (typeof cookie !== 'string') return cookie
      return Response.json({ ok: true, user }, {
        headers: { 'Set-Cookie': cookie },
      })
    }

    // ── Legacy token/password auth endpoint ──
    if (path === '/api/auth' && req.method === 'POST') {
      if (accountStore) {
        return Response.json({ error: 'Use /api/auth/login for account auth' }, { status: 400 })
      }
      await passwordReady
      const ip = getClientIp(req)

      if (!rateLimiter.check(ip)) {
        logger.warn(`[webui] Rate limited auth attempt from ${ip}`)
        return Response.json(
          { error: 'Too many attempts. Try again later.' },
          { status: 429 },
        )
      }

      let body: { password?: string }
      try {
        body = await req.json() as { password?: string }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }

      if (!body.password || typeof body.password !== 'string') {
        return Response.json({ error: 'Password is required' }, { status: 400 })
      }

      if (!await verifyPassword(body.password)) {
        logger.warn(`[webui] Failed auth attempt from ${ip}`)
        return Response.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const jwt = await createSessionToken(secret)
      logger.info(`[webui] Successful auth from ${ip}`)

      return Response.json({ ok: true }, {
        status: 200,
        headers: {
          'Set-Cookie': buildSessionCookie(jwt, useSecureCookies),
        },
      })
    }

    // ── Logout endpoint ──
    if (path === '/api/auth/logout' && req.method === 'POST') {
      if (accountStore) {
        const session = await validateWebuiSession(req.headers.get('cookie'))
        if (session?.kind === 'account') {
          await accountStore.revokeSession(session.identity.sessionId)
        }
      }
      return new Response(null, {
        status: 204,
        headers: {
          'Set-Cookie': buildLogoutCookie(useSecureCookies),
        },
      })
    }

    // ── Current account endpoint ──
    if (path === '/api/account/me' && req.method === 'GET') {
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (session.kind === 'legacy') {
        return Response.json({
          mode: 'legacy',
          user: null,
          sessionBoundary: createLocalSessionBoundary(),
        })
      }
      const user = await accountStore!.getUser(session.identity.userId)
      const workspaceIds = await accountStore!.listWorkspaceIds(session.identity.userId)
      return Response.json({
        mode: 'account',
        user,
        currentSessionId: session.identity.sessionId,
        sessionBoundary: createCloudSessionBoundary(session.identity, workspaceIds),
      })
    }

    if (path === '/api/account/me' && req.method === 'PATCH') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session || session.kind !== 'account') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      let body: { displayName?: string | null }
      try {
        body = await req.json() as { displayName?: string | null }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }

      const user = await accountStore.updateUser(session.identity.userId, {
        displayName: typeof body.displayName === 'string' ? body.displayName : null,
      })
      return Response.json({ user })
    }

    if (path === '/api/account/password' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session || session.kind !== 'account') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      let body: { currentPassword?: string; newPassword?: string }
      try {
        body = await req.json() as { currentPassword?: string; newPassword?: string }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }

      if (typeof body.currentPassword !== 'string' || !isStrongEnoughPassword(body.newPassword)) {
        return Response.json({ error: 'Current password and a new 8+ character password are required' }, { status: 400 })
      }

      try {
        await accountStore.changePassword(session.identity.userId, body.currentPassword, body.newPassword)
        await accountStore.revokeOtherSessions(session.identity.userId, session.identity.sessionId)
        const user = await accountStore.getUser(session.identity.userId)
        if (user) await options.accountEmailService?.sendPasswordChangedEmail({ to: user.email, displayName: user.displayName })
        return Response.json({ ok: true })
      } catch (error) {
        if (error instanceof AccountAuthError) {
          return Response.json({ error: 'Current password is invalid' }, { status: 401 })
        }
        throw error
      }
    }

    if (path === '/api/account/email/verify' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session || session.kind !== 'account') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const user = await accountStore.getUser(session.identity.userId)
      if (user && !user.emailVerifiedAt && user.status !== 'disabled') {
        await sendVerificationEmail(user, req)
      }
      return Response.json({ ok: true })
    }

    if (path === '/api/account/sessions' && req.method === 'GET') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session || session.kind !== 'account') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return Response.json({
        currentSessionId: session.identity.sessionId,
        sessions: await accountStore.listSessions(session.identity.userId),
      })
    }

    if (path === '/api/account/billing' && req.method === 'GET') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (options.accountUsageLedger) {
        const balance = await options.accountUsageLedger.getBalance(identity.userId)
        return Response.json(createAccountCabinetBillingFromLedger(balance))
      }
      return Response.json(createAccountCabinetBilling(identity))
    }

    if (path === '/api/account/billing/top-up-intent' && req.method === 'POST') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (options.accountDvnetBilling && options.accountUsageLedger) {
        const balance = await options.accountUsageLedger.getBalance(identity.userId)
        const billing = createAccountCabinetBillingFromLedger(balance)
        const storedIntent = await dvnetBillingIntentStore.createIntent({ userId: identity.userId })
        const intent = createDvnetTopUpIntent({
          userId: identity.userId,
          storeUuid: options.accountDvnetBilling.storeUuid,
          paymentBaseUrl: options.accountDvnetBilling.paymentBaseUrl,
          clientId: storedIntent.id,
        })
        return Response.json({
          ...intent,
          billing: {
            ...billing,
            topUp: {
              enabled: true,
              provider: 'dv.net',
              url: intent.redirectUrl,
            },
          },
        })
      }
      return Response.json(createDisabledTopUpIntent(identity))
    }

    if (path === '/api/webhooks/dvnet' && req.method === 'POST') {
      if (!options.accountDvnetBilling || !options.accountUsageLedger) {
        return Response.json({ error: 'DV.net billing is not configured' }, { status: 503 })
      }
      const contentLength = Number(req.headers.get('content-length') ?? 0)
      if (Number.isFinite(contentLength) && contentLength > DVNET_WEBHOOK_MAX_BYTES) {
        return Response.json({ error: 'DV.net webhook body is too large' }, { status: 413 })
      }

      try {
        await processDvnetWebhook({
          rawBody: await req.text(),
          signature: req.headers.get('x-sign'),
          webhookSecret: options.accountDvnetBilling.webhookSecret,
          ledger: options.accountUsageLedger,
          intents: dvnetBillingIntentStore,
        })
        return Response.json({ success: true })
      } catch (error) {
        if (error instanceof DvnetWebhookSignatureError) {
          return Response.json({ error: 'Invalid DV.net webhook signature' }, { status: 400 })
        }
        return Response.json({ error: error instanceof Error ? error.message : 'Invalid DV.net webhook payload' }, { status: 400 })
      }
    }

    if (path === '/api/account/events' && req.method === 'GET') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (options.accountEventHistory) {
        const events = await options.accountEventHistory.listForUser(identity.userId, { limit: 50 })
        return Response.json(createAccountCabinetEventsFromHistory(events))
      }
      return Response.json(createAccountCabinetEvents())
    }

    if (path === '/api/account/storage' && req.method === 'GET') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity

      const endpointPreference = await resolveS3EndpointPreference()
      const records = [
        createStorageBucketRecord({
          ownerType: 'user',
          ownerId: identity.userId,
          endpoint: endpointPreference.activeEndpoint,
        }),
      ]

      if (options.accountTeamStore) {
        const teams = await options.accountTeamStore.listOrganizations(identity.userId)
        for (const team of teams) {
          records.push(createStorageBucketRecord({
            ownerType: 'team',
            ownerId: team.id,
            endpoint: endpointPreference.activeEndpoint,
          }))
        }
      }

      return Response.json({
        endpointStatus: endpointPreference.status,
        activeEndpoint: endpointPreference.activeEndpoint,
        candidates: endpointPreference.candidates,
        buckets: records.map(record => toStorageStatusDto({
          record,
          endpointPreference,
          usedBytes: 0,
        })),
      })
    }

    if ((path === '/api/account/organizations' || path === '/api/account/teams') && req.method === 'GET') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (options.accountTeamStore) {
        const organizations = await options.accountTeamStore.listOrganizations(identity.userId)
        const body = createAccountCabinetOrganizationsFromTeams(organizations)
        return Response.json(path === '/api/account/teams' ? { teams: body.organizations } : body)
      }
      const empty = createAccountCabinetOrganizations()
      return Response.json(path === '/api/account/teams' ? { teams: empty.organizations } : empty)
    }

    if ((path === '/api/account/organizations' || path === '/api/account/teams') && req.method === 'POST') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (options.accountTeamStore) {
        let body: { name?: string }
        try {
          body = await req.json() as { name?: string }
        } catch {
          return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }
        try {
          await options.accountTeamStore.createOrganization({
            actorUserId: identity.userId,
            name: typeof body.name === 'string' ? body.name : '',
          })
          const organizations = await options.accountTeamStore.listOrganizations(identity.userId)
          const responseBody = createAccountCabinetOrganizationsFromTeams(organizations)
          return Response.json(path === '/api/account/teams' ? { teams: responseBody.organizations } : responseBody)
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : 'Organization creation failed' }, { status: 400 })
        }
      }
      return Response.json(
        { error: 'Organization creation is not available until team workspaces are enabled.' },
        { status: 501 },
      )
    }

    const teamSpacesMatch = path.match(/^\/api\/account\/teams\/([^/]+)\/spaces$/)
    if (teamSpacesMatch && (req.method === 'GET' || req.method === 'POST')) {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (!options.accountTeamStore) {
        return Response.json({ error: 'Team spaces are not available until team workspaces are enabled.' }, { status: 501 })
      }
      const teamId = decodeURIComponent(teamSpacesMatch[1]!)
      try {
        if (req.method === 'POST') {
          let body: { name?: string }
          try {
            body = await req.json() as { name?: string }
          } catch {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }
          await options.accountTeamStore.createSpace({
            actorUserId: identity.userId,
            organizationId: teamId,
            name: typeof body.name === 'string' ? body.name : '',
          })
          const spaces = await options.accountTeamStore.listSpaces({ actorUserId: identity.userId, organizationId: teamId })
          return Response.json({ spaces }, { status: 201 })
        }
        return Response.json({
          spaces: await options.accountTeamStore.listSpaces({ actorUserId: identity.userId, organizationId: teamId }),
        })
      } catch (error) {
        if (error instanceof AccountTeamForbiddenError) {
          return Response.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof AccountTeamInviteError) {
          return Response.json({ error: error.message }, { status: 404 })
        }
        return Response.json({ error: error instanceof Error ? error.message : 'Team space action failed' }, { status: 400 })
      }
    }

    const teamInvitesMatch = path.match(/^\/api\/account\/teams\/([^/]+)\/invites$/)
    if (teamInvitesMatch && req.method === 'POST') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (!options.accountTeamStore) {
        return Response.json({ error: 'Team invites are not available until team workspaces are enabled.' }, { status: 501 })
      }
      let body: { role?: 'admin' | 'member' | 'viewer' }
      try {
        body = await req.json() as { role?: 'admin' | 'member' | 'viewer' }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }
      try {
        const invite = await options.accountTeamStore.createInvite({
          actorUserId: identity.userId,
          organizationId: decodeURIComponent(teamInvitesMatch[1]!),
          role: body.role,
        })
        return Response.json({ invite }, { status: 201 })
      } catch (error) {
        if (error instanceof AccountTeamForbiddenError) {
          return Response.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof AccountTeamInviteError) {
          return Response.json({ error: error.message }, { status: 404 })
        }
        throw error
      }
    }

    const inviteAcceptMatch = path.match(/^\/api\/account\/invites\/([^/]+)\/accept$/)
    if (inviteAcceptMatch && req.method === 'POST') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (!options.accountTeamStore) {
        return Response.json({ error: 'Team invites are not available until team workspaces are enabled.' }, { status: 501 })
      }
      try {
        await options.accountTeamStore.joinWithInvite({
          userId: identity.userId,
          code: decodeURIComponent(inviteAcceptMatch[1]!),
        })
        const organizations = await options.accountTeamStore.listOrganizations(identity.userId)
        return Response.json({ teams: createAccountCabinetOrganizationsFromTeams(organizations).organizations })
      } catch (error) {
        if (error instanceof AccountTeamForbiddenError) {
          return Response.json({ error: error.message }, { status: 403 })
        }
        if (error instanceof AccountTeamInviteError) {
          return Response.json({ error: error.message }, { status: 400 })
        }
        throw error
      }
    }

    if (path === '/api/account/organizations/join' && req.method === 'POST') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (options.accountTeamStore) {
        let body: { code?: string }
        try {
          body = await req.json() as { code?: string }
        } catch {
          return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }
        try {
          await options.accountTeamStore.joinWithInvite({
            userId: identity.userId,
            code: typeof body.code === 'string' ? body.code : '',
          })
          const organizations = await options.accountTeamStore.listOrganizations(identity.userId)
          return Response.json(createAccountCabinetOrganizationsFromTeams(organizations))
        } catch (error) {
          if (error instanceof AccountTeamForbiddenError) {
            return Response.json({ error: error.message }, { status: 403 })
          }
          if (error instanceof AccountTeamInviteError) {
            return Response.json({ error: error.message }, { status: 400 })
          }
          throw error
        }
      }
      return Response.json(
        { error: 'Organization join is not available until team workspaces are enabled.' },
        { status: 501 },
      )
    }

    if (path === '/api/account/workspaces' && req.method === 'GET') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (!options.accountCloudWorkspaceStore) {
        return Response.json({ workspaces: [] })
      }
      return Response.json({
        workspaces: await options.accountCloudWorkspaceStore.listWorkspaces(identity.userId),
      })
    }

    if (path === '/api/account/workspaces' && req.method === 'POST') {
      const identity = await requireAccountSession(req)
      if (identity instanceof Response) return identity
      if (!options.accountCloudWorkspaceStore) {
        return Response.json(
          { error: 'Managed cloud workspaces are not configured.' },
          { status: 501 },
        )
      }

      let body: { name?: string }
      try {
        body = await req.json() as { name?: string }
      } catch {
        return Response.json({ error: 'Invalid request body' }, { status: 400 })
      }

      try {
        const workspace = await options.accountCloudWorkspaceStore.createWorkspace({
          ownerUserId: identity.userId,
          name: typeof body.name === 'string' ? body.name : '',
        })
        await accountStore!.grantWorkspaceOwner(identity.userId, workspace.id)
        return Response.json({ workspace }, { status: 201 })
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Workspace creation failed' }, { status: 400 })
      }
    }

    if (path === '/api/account/sessions/revoke-all' && req.method === 'POST') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session || session.kind !== 'account') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      await accountStore.revokeOtherSessions(session.identity.userId, session.identity.sessionId)
      return Response.json({ ok: true })
    }

    if (path.startsWith('/api/account/sessions/') && req.method === 'DELETE') {
      if (!accountStore) {
        return Response.json({ error: 'Account auth is not configured' }, { status: 503 })
      }
      const session = await validateWebuiSession(req.headers.get('cookie'))
      if (!session || session.kind !== 'account') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const sessionId = decodeURIComponent(path.slice('/api/account/sessions/'.length))
      const sessions = await accountStore.listSessions(session.identity.userId)
      if (!sessions.some(item => item.id === sessionId)) {
        return Response.json({ error: 'Session not found' }, { status: 404 })
      }
      await accountStore.revokeSession(sessionId)
      const headers = new Headers()
      if (sessionId === session.identity.sessionId) {
        headers.set('Set-Cookie', buildLogoutCookie(useSecureCookies))
      }
      return Response.json({ ok: true }, { headers })
    }

    // ── OAuth callback (no cookie auth — state param is CSRF protection) ──
    // Receives redirect from the relay (or directly from OAuth provider for MCP sources).
    // Completes the token exchange server-side and renders a success/error page.
    if (path === '/api/oauth/callback' && req.method === 'GET' && options.oauthCallbackDeps) {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')
      const errorDescription = url.searchParams.get('error_description')

      if (error) {
        const flow = state ? options.oauthCallbackDeps.flowStore.getByState(state) : null
        if (flow && state) options.oauthCallbackDeps.flowStore.remove(state)
        const errorMsg = errorDescription || error
        logger.warn(`[webui] OAuth callback error: ${errorMsg}`)
        return new Response(generateCallbackPage({ title: 'Authorization Failed', isSuccess: false, errorDetail: errorMsg }), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      if (!code || !state) {
        return new Response(generateCallbackPage({ title: 'Authorization Failed', isSuccess: false, errorDetail: 'Missing code or state parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      try {
        const { completeOAuthFlow } = await import('../handlers/rpc/oauth')
        const result = await completeOAuthFlow({
          code,
          state,
          flowStore: options.oauthCallbackDeps.flowStore,
          credManager: options.oauthCallbackDeps.credManager as any,
          sessionManager: options.oauthCallbackDeps.sessionManager,
          pushSourcesChanged: options.oauthCallbackDeps.pushSourcesChanged,
          logger,
          // No clientId/workspaceId — HTTP callback skips ownership checks (state is auth)
        })

        if (result.success) {
          return new Response(generateCallbackPage({ title: 'Authorization Successful', isSuccess: true }), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        } else {
          return new Response(generateCallbackPage({ title: 'Authorization Failed', isSuccess: false, errorDetail: result.error }), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Token exchange failed'
        logger.error(`[webui] OAuth callback failed: ${msg}`)
        return new Response(generateCallbackPage({ title: 'Authorization Failed', isSuccess: false, errorDetail: msg }), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
    }

    // ── Config endpoint (requires session cookie) ──
    if (path === '/api/config' && req.method === 'GET') {
      const configSession = await validateWebuiSession(req.headers.get('cookie'))
      if (!configSession) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return Response.json({
        wsUrl: resolveWebSocketUrl(req, { publicWsUrl, wsProtocol, wsPort }),
        authMode: accountAuthEnabled ? 'account' : 'legacy',
      })
    }

    // Return the default workspace ID so the webui can include it in the WS handshake
    if (path === '/api/config/workspaces' && req.method === 'GET') {
      const configSession = await validateWebuiSession(req.headers.get('cookie'))
      if (!configSession) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { getActiveWorkspace } = await import('@rox-agent/shared/config/storage')
      const { getWorkspaces } = await import('@rox-agent/shared/config/storage')
      const active = getActiveWorkspace()
      if (configSession.kind === 'account' && accountStore) {
        const ownedIds = new Set(await accountStore.listWorkspaceIds(configSession.identity.userId))
        if (active && ownedIds.has(active.id)) {
          return Response.json({ defaultWorkspaceId: active.id })
        }
        const firstOwned = getWorkspaces().find(workspace => ownedIds.has(workspace.id))
        return Response.json({ defaultWorkspaceId: firstOwned?.id ?? null })
      }
      return Response.json({
        defaultWorkspaceId: active?.id ?? null,
      })
    }

    // ── Everything below requires a valid session cookie ──
    const cookieHeader = req.headers.get('cookie')
    const session = await validateWebuiSession(cookieHeader)

    if (!session) {
      const accept = req.headers.get('accept') ?? ''
      if (accept.includes('text/html') || path === '/' || path === '') {
        return Response.redirect('/login', 302)
      }
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Serve SPA static files ──
    if (path !== '/') {
      const file = Bun.file(join(webuiDir, path))
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': getMimeType(path) },
        })
      }
    }

    // SPA fallback — serve index.html for all non-file routes
    const indexFile = Bun.file(join(webuiDir, 'index.html'))
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('Not Found', { status: 404 })
  }

  return {
    fetch,
    dispose: () => clearInterval(cleanupTimer),
    setOAuthCallbackDeps: (deps: OAuthCallbackDeps) => {
      options.oauthCallbackDeps = deps
    },
  }
}

// ---------------------------------------------------------------------------
// Standalone server (backwards-compatible, uses Bun.serve)
// ---------------------------------------------------------------------------

export interface WebuiHttpServerOptions extends WebuiHandlerOptions {
  /** Port to bind on. Use 0 for an ephemeral port in tests. */
  port: number
}

export async function startWebuiHttpServer(
  options: WebuiHttpServerOptions,
): Promise<{ port: number, stop: () => void }> {
  const { port, logger, ...handlerOpts } = options
  const handler = createWebuiHandler({ ...handlerOpts, logger })

  const server = Bun.serve({
    port,
    fetch: handler.fetch,
  })

  const boundPort = server.port ?? port
  logger.info(`[webui] Web UI server listening on http://0.0.0.0:${boundPort}`)

  return {
    port: boundPort,
    stop: () => {
      handler.dispose()
      server.stop()
    },
  }
}
