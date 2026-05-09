/**
 * Web UI session authentication.
 *
 * Cookie-based JWT session auth for the browser-served web UI.
 * - Login: verify password → issue signed JWT → set HttpOnly cookie
 * - Validation: check cookie on every HTTP request + WebSocket upgrade
 * - Rate limiting: per-IP brute-force protection on /api/auth
 *
 * **Slice 4 hardening (2026-05):** the cookie's lifetime was tightened from a
 * single 24h JWT to a 1h JWT envelope wrapping a server-controlled DB session
 * id. The DB session id rotates on a sliding window (default 15 min) so a
 * stolen cookie ages out even when the legitimate user is active. The JWT
 * itself never carries a long-lived bearer secret — only the rotated session
 * id and the user's identity claims, both verifiable against the store.
 */

import { SignJWT, jwtVerify } from 'jose'
import type { AccountStore, SessionIdentity } from '../accounts'

// ---------------------------------------------------------------------------
// JWT helpers (via jose library)
// ---------------------------------------------------------------------------

/**
 * Lifetime of the signed cookie envelope. Rotation is triggered well inside
 * this window (see `ACCOUNT_SESSION_ROTATION_WINDOW_MS`) so the cookie is
 * normally refreshed before it expires; this value is the hard upper bound
 * on bearer reuse for an idle session.
 */
export const ACCOUNT_SESSION_TTL_SECONDS = 60 * 60 // 1 hour

/** @deprecated Internal alias retained while existing call sites migrate. */
const JWT_EXPIRY_SECONDS = ACCOUNT_SESSION_TTL_SECONDS

/**
 * Sliding-window threshold above which the underlying DB session id is
 * rotated on the next authenticated request. Keep ≤ TTL/2 so rotation always
 * runs before the cookie expires.
 */
export const ACCOUNT_SESSION_ROTATION_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
  sid?: string
  email?: string
  role?: string
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret)
  const { iat, exp, ...claims } = payload
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(key)
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    return {
      sub: payload.sub as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
      sid: typeof payload.sid === 'string' ? payload.sid : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
    }
  } catch {
    return null
  }
}

export async function createSessionToken(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signJwt({ sub: 'webui', iat: now, exp: now + JWT_EXPIRY_SECONDS }, secret)
}

export async function createAccountSessionToken(secret: string, identity: SessionIdentity): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signJwt({
    sub: identity.userId,
    sid: identity.sessionId,
    email: identity.email,
    role: identity.role,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  }, secret)
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = 'rox_session'

export function buildSessionCookie(jwt: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${jwt}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${JWT_EXPIRY_SECONDS}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildLogoutCookie(secure = false): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function extractSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.trim().split('=')
    if (name === SESSION_COOKIE_NAME) return rest.join('=')
  }
  return null
}

// ---------------------------------------------------------------------------
// Password verification (argon2id via Bun.password)
// ---------------------------------------------------------------------------

let hashedPassword: string | null = null

/**
 * Hash the login password at startup. Must be called before any auth requests.
 * The hash is stored in memory — the raw password is not retained.
 */
export async function initPasswordHash(plaintext: string): Promise<void> {
  hashedPassword = await Bun.password.hash(plaintext, { algorithm: 'argon2id' })
}

/**
 * Verify a user-supplied password against the pre-hashed password.
 * Uses Bun's built-in argon2id verification (constant-time).
 */
export async function verifyPassword(input: string): Promise<boolean> {
  if (!hashedPassword) return false
  return Bun.password.verify(input, hashedPassword)
}

// ---------------------------------------------------------------------------
// Rate limiter (per-IP + global, sliding window)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  attempts: number
  windowStart: number
}

export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>()
  private readonly maxAttempts: number
  private readonly windowMs: number
  /** Global counter — blocks all IPs after too many total failures (defeats IP spoofing). */
  private readonly maxGlobalAttempts: number
  private globalAttempts = 0
  private globalWindowStart = Date.now()

  constructor(maxAttempts = 5, windowMs = 60_000, maxGlobalAttempts = 20) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
    this.maxGlobalAttempts = maxGlobalAttempts
  }

  /** Returns true if the request should be allowed, false if rate-limited. */
  check(ip: string): boolean {
    const now = Date.now()

    // Reset global window if expired
    if (now - this.globalWindowStart > this.windowMs) {
      this.globalAttempts = 0
      this.globalWindowStart = now
    }

    // Global rate limit — blocks everyone if too many total attempts
    this.globalAttempts++
    if (this.globalAttempts > this.maxGlobalAttempts) return false

    // Per-IP rate limit
    const entry = this.entries.get(ip)

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.entries.set(ip, { attempts: 1, windowStart: now })
      return true
    }

    entry.attempts++
    if (entry.attempts > this.maxAttempts) return false
    return true
  }

  /** Periodic cleanup of stale entries (call on a timer). */
  cleanup(): void {
    const now = Date.now()
    for (const [ip, entry] of this.entries) {
      if (now - entry.windowStart > this.windowMs * 2) {
        this.entries.delete(ip)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Session validator (used by both HTTP and WebSocket)
// ---------------------------------------------------------------------------

export async function validateSession(
  cookieHeader: string | null,
  secret: string,
): Promise<JwtPayload | null> {
  const token = extractSessionCookie(cookieHeader)
  if (!token) return null
  return verifyJwt(token, secret)
}

export async function validateAccountSession(
  cookieHeader: string | null,
  secret: string,
  accountStore: AccountStore,
): Promise<SessionIdentity | null> {
  const payload = await validateSession(cookieHeader, secret)
  if (!payload?.sub || !payload.sid) return null

  const identity = await accountStore.getSessionIdentity(payload.sid)
  if (!identity) return null
  if (identity.userId !== payload.sub) return null
  return identity
}

// ---------------------------------------------------------------------------
// Sliding-window session-id rotation (Slice 4 hardening)
// ---------------------------------------------------------------------------

/**
 * Input for {@link rotateAccountSessionIfStale}.
 *
 * @property identity - The currently-validated session identity for the request.
 * @property accountStore - The store that owns DB session lifecycle.
 * @property secret - HMAC secret used to sign the new JWT envelope.
 * @property secure - Whether to set the `Secure` cookie attribute (TLS only).
 * @property userAgent - User agent recorded against the freshly-minted session.
 * @property ipAddress - Client IP recorded against the freshly-minted session.
 * @property nowMs - Optional clock injection for tests; defaults to `Date.now()`.
 * @property rotationWindowMs - Optional override of the rotation threshold.
 */
export interface RotateAccountSessionInput {
  identity: SessionIdentity
  accountStore: AccountStore
  secret: string
  secure: boolean
  userAgent: string | null
  ipAddress: string | null
  nowMs?: number
  rotationWindowMs?: number
}

/**
 * Output of {@link rotateAccountSessionIfStale} when rotation occurred.
 *
 * @property identity - The rotated identity, carrying the new session id.
 * @property cookie - A `Set-Cookie` value the caller should attach to the response.
 * @property previousSessionId - The id that was just revoked (logged, never echoed to clients).
 */
export interface RotatedAccountSession {
  identity: SessionIdentity
  cookie: string
  previousSessionId: string
}

/**
 * Rotate the underlying DB session id if it is older than the rotation window.
 *
 * Slice 4 hardening: a stolen cookie should not remain valid for the full
 * cookie TTL when the user is actively using the app. On every authenticated
 * request, the caller asks this helper whether to rotate. If the existing
 * session is younger than `rotationWindowMs`, the helper returns `null` and
 * nothing changes. Otherwise it revokes the old session, mints a fresh DB
 * session, and returns a new identity + `Set-Cookie` value.
 *
 * The cookie is regenerated via {@link buildSessionCookie} so it inherits
 * `HttpOnly`, `SameSite=Strict`, `Path=/`, and the (configurable) `Secure`
 * flag. The bearer envelope continues to be a short-lived signed JWT carrying
 * only server-controlled identifiers — never raw secret material.
 *
 * Atomic rotation (Slice 4 hardening, finding #1): {@link AccountStore.revokeSession}
 * is a compare-and-swap that returns `revoked: true` only on the call that
 * transitions the row from active to revoked. We invoke `revokeSession` before
 * `createSession` and bail out (returning `null`) whenever the CAS reports the
 * row was already revoked or absent. Concurrent rotators therefore see at most
 * one successful CAS per source session — preventing the orphaned-session
 * pile-up that the previous read-then-write ordering allowed under React
 * StrictMode + concurrent `/api/account/me` fetches.
 */
export async function rotateAccountSessionIfStale(
  input: RotateAccountSessionInput,
): Promise<RotatedAccountSession | null> {
  const now = input.nowMs ?? Date.now()
  const window = input.rotationWindowMs ?? ACCOUNT_SESSION_ROTATION_WINDOW_MS

  // Re-resolve the session through the store so a concurrent revoke wins.
  const current = await input.accountStore.getSessionIdentity(input.identity.sessionId)
  if (!current) return null

  const sessions = await input.accountStore.listSessions(current.userId)
  const session = sessions.find(candidate => candidate.id === current.sessionId)
  // If the session is too new to rotate, or has gone missing from the active
  // list (e.g. revoked between calls), do nothing.
  if (!session) return null

  const ageMs = now - new Date(session.createdAt).getTime()
  if (ageMs < window) return null

  // Compare-and-swap revoke FIRST. Only the caller that flips the row from
  // active to revoked proceeds to mint a replacement. All other concurrent
  // rotators see `revoked: false` and bail out without leaving an orphan.
  const previousSessionId = current.sessionId
  const revokeOutcome = await input.accountStore.revokeSession(previousSessionId)
  if (!revokeOutcome.revoked) return null

  const fresh = await input.accountStore.createSession({
    userId: current.userId,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    authMethod: session.authMethod ?? 'password',
  })

  const rotatedIdentity: SessionIdentity = {
    userId: current.userId,
    sessionId: fresh.id,
    email: current.email,
    displayName: current.displayName,
    role: current.role,
  }

  const jwt = await createAccountSessionToken(input.secret, rotatedIdentity)
  const cookie = buildSessionCookie(jwt, input.secure)

  return { identity: rotatedIdentity, cookie, previousSessionId }
}
