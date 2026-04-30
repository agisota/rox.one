#!/usr/bin/env node
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const require = createRequire(import.meta.url)
const PORT = Number(process.env.ROX_AUTH_PORT || 9100)
const HOST = process.env.ROX_AUTH_HOST || '127.0.0.1'
const PUBLIC_URL = (process.env.ROX_AUTH_PUBLIC_URL || 'https://rox.one').replace(/\/$/, '')
const DATABASE_URL = process.env.ROX_AUTH_DATABASE_URL || process.env.ROX_DATABASE_URL || process.env.DATABASE_URL || ''
const DB_PATH = process.env.ROX_AUTH_DB || '/srv/rox-one/auth/rox-auth.sqlite'
const LOGIN_HTML = process.env.ROX_AUTH_LOGIN_HTML || '/srv/rox-one/webui-dist/login.html'
const WEBUI_DIR = process.env.ROX_AUTH_WEBUI_DIR || dirname(LOGIN_HTML)
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.ROX_AUTH_EMAIL_FROM || 'ROX ONE <noreply@rox.one>'
const ALLOW_EMAIL_LOG_FALLBACK = process.env.ROX_AUTH_ALLOW_EMAIL_LOG_FALLBACK === '1'
const CONFIGURED_JWT_SECRET = process.env.ROX_AUTH_JWT_SECRET || process.env.ROX_AUTH_JWT_SECRET || process.env.ROX_SERVER_TOKEN || process.env.ROX_AUTH_SECRET || ''
if (!CONFIGURED_JWT_SECRET && process.env.ROX_AUTH_ALLOW_EPHEMERAL_JWT_SECRET !== '1') {
  console.error('[rox-auth] ROX_AUTH_JWT_SECRET is required. Set ROX_AUTH_ALLOW_EPHEMERAL_JWT_SECRET=1 only for local throwaway development.')
  process.exit(1)
}
const JWT_SECRET = CONFIGURED_JWT_SECRET || randomBytes(32).toString('hex')
const WS_URL = process.env.ROX_AUTH_WS_URL || process.env.ROX_WEBUI_WS_URL || 'wss://rox.one/ws'
const BILLING_CURRENCY = process.env.ROX_BILLING_CURRENCY || 'USDT'
const BILLING_INITIAL_BALANCE_UNITS = Number(process.env.ROX_BILLING_INITIAL_BALANCE_UNITS || 0)
const BILLING_TOP_UP_URL = (process.env.ROX_BILLING_TOP_UP_URL || '').trim()
const S3_ENDPOINT_CANDIDATES = (process.env.ROX_S3_ENDPOINTS || 'http://s3.max:9000,http://s3.rox:9000')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
const TRUST_FORWARDED_HEADERS = process.env.ROX_AUTH_TRUST_FORWARDED_HEADERS === '1' || process.env.ROX_TRUST_FORWARDED_HEADERS === '1'
const TRUSTED_PROXIES = parseTrustedProxyEnv(process.env.ROX_AUTH_TRUSTED_PROXIES || process.env.ROX_WEBUI_TRUSTED_PROXIES || process.env.ROX_TRUSTED_PROXIES || '')
const SESSION_COOKIE = '__Host-rox_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const PRODUCT_SHELL_PATHS = ['/settings', '/workspace/', '/session/']
const DESKTOP_AUTH_SCHEMES = new Set(
  (process.env.ROX_AUTH_DESKTOP_SCHEMES || 'rox,roxpreview,roxdev,roxlocal,roxoss,roxintegration')
    .split(',')
    .map((scheme) => scheme.trim().toLowerCase())
    .filter(Boolean),
)
const DESKTOP_AUTH_STATE_RE = /^[A-Za-z0-9._~:-]{8,256}$/
const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}
const rateBuckets = new Map()
const db = await openAuthDatabase()

function nowIso() {
  return new Date().toISOString()
}

function futureIso(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function id(prefix) {
  return `${prefix}_${randomBytes(16).toString('hex')}`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signJwtPayload(encodedHeader, encodedPayload) {
  return createHmac('sha256', JWT_SECRET).update(`${encodedHeader}.${encodedPayload}`).digest('base64url')
}

function createSessionJwt(payload) {
  const encodedHeader = base64UrlJson({ alg: 'HS256', typ: 'JWT' })
  const encodedPayload = base64UrlJson(payload)
  return `${encodedHeader}.${encodedPayload}.${signJwtPayload(encodedHeader, encodedPayload)}`
}

function verifySessionJwt(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, signature] = parts
  const expected = signJwtPayload(encodedHeader, encodedPayload)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch (error) {
    return null
  }
  if (!payload?.sid || !payload?.sub || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null
  return payload
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [, salt, expectedHex] = String(stored || '').split(':')
  if (!salt || !expectedHex) return false
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || '',
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
    emailVerifiedAt: row.verified_at || null,
    verifiedAt: row.verified_at || null,
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatRuDate(value) {
  if (!value) return 'никогда'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function publicSession(row) {
  return {
    id: row.id,
    userAgent: row.userAgent ?? row.useragent ?? row.user_agent ?? null,
    ipAddress: row.ipAddress ?? row.ipaddress ?? row.ip_address ?? null,
    authMethod: row.authMethod ?? row.authmethod ?? row.auth_method ?? 'password',
    createdAt: row.createdAt ?? row.createdat ?? row.created_at,
    expiresAt: row.expiresAt ?? row.expiresat ?? row.expires_at,
    revokedAt: row.revokedAt ?? row.revokedat ?? row.revoked_at ?? null,
  }
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(JSON.stringify(body))
}

function html(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(body)
}

function text(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...extraHeaders })
  res.end()
}

function extension(pathname) {
  const index = pathname.lastIndexOf('.')
  return index === -1 ? '' : pathname.slice(index)
}

function staticPathFor(pathname) {
  if (pathname.includes('..')) return null
  if (pathname === '/' || pathname === '/index.html') return join(WEBUI_DIR, 'index.html')
  if (pathname === '/login') return LOGIN_HTML
  if (pathname.startsWith('/assets/') || pathname === '/favicon.ico' || pathname === '/manifest.json' || pathname === '/apple-touch-icon.png' || /^\/icon-\d+\.png$/.test(pathname)) {
    return join(WEBUI_DIR, pathname.slice(1))
  }
  return null
}

function serveStatic(res, pathname) {
  const filePath = staticPathFor(pathname)
  if (!filePath || !existsSync(filePath)) return false
  const type = STATIC_TYPES[extension(filePath)] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type, 'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store' })
  res.end(readFileSync(filePath))
  return true
}

function isProductShellPath(pathname) {
  return PRODUCT_SHELL_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

function isAccountDashboardPath(pathname) {
  return pathname === '/account' || pathname === '/account/'
}

function normalizeIp(value) {
  let ip = String(value || '').trim()
  if (!ip) return ''
  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length)
  if (ip === '::1') return '127.0.0.1'
  return ip
}

function isLoopbackIp(value) {
  const ip = normalizeIp(value)
  return ip === '127.0.0.1' || ip.startsWith('127.')
}

function parseTrustedProxyEnv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter(Boolean)
}

function toPostgresSql(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

async function loadPgPool() {
  const pgModule = await import('pg').catch(() => require('pg'))
  const Pool = pgModule.Pool || pgModule.default?.Pool
  if (!Pool) throw new Error('Postgres driver pg is not available')
  return Pool
}

function sqliteStore() {
  mkdirSync(dirname(DB_PATH), { recursive: true })
  const sqlite = new DatabaseSync(DB_PATH)
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS rox_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_email_verification',
      role TEXT NOT NULL DEFAULT 'user',
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS rox_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES rox_users(id)
    );
    CREATE INDEX IF NOT EXISTS rox_sessions_user_idx ON rox_sessions(user_id);
    CREATE INDEX IF NOT EXISTS rox_sessions_token_idx ON rox_sessions(token_hash);
    CREATE TABLE IF NOT EXISTS rox_email_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES rox_users(id)
    );
    CREATE INDEX IF NOT EXISTS rox_email_tokens_lookup_idx ON rox_email_tokens(purpose, token_hash, expires_at);
    CREATE TABLE IF NOT EXISTS rox_account_balances (
      user_id TEXT PRIMARY KEY,
      balance_units INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USDT',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES rox_users(id)
    );
    CREATE TABLE IF NOT EXISTS rox_account_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES rox_users(id)
    );
    CREATE INDEX IF NOT EXISTS rox_account_events_user_idx ON rox_account_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS rox_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(owner_user_id) REFERENCES rox_users(id)
    );
    CREATE TABLE IF NOT EXISTS rox_organization_members (
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      PRIMARY KEY (organization_id, user_id),
      FOREIGN KEY(organization_id) REFERENCES rox_organizations(id),
      FOREIGN KEY(user_id) REFERENCES rox_users(id)
    );
    CREATE TABLE IF NOT EXISTS rox_team_spaces (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      storage_prefix TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES rox_organizations(id),
      FOREIGN KEY(created_by_user_id) REFERENCES rox_users(id)
    );
    CREATE INDEX IF NOT EXISTS rox_team_spaces_org_idx ON rox_team_spaces(organization_id, created_at);
    CREATE TABLE IF NOT EXISTS rox_team_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'member',
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT,
      consumed_by_user_id TEXT,
      FOREIGN KEY(organization_id) REFERENCES rox_organizations(id),
      FOREIGN KEY(created_by_user_id) REFERENCES rox_users(id),
      FOREIGN KEY(consumed_by_user_id) REFERENCES rox_users(id)
    );
    CREATE INDEX IF NOT EXISTS rox_team_invites_code_idx ON rox_team_invites(code, consumed_at);
    CREATE TABLE IF NOT EXISTS rox_storage_buckets (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      prefix TEXT NOT NULL,
      quota_bytes INTEGER NOT NULL DEFAULT 0,
      endpoint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_type, owner_id)
    );
  `)
  return {
    backend: 'sqlite',
    async run(sql, ...params) {
      return sqlite.prepare(sql).run(...params)
    },
    async get(sql, ...params) {
      return sqlite.prepare(sql).get(...params)
    },
    async all(sql, ...params) {
      return sqlite.prepare(sql).all(...params)
    },
  }
}

async function postgresStore(connectionString) {
  const Pool = await loadPgPool()
  const pool = new Pool({ connectionString, max: Number(process.env.ROX_AUTH_DB_POOL_MAX || 10) })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rox_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_email_verification',
      role TEXT NOT NULL DEFAULT 'user',
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS rox_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS rox_sessions_user_idx ON rox_sessions(user_id);
    CREATE INDEX IF NOT EXISTS rox_sessions_token_idx ON rox_sessions(token_hash);
    CREATE TABLE IF NOT EXISTS rox_email_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS rox_email_tokens_lookup_idx ON rox_email_tokens(purpose, token_hash, expires_at);
    CREATE TABLE IF NOT EXISTS rox_account_balances (
      user_id TEXT PRIMARY KEY REFERENCES rox_users(id) ON DELETE CASCADE,
      balance_units INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USDT',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rox_account_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rox_account_events_user_idx ON rox_account_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS rox_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rox_organization_members (
      organization_id TEXT NOT NULL REFERENCES rox_organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      PRIMARY KEY (organization_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS rox_team_spaces (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES rox_organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      storage_prefix TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rox_team_spaces_org_idx ON rox_team_spaces(organization_id, created_at);
    CREATE TABLE IF NOT EXISTS rox_team_invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES rox_organizations(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'member',
      created_by_user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      consumed_at TEXT,
      consumed_by_user_id TEXT REFERENCES rox_users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS rox_team_invites_code_idx ON rox_team_invites(code, consumed_at);
    CREATE TABLE IF NOT EXISTS rox_storage_buckets (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      prefix TEXT NOT NULL,
      quota_bytes INTEGER NOT NULL DEFAULT 0,
      endpoint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_type, owner_id)
    );
  `)
  return {
    backend: 'postgres',
    async run(sql, ...params) {
      return pool.query(toPostgresSql(sql), params)
    },
    async get(sql, ...params) {
      const result = await pool.query(toPostgresSql(sql), params)
      return result.rows[0] || null
    },
    async all(sql, ...params) {
      const result = await pool.query(toPostgresSql(sql), params)
      return result.rows
    },
  }
}

async function openAuthDatabase() {
  if (DATABASE_URL) {
    const store = await postgresStore(DATABASE_URL)
    console.log('[rox-auth] database backend: postgres')
    return store
  }
  const store = sqliteStore()
  console.log('[rox-auth] database backend: sqlite')
  return store
}

function isTrustedProxyPeer(peerIp) {
  const ip = normalizeIp(peerIp)
  if (!ip) return false
  if (TRUSTED_PROXIES.includes('*')) return true
  if (TRUSTED_PROXIES.includes(ip)) return true
  return TRUSTED_PROXIES.includes('loopback') && isLoopbackIp(ip)
}

function shouldTrustForwardedHeaders(req) {
  if (!TRUST_FORWARDED_HEADERS) return false
  return isTrustedProxyPeer(req.socket.remoteAddress)
}

function clientIp(req) {
  if (shouldTrustForwardedHeaders(req)) {
    const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']
    if (forwarded) return normalizeIp(String(forwarded).split(',')[0])
  }
  return normalizeIp(req.socket.remoteAddress)
}

function checkRateLimit(req, res, name, subject, limit, windowSeconds) {
  const bucketKey = `${name}:${subject || clientIp(req)}`
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const bucket = rateBuckets.get(bucketKey) || []
  const recent = bucket.filter((time) => now - time < windowMs)
  if (recent.length >= limit) {
    rateBuckets.set(bucketKey, recent)
    json(res, 429, { error: { message: 'Слишком много попыток. Повторите позже.' } })
    return false
  }
  recent.push(now)
  rateBuckets.set(bucketKey, recent)
  return true
}

async function readJson(req) {
  const raw = await readBodyText(req)
  if (!raw) return {}
  return JSON.parse(raw)
}

async function readBodyText(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) {
      const error = new Error('Request body too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return ''
  return Buffer.concat(chunks).toString('utf8')
}

async function readForm(req) {
  const raw = await readBodyText(req)
  return new URLSearchParams(raw || '')
}

function getCookie(req, name) {
  const cookie = req.headers.cookie || ''
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return ''
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=${SESSION_TTL_SECONDS}`
}

function logoutCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=0`
}

async function createSession(user, req) {
  const sessionId = id('sess')
  const expiresAt = futureIso(SESSION_TTL_SECONDS)
  const now = Math.floor(Date.now() / 1000)
  const token = createSessionJwt({
    sub: user.id,
    sid: sessionId,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  })
  await db.run(`
    INSERT INTO rox_sessions (id, user_id, token_hash, user_agent, ip_address, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    sessionId,
    user.id,
    sha256(token),
    req.headers['user-agent'] || '',
    clientIp(req),
    nowIso(),
    expiresAt,
  )
  await recordAccountEvent(user.id, 'account.session_created', 'Вход в аккаунт', {
    sessionId,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'] || '',
  })
  return token
}

function createAccessToken(user, sessionId) {
  const now = Math.floor(Date.now() / 1000)
  return createSessionJwt({
    typ: 'rox_access',
    iss: PUBLIC_URL,
    aud: 'rox-desktop',
    sub: user.id,
    sid: sessionId,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  })
}

async function sessionFromToken(token) {
  const jwt = verifySessionJwt(token)
  if (!jwt) return null
  const row = await db.get(`
    SELECT s.id AS session_id, s.expires_at, u.*
    FROM rox_sessions s
    JOIN rox_users u ON u.id = s.user_id
    WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
  `, jwt.sid, nowIso())
  if (!row) return null
  if (jwt.sub !== row.id) return null
  return row
}

async function currentSession(req) {
  const token = getCookie(req, SESSION_COOKIE)
  if (!token) return null
  const jwt = verifySessionJwt(token)
  if (!jwt) return null
  const row = await db.get(`
    SELECT s.id AS session_id, s.expires_at, u.*
    FROM rox_sessions s
    JOIN rox_users u ON u.id = s.user_id
    WHERE s.id = ? AND s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
  `, jwt.sid, sha256(token), nowIso())
  return row || null
}

async function bearerSession(req) {
  const header = String(req.headers.authorization || '')
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  return sessionFromToken(match[1])
}

async function requireSession(req, res) {
  const session = await currentSession(req)
  if (!session) {
    json(res, 401, { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } })
    return null
  }
  return session
}

async function accountBalance(userId) {
  const existing = await db.get('SELECT user_id, balance_units, currency, updated_at FROM rox_account_balances WHERE user_id = ?', userId)
  if (existing) {
    return {
      userId: existing.user_id,
      balanceUnits: Number(existing.balance_units || 0),
      currency: existing.currency || BILLING_CURRENCY,
      updatedAt: existing.updated_at || null,
    }
  }

  const now = nowIso()
  const initialBalance = Number.isFinite(BILLING_INITIAL_BALANCE_UNITS) ? BILLING_INITIAL_BALANCE_UNITS : 0
  try {
    await db.run(`
      INSERT INTO rox_account_balances (user_id, balance_units, currency, updated_at)
      VALUES (?, ?, ?, ?)
    `, userId, initialBalance, BILLING_CURRENCY, now)
  } catch (error) {
    const afterRace = await db.get('SELECT user_id, balance_units, currency, updated_at FROM rox_account_balances WHERE user_id = ?', userId)
    if (afterRace) {
      return {
        userId: afterRace.user_id,
        balanceUnits: Number(afterRace.balance_units || 0),
        currency: afterRace.currency || BILLING_CURRENCY,
        updatedAt: afterRace.updated_at || null,
      }
    }
    throw error
  }

  return {
    userId,
    balanceUnits: initialBalance,
    currency: BILLING_CURRENCY,
    updatedAt: now,
  }
}

function billingOverview(balance) {
  return {
    balance,
    topUp: {
      enabled: Boolean(BILLING_TOP_UP_URL),
      provider: BILLING_TOP_UP_URL ? 'external' : 'not_configured',
      url: BILLING_TOP_UP_URL || null,
    },
  }
}

function parseDetails(value) {
  if (!value) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function publicAccountEvent(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    details: parseDetails(row.details),
    createdAt: row.created_at || row.createdat,
  }
}

async function recordAccountEvent(userId, type, title, details = null) {
  if (!userId) return
  try {
    await db.run(`
      INSERT INTO rox_account_events (id, user_id, type, title, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, id('evt'), userId, type, title, details ? JSON.stringify(details) : null, nowIso())
  } catch (error) {
    console.warn('[rox-auth] failed to record account event:', error?.message || error)
  }
}

async function accountEvents(userId) {
  return (await db.all(`
    SELECT id, type, title, details, created_at
    FROM rox_account_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `, userId)).map(publicAccountEvent)
}

function organizationSlug(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || `team-${randomUUID().slice(0, 8)}`
}

function publicOrganization(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role || 'member',
    status: row.status || 'active',
    createdAt: row.created_at || row.createdat,
    updatedAt: row.updated_at || row.updatedat,
  }
}

function publicTeamSpace(row) {
  return {
    id: row.id,
    organizationId: row.organization_id || row.organizationid,
    name: row.name,
    slug: row.slug,
    storagePrefix: row.storage_prefix || row.storageprefix,
    createdByUserId: row.created_by_user_id || row.createdbyuserid,
    createdAt: row.created_at || row.createdat,
    updatedAt: row.updated_at || row.updatedat,
  }
}

function publicTeamInvite(row) {
  return {
    id: row.id,
    organizationId: row.organization_id || row.organizationid,
    code: row.code,
    role: row.role || 'member',
    createdByUserId: row.created_by_user_id || row.createdbyuserid,
    createdAt: row.created_at || row.createdat,
    consumedAt: row.consumed_at || row.consumedat || null,
    consumedByUserId: row.consumed_by_user_id || row.consumedbyuserid || null,
  }
}

async function listOrganizations(userId) {
  return (await db.all(`
    SELECT o.id, o.name, o.slug, o.created_at, o.updated_at, m.role, m.status
    FROM rox_organizations o
    JOIN rox_organization_members m ON m.organization_id = o.id
    WHERE m.user_id = ? AND m.status = 'active'
    ORDER BY o.created_at DESC
  `, userId)).map(publicOrganization)
}

async function createOrganization(userId, name) {
  const cleanName = String(name || '').trim()
  if (cleanName.length < 2) {
    const error = new Error('Название команды должно быть не короче 2 символов.')
    error.statusCode = 400
    throw error
  }
  const createdAt = nowIso()
  const organization = {
    id: id('org'),
    name: cleanName,
    slug: `${organizationSlug(cleanName)}-${randomUUID().slice(0, 6)}`,
    owner_user_id: userId,
    created_at: createdAt,
    updated_at: createdAt,
  }
  await db.run(`
    INSERT INTO rox_organizations (id, name, slug, owner_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, organization.id, organization.name, organization.slug, organization.owner_user_id, organization.created_at, organization.updated_at)
  await db.run(`
    INSERT INTO rox_organization_members (organization_id, user_id, role, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, organization.id, userId, 'owner', 'active', createdAt)
  await recordAccountEvent(userId, 'organization.created', 'Создана команда', {
    organizationId: organization.id,
    name: organization.name,
    slug: organization.slug,
  })
  return publicOrganization({ ...organization, role: 'owner', status: 'active' })
}

async function joinOrganization(userId, code) {
  const normalized = String(code || '').trim()
  if (!normalized) {
    const error = new Error('Введите код, slug или id организации.')
    error.statusCode = 400
    throw error
  }
  const organization = await db.get(`
    SELECT id, name, slug, created_at, updated_at
    FROM rox_organizations
    WHERE id = ? OR slug = ?
  `, normalized, normalized)
  if (!organization) {
    const error = new Error('Организация не найдена. Проверьте код приглашения.')
    error.statusCode = 404
    throw error
  }
  await db.run(`
    INSERT INTO rox_organization_members (organization_id, user_id, role, status, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active'
  `, organization.id, userId, 'member', 'active', nowIso())
  await recordAccountEvent(userId, 'organization.joined', 'Пользователь присоединился к организации', {
    organizationId: organization.id,
    name: organization.name,
    slug: organization.slug,
  })
  return publicOrganization({ ...organization, role: 'member', status: 'active' })
}

async function membershipFor(userId, organizationId) {
  return db.get(`
    SELECT organization_id, user_id, role, status, created_at
    FROM rox_organization_members
    WHERE user_id = ? AND organization_id = ? AND status = 'active'
  `, userId, organizationId)
}

function canManageTeam(role) {
  return role === 'owner' || role === 'admin'
}

async function listTeamSpaces(userId, organizationId) {
  const membership = await membershipFor(userId, organizationId)
  if (!membership) {
    const error = new Error('Team membership is required')
    error.statusCode = 403
    throw error
  }
  return (await db.all(`
    SELECT id, organization_id, name, slug, storage_prefix, created_by_user_id, created_at, updated_at
    FROM rox_team_spaces
    WHERE organization_id = ?
    ORDER BY created_at DESC
  `, organizationId)).map(publicTeamSpace)
}

async function createTeamSpace(userId, organizationId, name) {
  const membership = await membershipFor(userId, organizationId)
  if (!canManageTeam(membership?.role)) {
    const error = new Error('Only owners and admins can create team spaces')
    error.statusCode = membership ? 403 : 404
    throw error
  }
  const cleanName = String(name || '').trim()
  if (cleanName.length < 2) {
    const error = new Error('Название Space должно быть не короче 2 символов.')
    error.statusCode = 400
    throw error
  }
  const createdAt = nowIso()
  const spaceId = id('space')
  const space = {
    id: spaceId,
    organization_id: organizationId,
    name: cleanName,
    slug: `${organizationSlug(cleanName)}-${randomUUID().slice(0, 6)}`,
    storage_prefix: `teams/${organizationId}/spaces/${spaceId}/`,
    created_by_user_id: userId,
    created_at: createdAt,
    updated_at: createdAt,
  }
  await db.run(`
    INSERT INTO rox_team_spaces (id, organization_id, name, slug, storage_prefix, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, space.id, space.organization_id, space.name, space.slug, space.storage_prefix, space.created_by_user_id, space.created_at, space.updated_at)
  await recordAccountEvent(userId, 'team.space_created', 'Создан team space', {
    organizationId,
    spaceId,
    name: cleanName,
  })
  return publicTeamSpace(space)
}

async function createTeamInvite(userId, organizationId, role = 'member') {
  const membership = await membershipFor(userId, organizationId)
  if (!canManageTeam(membership?.role)) {
    const error = new Error('Only owners and admins can create team invites')
    error.statusCode = membership ? 403 : 404
    throw error
  }
  const inviteRole = ['admin', 'member', 'viewer'].includes(role) ? role : 'member'
  const createdAt = nowIso()
  const invite = {
    id: id('invite'),
    organization_id: organizationId,
    code: randomBytes(18).toString('base64url'),
    role: inviteRole,
    created_by_user_id: userId,
    created_at: createdAt,
    consumed_at: null,
    consumed_by_user_id: null,
  }
  await db.run(`
    INSERT INTO rox_team_invites (id, organization_id, code, role, created_by_user_id, created_at, consumed_at, consumed_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, invite.id, invite.organization_id, invite.code, invite.role, invite.created_by_user_id, invite.created_at, null, null)
  await recordAccountEvent(userId, 'team.invite_created', 'Создан team invite', {
    organizationId,
    inviteId: invite.id,
    role: invite.role,
  })
  return publicTeamInvite(invite)
}

async function acceptTeamInvite(userId, code) {
  const normalized = String(code || '').trim()
  if (!normalized) {
    const error = new Error('Введите код приглашения.')
    error.statusCode = 400
    throw error
  }
  const invite = await db.get(`
    SELECT id, organization_id, code, role, created_by_user_id, created_at, consumed_at, consumed_by_user_id
    FROM rox_team_invites
    WHERE code = ?
  `, normalized)
  if (!invite || invite.consumed_at || invite.consumedat) {
    const error = new Error('Team invite is invalid or expired')
    error.statusCode = 400
    throw error
  }
  const now = nowIso()
  await db.run(`
    UPDATE rox_team_invites
    SET consumed_at = ?, consumed_by_user_id = ?
    WHERE code = ? AND consumed_at IS NULL
  `, now, userId, normalized)
  await db.run(`
    INSERT INTO rox_organization_members (organization_id, user_id, role, status, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = ?, status = 'active'
  `, invite.organization_id, userId, invite.role || 'member', 'active', now, invite.role || 'member')
  const organization = await db.get(`
    SELECT id, name, slug, created_at, updated_at
    FROM rox_organizations
    WHERE id = ?
  `, invite.organization_id)
  await recordAccountEvent(userId, 'team.invite_accepted', 'Принят team invite', {
    organizationId: invite.organization_id,
    inviteId: invite.id,
  })
  return publicOrganization({ ...organization, role: invite.role || 'member', status: 'active' })
}

async function ensureStorageBucket(ownerType, ownerId, endpoint) {
  const existing = await db.get(`
    SELECT id, owner_type, owner_id, bucket, prefix, quota_bytes, endpoint, created_at, updated_at
    FROM rox_storage_buckets
    WHERE owner_type = ? AND owner_id = ?
  `, ownerType, ownerId)
  if (existing) return existing
  const now = nowIso()
  const bucket = ownerType === 'team' ? `rox-team-${ownerId}` : `rox-user-${ownerId}`
  const prefix = ownerType === 'team' ? `teams/${ownerId}/` : `users/${ownerId}/`
  const record = {
    id: id('bucket'),
    owner_type: ownerType,
    owner_id: ownerId,
    bucket,
    prefix,
    quota_bytes: 0,
    endpoint,
    created_at: now,
    updated_at: now,
  }
  await db.run(`
    INSERT INTO rox_storage_buckets (id, owner_type, owner_id, bucket, prefix, quota_bytes, endpoint, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, record.id, record.owner_type, record.owner_id, record.bucket, record.prefix, record.quota_bytes, record.endpoint, record.created_at, record.updated_at)
  return record
}

async function accountStorageOverview(userId) {
  const activeEndpoint = S3_ENDPOINT_CANDIDATES[0] || 'http://s3.max:9000'
  const ownedTeams = await listOrganizations(userId)
  const records = [await ensureStorageBucket('user', userId, activeEndpoint)]
  for (const team of ownedTeams) {
    records.push(await ensureStorageBucket('team', team.id, activeEndpoint))
  }
  return {
    endpointStatus: 'configured',
    activeEndpoint,
    candidates: S3_ENDPOINT_CANDIDATES,
    buckets: records.map((record) => ({
      id: record.id,
      ownerType: record.owner_type,
      ownerId: record.owner_id,
      bucket: record.bucket,
      prefix: record.prefix,
      quotaBytes: Number(record.quota_bytes || 0),
      usedBytes: 0,
      endpoint: record.endpoint,
      status: 'ready',
    })),
  }
}

function accountDashboardHtml(session, billing, sessions) {
  const user = publicUser(session)
  const displayName = user.displayName || user.email
  const topUpEnabled = Boolean(billing.topUp.enabled && billing.topUp.url)
  const topUpControl = topUpEnabled
    ? `<a class="button primary" href="${escapeHtml(billing.topUp.url)}" target="_blank" rel="noopener">Пополнить баланс</a>`
    : '<button class="button primary" type="button" disabled>Пополнение скоро</button>'
  const sessionRows = sessions.length
    ? sessions.map((item) => `
        <tr>
          <td>${escapeHtml(item.id === session.session_id ? 'Текущая' : 'Активная')}</td>
          <td>${escapeHtml(formatRuDate(item.createdAt))}</td>
          <td>${escapeHtml(formatRuDate(item.expiresAt))}</td>
          <td>${escapeHtml(item.userAgent || 'неизвестно')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">Активных сессий не найдено.</td></tr>'

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Личный кабинет ROX ONE</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #08090d;
      --panel: #11131a;
      --panel-2: #171a22;
      --line: rgba(255,255,255,.09);
      --muted: #8f94a3;
      --text: #f4f6fb;
      --accent: #f5f5f0;
      --accent-text: #0c0d12;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 12% 10%, rgba(95, 139, 255, .14), transparent 28rem),
        radial-gradient(circle at 82% 8%, rgba(255, 214, 128, .10), transparent 22rem),
        var(--bg);
      color: var(--text);
    }
    main { width: min(1120px, calc(100vw - 40px)); margin: 0 auto; padding: 44px 0 64px; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 56px); letter-spacing: -0.055em; line-height: .92; }
    .muted { color: var(--muted); line-height: 1.55; }
    .grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 16px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025)), var(--panel);
      box-shadow: 0 22px 70px rgba(0,0,0,.32);
      padding: 24px;
    }
    .card h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: -.02em; }
    .balance { font-size: clamp(46px, 8vw, 82px); letter-spacing: -.07em; line-height: .95; margin: 14px 0 6px; }
    .pill { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; color: var(--muted); font-size: 13px; background: rgba(255,255,255,.035); }
    .rows { display: grid; gap: 10px; }
    .row { display: flex; justify-content: space-between; gap: 14px; border-top: 1px solid var(--line); padding-top: 12px; }
    .row:first-child { border-top: 0; padding-top: 0; }
    .label { color: var(--muted); }
    .value { text-align: right; overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .button {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px 14px;
      color: var(--text);
      background: var(--panel-2);
      text-decoration: none;
      font: inherit;
      cursor: pointer;
    }
    .button.primary { background: var(--accent); color: var(--accent-text); border-color: transparent; font-weight: 700; }
    .button:disabled { opacity: .48; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 12px 10px; border-top: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; border-top: 0; }
    @media (max-width: 820px) {
      main { width: min(100vw - 24px, 1120px); padding-top: 24px; }
      .top, .grid { display: block; }
      .card { margin-top: 14px; border-radius: 18px; padding: 18px; }
      .row { display: block; }
      .value { text-align: left; margin-top: 4px; }
    }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <span class="pill">ROX ONE account</span>
        <h1>Личный кабинет</h1>
        <p class="muted">Аккаунт, баланс, сессии и безопасность пользователя. Эта страница отдается сервером напрямую, поэтому не зависит от загрузки desktop WebUI shell.</p>
      </div>
      <button class="button" type="button" id="logout">Выйти</button>
    </div>

    <div class="grid">
      <section class="card">
        <h2>Баланс</h2>
        <div class="balance">${escapeHtml(billing.balance.balanceUnits)} ${escapeHtml(billing.balance.currency)}</div>
        <p class="muted">Баланс хранится в таблице <code>rox_account_balances</code>. Пополнение включится после настройки платежного провайдера.</p>
        <div class="actions">
          ${topUpControl}
          <a class="button" href="/login?tab=reset-request">Сбросить пароль</a>
        </div>
      </section>

      <section class="card">
        <h2>Профиль</h2>
        <div class="rows">
          <div class="row"><div class="label">Имя</div><div class="value">${escapeHtml(displayName)}</div></div>
          <div class="row"><div class="label">Email</div><div class="value">${escapeHtml(user.email)}</div></div>
          <div class="row"><div class="label">Роль</div><div class="value">${escapeHtml(user.role)}</div></div>
          <div class="row"><div class="label">Статус</div><div class="value">${escapeHtml(user.status)}</div></div>
          <div class="row"><div class="label">Email подтвержден</div><div class="value">${escapeHtml(formatRuDate(user.emailVerifiedAt))}</div></div>
          <div class="row"><div class="label">Создан</div><div class="value">${escapeHtml(formatRuDate(user.createdAt))}</div></div>
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:16px">
      <h2>Активные сессии</h2>
      <table>
        <thead><tr><th>Сессия</th><th>Создана</th><th>Истекает</th><th>Устройство</th></tr></thead>
        <tbody>${sessionRows}</tbody>
      </table>
    </section>
  </main>
  <script>
    document.getElementById('logout')?.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      location.href = '/login';
    });
  </script>
</body>
</html>`
}

async function createEmailToken(userId, purpose, ttlSeconds) {
  const token = randomBytes(32).toString('base64url')
  await db.run(`
    INSERT INTO rox_email_tokens (id, user_id, purpose, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, id('tok'), userId, purpose, sha256(token), nowIso(), futureIso(ttlSeconds))
  return token
}

async function sendEmail(to, subject, htmlBody, textBody) {
  if (!RESEND_API_KEY) {
    if (!ALLOW_EMAIL_LOG_FALLBACK) throw new Error('Email delivery is not configured')
    console.log(`[rox-auth] email fallback without token body: ${subject} -> ${to}`)
    return
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Resend failed: ${response.status} ${body}`)
  }
}

async function sendVerification(user) {
  return sendVerificationForDesktop(user, null)
}

async function sendVerificationForDesktop(user, desktopAuth) {
  const token = await createEmailToken(user.id, 'verify_email', 60 * 60 * 24)
  const verifyUrl = new URL(`${PUBLIC_URL}/api/auth/verify-email`)
  verifyUrl.searchParams.set('token', token)
  if (desktopAuth) {
    verifyUrl.searchParams.set('scheme', desktopAuth.scheme)
    verifyUrl.searchParams.set('state', desktopAuth.state)
  }
  const url = verifyUrl.toString()
  await sendEmail(
    user.email,
    'Подтвердите вход в ROX ONE',
    `<p>Подтвердите email для ROX ONE:</p><p><a href="${url}">${url}</a></p>`,
    `Подтвердите email для ROX ONE: ${url}`,
  )
}

function validateDesktopAuth(scheme, state) {
  const normalizedScheme = String(scheme || '').trim().toLowerCase()
  const normalizedState = String(state || '').trim()
  if (!normalizedScheme && !normalizedState) return { ok: true, desktopAuth: null }
  if (!normalizedScheme || !normalizedState) {
    return { ok: false, status: 400, message: 'Remote auth requires both scheme and state.' }
  }
  if (!DESKTOP_AUTH_SCHEMES.has(normalizedScheme)) {
    return { ok: false, status: 400, message: 'Unsupported desktop auth scheme.' }
  }
  if (!DESKTOP_AUTH_STATE_RE.test(normalizedState)) {
    return { ok: false, status: 400, message: 'Invalid desktop auth state.' }
  }
  return { ok: true, desktopAuth: { scheme: normalizedScheme, state: normalizedState } }
}

function desktopAuthFromUrl(url) {
  return validateDesktopAuth(url.searchParams.get('scheme'), url.searchParams.get('state'))
}

function desktopAuthFromBody(body) {
  const source = body.desktopAuth && typeof body.desktopAuth === 'object' ? body.desktopAuth : body
  return validateDesktopAuth(source.scheme, source.state)
}

function desktopRedirectUrl(desktopAuth, refreshToken, user) {
  const url = new URL(`${desktopAuth.scheme}://auth/desktop_redirect`)
  url.searchParams.set('refresh_token', refreshToken)
  url.searchParams.set('user_uid', user.id)
  url.searchParams.set('state', desktopAuth.state)
  return url.toString()
}

function jsonError(res, status, message, code = 'BAD_REQUEST') {
  return json(res, status, { error: { code, message } })
}

function firebaseError(res, status, message) {
  return json(res, status, {
    error: {
      code: status,
      message,
      errors: [{ message, domain: 'global', reason: 'authError' }],
    },
  })
}

function isRemoteAuthPath(pathname) {
  return pathname === '/login/remote' || pathname === '/signup/remote' || pathname === '/upgrade'
}

function llmChoice() {
  return {
    id: 'gpt-5.5',
    displayName: 'GPT-5.5',
    baseModelName: 'gpt-5.5',
    reasoningLevel: 'high',
    description: 'Модель Rox по умолчанию через api.rox.one/v1.',
    disableReason: null,
    visionSupported: true,
    usageMetadata: { creditMultiplier: null, requestMultiplier: 1 },
    spec: { cost: 1, quality: 1, speed: 1 },
    provider: 'OPENAI',
    hostConfigs: [{ enabled: true, modelRoutingHost: 'DIRECT_API' }],
    pricing: { discountPercentage: null },
  }
}

function availableLlms() {
  const choice = llmChoice()
  return {
    defaultId: choice.id,
    preferredCodexModelId: choice.id,
    choices: [choice],
  }
}

function featureModelChoice() {
  const models = availableLlms()
  return {
    agentMode: models,
    planning: models,
    coding: models,
    cliAgent: models,
    computerUseAgent: models,
  }
}

function graphqlUserOutput(session) {
  return {
    __typename: 'UserOutput',
    apiKeyOwnerType: null,
    principalType: 'USER',
    user: {
      anonymousUserInfo: null,
      experiments: [],
      isOnWorkDomain: !/@(gmail|googlemail|icloud|me|mac|outlook|hotmail|live|yahoo|proton|pm)\./i.test(session.email),
      isOnboarded: true,
      profile: {
        uid: session.id,
        email: session.email,
        displayName: session.display_name || null,
        photoUrl: null,
        needsSsoLink: false,
      },
      llms: featureModelChoice(),
      settings: {
        isCloudConversationStorageEnabled: false,
        isCrashReportingEnabled: false,
        isTelemetryEnabled: false,
      },
      workspaces: [
        {
          featureModelChoice: featureModelChoice(),
        },
      ],
    },
  }
}

async function handleGraphql(req, res, url) {
  const session = await bearerSession(req)
  if (!session) return jsonError(res, 401, 'Authentication required', 'AUTH_REQUIRED')
  const body = await readJson(req)
  const operation = String(body.operationName || url.searchParams.get('op') || '')
  if (operation === 'GetUser' || operation === 'GetUserSettings' || operation === 'GetFeatureModelChoices') {
    return json(res, 200, { data: { user: graphqlUserOutput(session) } })
  }
  return json(res, 200, {
    errors: [{ message: `Unsupported Rox GraphQL operation: ${operation || 'unknown'}` }],
    data: null,
  })
}

async function sendReset(user) {
  const token = await createEmailToken(user.id, 'password_reset', 60 * 60)
  const url = `${PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`
  await sendEmail(
    user.email,
    'Сброс пароля ROX ONE',
    `<p>Сбросьте пароль ROX ONE:</p><p><a href="${url}">${url}</a></p>`,
    `Сбросьте пароль ROX ONE: ${url}`,
  )
}

async function consumeToken(token, purpose) {
  const tokenHash = sha256(token || '')
  const row = await db.get(`
    SELECT t.id AS token_id, u.*
    FROM rox_email_tokens t
    JOIN rox_users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.purpose = ? AND t.consumed_at IS NULL AND t.expires_at > ?
  `, tokenHash, purpose, nowIso())
  if (!row) return null
  await db.run('UPDATE rox_email_tokens SET consumed_at = ? WHERE id = ?', nowIso(), row.token_id)
  return row
}

async function handle(req, res) {
  const url = new URL(req.url || '/', `https://${req.headers.host || 'rox.one'}`)

  if (req.method === 'HEAD' && (url.pathname === '/login' || url.pathname === '/reset-password')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end()
  }

  if (req.method === 'POST' && url.pathname === '/proxy/token') {
    const form = await readForm(req)
    const refreshToken = form.get('refresh_token') || ''
    if (form.get('grant_type') !== 'refresh_token' || !refreshToken) {
      return firebaseError(res, 400, 'INVALID_REFRESH_TOKEN')
    }
    const session = await sessionFromToken(refreshToken)
    if (!session || session.status !== 'active') return firebaseError(res, 401, 'TOKEN_EXPIRED')
    return json(res, 200, {
      expires_in: String(ACCESS_TOKEN_TTL_SECONDS),
      id_token: createAccessToken(session, session.session_id),
      refresh_token: refreshToken,
    })
  }

  if (req.method === 'POST' && url.pathname === '/proxy/customToken') {
    return firebaseError(res, 400, 'CUSTOM_TOKEN_AUTH_DISABLED')
  }

  if (req.method === 'POST' && url.pathname === '/graphql/v2') {
    return handleGraphql(req, res, url)
  }

  if (req.method === 'HEAD' && url.pathname === '/api/auth/mode') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    return res.end()
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/register') {
    return redirect(res, '/login?tab=register')
  }

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
    return json(res, 200, { ok: true, service: 'rox-auth' })
  }

  if (req.method === 'GET' && (url.pathname === '/login' || url.pathname === '/reset-password')) {
    if (existsSync(LOGIN_HTML)) return html(res, 200, readFileSync(LOGIN_HTML, 'utf8'))
    return html(res, 200, '<!doctype html><title>ROX ONE</title><h1>ROX ONE login</h1>')
  }

  if (req.method === 'GET' && isRemoteAuthPath(url.pathname)) {
    const validated = desktopAuthFromUrl(url)
    if (!validated.ok) return text(res, validated.status, validated.message)
    if (!validated.desktopAuth) return text(res, 400, 'Remote auth requires both scheme and state.')
    const refreshToken = getCookie(req, SESSION_COOKIE)
    const session = refreshToken ? await sessionFromToken(refreshToken) : null
    if (session?.status === 'active') {
      return redirect(res, desktopRedirectUrl(validated.desktopAuth, refreshToken, session))
    }
    if (existsSync(LOGIN_HTML)) return html(res, 200, readFileSync(LOGIN_HTML, 'utf8'))
    return html(res, 200, '<!doctype html><title>ROX ONE</title><h1>ROX ONE login</h1>')
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && staticPathFor(url.pathname)) {
    if (req.method === 'HEAD') {
      const filePath = staticPathFor(url.pathname)
      if (!filePath || !existsSync(filePath)) return text(res, 404, 'Not found')
      res.writeHead(200, { 'cache-control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store' })
      return res.end()
    }
    if (serveStatic(res, url.pathname)) return
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    const session = await currentSession(req)
    return json(res, 200, {
      wsUrl: WS_URL,
      authMode: 'account',
      account: true,
      currentSessionId: session?.session_id || null,
      user: session ? publicUser(session) : null,
    })
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && isAccountDashboardPath(url.pathname)) {
    const session = await currentSession(req)
    if (!session) return redirect(res, `/login?next=${encodeURIComponent(url.pathname + url.search)}`)
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end()
    }
    const balance = await accountBalance(session.id)
    const sessions = (await db.all(`
      SELECT id, user_agent, ip_address, created_at, expires_at, revoked_at
      FROM rox_sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `, session.id, nowIso())).map(publicSession)
    return html(res, 200, accountDashboardHtml(session, billingOverview(balance), sessions))
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && isProductShellPath(url.pathname)) {
    if (!await currentSession(req)) return redirect(res, `/login?next=${encodeURIComponent(url.pathname + url.search)}`)
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end()
    }
    if (serveStatic(res, '/index.html')) return
    return html(res, 200, '<!doctype html><title>ROX ONE</title><h1>ROX ONE</h1>')
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/mode') {
    return json(res, 200, { mode: 'account', account: true, signupEnabled: true, legacyTokenEnabled: false })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readJson(req)
    const desktopAuthResult = desktopAuthFromBody(body)
    if (!desktopAuthResult.ok) return jsonError(res, desktopAuthResult.status, desktopAuthResult.message)
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')
    const displayName = String(body.displayName || body.name || '').trim()
    if (!checkRateLimit(req, res, 'register:ip', clientIp(req), 20, 60 * 60)) return
    if (!checkRateLimit(req, res, 'register:email', email, 5, 60 * 60)) return
    if (!email || !email.includes('@')) return json(res, 400, { error: { message: 'Введите корректный email.' } })
    if (password.length < 8) return json(res, 400, { error: { message: 'Пароль должен быть не короче 8 символов.' } })
    const createdAt = nowIso()
    const user = {
      id: id('usr'),
      email,
      password_hash: hashPassword(password),
      status: 'pending_email_verification',
      role: Number((await db.get('SELECT COUNT(*) AS count FROM rox_users'))?.count || 0) === 0 ? 'admin' : 'user',
      display_name: displayName,
      created_at: createdAt,
      updated_at: createdAt,
    }
    try {
      await db.run(`
        INSERT INTO rox_users (id, email, password_hash, status, role, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, user.id, user.email, user.password_hash, user.status, user.role, user.display_name, user.created_at, user.updated_at)
    } catch {
      return json(res, 409, { error: { message: 'Пользователь с таким email уже существует.' } })
    }
    await recordAccountEvent(user.id, 'account.registered', 'Создан аккаунт', { email: user.email })
    await sendVerificationForDesktop(user, desktopAuthResult.desktopAuth)
    return json(res, 201, {
      ok: true,
      user: publicUser(user),
      message: desktopAuthResult.desktopAuth
        ? 'Проверьте email и подтвердите регистрацию. После подтверждения Rox откроется автоматически.'
        : 'Проверьте email и подтвердите регистрацию.',
    })
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/verify-email') {
    const desktopAuthResult = desktopAuthFromUrl(url)
    if (!desktopAuthResult.ok) return html(res, desktopAuthResult.status, '<!doctype html><title>ROX ONE</title><h1>Ссылка подтверждения повреждена.</h1>')
    const user = await consumeToken(url.searchParams.get('token'), 'verify_email')
    if (!user) return html(res, 400, '<!doctype html><title>ROX ONE</title><h1>Ссылка недействительна или устарела.</h1>')
    await db.run('UPDATE rox_users SET status = ?, verified_at = ?, updated_at = ? WHERE id = ?', 'active', nowIso(), nowIso(), user.id)
    const activeUser = { ...user, status: 'active', verified_at: nowIso() }
    const token = await createSession(activeUser, req)
    await recordAccountEvent(activeUser.id, 'account.email_verified', 'Email подтвержден', { email: activeUser.email })
    if (desktopAuthResult.desktopAuth) {
      return redirect(res, desktopRedirectUrl(desktopAuthResult.desktopAuth, token, activeUser), {
        'set-cookie': sessionCookie(token),
      })
    }
    return html(res, 200, '<!doctype html><title>ROX ONE</title><h1>Email подтвержден. Можно вернуться в ROX ONE.</h1><p><a href="/login">Открыть вход</a></p>', {
      'set-cookie': sessionCookie(token),
    })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/verify-email') {
    const body = await readJson(req)
    const user = await consumeToken(body.token, 'verify_email')
    if (!user) return json(res, 400, { error: { message: 'Ссылка недействительна или устарела.' } })
    await db.run('UPDATE rox_users SET status = ?, verified_at = ?, updated_at = ? WHERE id = ?', 'active', nowIso(), nowIso(), user.id)
    const sessionToken = await createSession(user, req)
    await recordAccountEvent(user.id, 'account.email_verified', 'Email подтвержден', { email: user.email })
    return json(res, 200, { ok: true, user: publicUser({ ...user, status: 'active', verified_at: nowIso() }) }, { 'set-cookie': sessionCookie(sessionToken) })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/verify-email/resend') {
    const body = await readJson(req)
    const email = normalizeEmail(body.email)
    if (!checkRateLimit(req, res, 'resend:ip', clientIp(req), 20, 60 * 60)) return
    if (!checkRateLimit(req, res, 'resend:email', email, 5, 60 * 60)) return
    const user = await db.get('SELECT * FROM rox_users WHERE email = ?', email)
    if (user && user.status !== 'active') await sendVerification(user)
    return json(res, 200, { ok: true, message: 'Если аккаунт существует, мы отправили письмо.' })
  }

  if (req.method === 'POST' && url.pathname === '/api/account/email/verify') {
    const session = await requireSession(req, res)
    if (!session) return
    const user = await db.get('SELECT * FROM rox_users WHERE id = ?', session.id)
    if (user && user.status !== 'active') await sendVerification(user)
    return json(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(req)
    const desktopAuthResult = desktopAuthFromBody(body)
    if (!desktopAuthResult.ok) return jsonError(res, desktopAuthResult.status, desktopAuthResult.message)
    const email = normalizeEmail(body.email)
    if (!checkRateLimit(req, res, 'login:ip', clientIp(req), 60, 15 * 60)) return
    if (!checkRateLimit(req, res, 'login:email', email, 15, 15 * 60)) return
    const user = await db.get('SELECT * FROM rox_users WHERE email = ?', email)
    if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) {
      return json(res, 401, { error: { message: 'Неверный email или пароль.' } })
    }
    if (user.status !== 'active') return json(res, 403, { error: { message: 'Подтвердите email перед входом.' } })
    const token = await createSession(user, req)
    await recordAccountEvent(user.id, 'account.login', 'Выполнен вход', { email: user.email, ipAddress: clientIp(req) })
    return json(res, 200, {
      ok: true,
      user: publicUser(user),
      desktopRedirectUrl: desktopAuthResult.desktopAuth ? desktopRedirectUrl(desktopAuthResult.desktopAuth, token, user) : null,
    }, { 'set-cookie': sessionCookie(token) })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/password-reset/request') {
    const body = await readJson(req)
    const email = normalizeEmail(body.email)
    if (!checkRateLimit(req, res, 'reset:ip', clientIp(req), 20, 60 * 60)) return
    if (!checkRateLimit(req, res, 'reset:email', email, 5, 60 * 60)) return
    const user = await db.get('SELECT * FROM rox_users WHERE email = ?', email)
    if (user) await sendReset(user)
    return json(res, 200, { ok: true, message: 'Если аккаунт существует, мы отправили письмо для сброса пароля.' })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/password-reset/confirm') {
    const body = await readJson(req)
    const password = String(body.newPassword || body.password || '')
    if (password.length < 8) return json(res, 400, { error: { message: 'Пароль должен быть не короче 8 символов.' } })
    const user = await consumeToken(body.token, 'password_reset')
    if (!user) return json(res, 400, { error: { message: 'Ссылка недействительна или устарела.' } })
    await db.run('UPDATE rox_users SET password_hash = ?, status = ?, verified_at = COALESCE(verified_at, ?), updated_at = ? WHERE id = ?', hashPassword(password), 'active', nowIso(), nowIso(), user.id)
    await db.run('UPDATE rox_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', nowIso(), user.id)
    const token = await createSession(user, req)
    return json(res, 200, { ok: true, user: publicUser({ ...user, status: 'active', verified_at: user.verified_at || nowIso() }) }, { 'set-cookie': sessionCookie(token) })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = getCookie(req, SESSION_COOKIE)
    if (token) {
      const session = await sessionFromToken(token).catch(() => null)
      if (session) await recordAccountEvent(session.id, 'account.logout', 'Выполнен выход', { sessionId: session.session_id })
      await db.run('UPDATE rox_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', nowIso(), sha256(token))
    }
    return json(res, 200, { ok: true }, { 'set-cookie': logoutCookie() })
  }

  if (req.method === 'GET' && url.pathname === '/api/account/me') {
    const session = await requireSession(req, res)
    if (!session) return
    return json(res, 200, { mode: 'account', user: publicUser(session), currentSessionId: session.session_id })
  }

  if (req.method === 'GET' && url.pathname === '/api/account/billing') {
    const session = await requireSession(req, res)
    if (!session) return
    const balance = await accountBalance(session.id)
    return json(res, 200, billingOverview(balance))
  }

  if (req.method === 'GET' && url.pathname === '/api/account/storage') {
    const session = await requireSession(req, res)
    if (!session) return
    return json(res, 200, await accountStorageOverview(session.id))
  }

  if (req.method === 'GET' && url.pathname === '/api/account/events') {
    const session = await requireSession(req, res)
    if (!session) return
    return json(res, 200, { events: await accountEvents(session.id) })
  }

  if (req.method === 'GET' && url.pathname === '/api/account/teams') {
    const session = await requireSession(req, res)
    if (!session) return
    return json(res, 200, { teams: await listOrganizations(session.id) })
  }

  if (req.method === 'GET' && url.pathname === '/api/account/organizations') {
    const session = await requireSession(req, res)
    if (!session) return
    return json(res, 200, { organizations: await listOrganizations(session.id) })
  }

  if (req.method === 'POST' && url.pathname === '/api/account/teams') {
    const session = await requireSession(req, res)
    if (!session) return
    const body = await readJson(req)
    try {
      const team = await createOrganization(session.id, body.name)
      return json(res, 201, { ok: true, team, teams: await listOrganizations(session.id) })
    } catch (error) {
      return json(res, error.statusCode || 500, { error: { message: error.message || 'Не удалось создать команду.' } })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/account/organizations') {
    const session = await requireSession(req, res)
    if (!session) return
    const body = await readJson(req)
    try {
      const organization = await createOrganization(session.id, body.name)
      return json(res, 201, { ok: true, organization, organizations: await listOrganizations(session.id) })
    } catch (error) {
      return json(res, error.statusCode || 500, { error: { message: error.message || 'Не удалось создать команду.' } })
    }
  }

  const teamSpacesMatch = url.pathname.match(/^\/api\/account\/teams\/([^/]+)\/spaces$/)
  if (teamSpacesMatch && (req.method === 'GET' || req.method === 'POST')) {
    const session = await requireSession(req, res)
    if (!session) return
    const teamId = decodeURIComponent(teamSpacesMatch[1])
    try {
      if (req.method === 'POST') {
        const body = await readJson(req)
        await createTeamSpace(session.id, teamId, body.name)
        return json(res, 201, { spaces: await listTeamSpaces(session.id, teamId) })
      }
      return json(res, 200, { spaces: await listTeamSpaces(session.id, teamId) })
    } catch (error) {
      return json(res, error.statusCode || 500, { error: { message: error.message || 'Team space action failed' } })
    }
  }

  const teamInvitesMatch = url.pathname.match(/^\/api\/account\/teams\/([^/]+)\/invites$/)
  if (teamInvitesMatch && req.method === 'POST') {
    const session = await requireSession(req, res)
    if (!session) return
    const body = await readJson(req)
    try {
      const invite = await createTeamInvite(session.id, decodeURIComponent(teamInvitesMatch[1]), body.role)
      return json(res, 201, { invite })
    } catch (error) {
      return json(res, error.statusCode || 500, { error: { message: error.message || 'Team invite action failed' } })
    }
  }

  const inviteAcceptMatch = url.pathname.match(/^\/api\/account\/invites\/([^/]+)\/accept$/)
  if (inviteAcceptMatch && req.method === 'POST') {
    const session = await requireSession(req, res)
    if (!session) return
    try {
      const team = await acceptTeamInvite(session.id, decodeURIComponent(inviteAcceptMatch[1]))
      return json(res, 200, { ok: true, team, teams: await listOrganizations(session.id) })
    } catch (error) {
      await recordAccountEvent(session.id, 'team.invite_accept_failed', 'Не удалось принять team invite', { reason: error.message })
      return json(res, error.statusCode || 500, { error: { message: error.message || 'Не удалось принять приглашение.' } })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/account/organizations/join') {
    const session = await requireSession(req, res)
    if (!session) return
    const body = await readJson(req)
    try {
      const organization = await joinOrganization(session.id, body.code || body.slug || body.organizationId)
      return json(res, 200, { ok: true, organization, organizations: await listOrganizations(session.id) })
    } catch (error) {
      await recordAccountEvent(session.id, 'organization.join_failed', 'Не удалось присоединиться к организации', { reason: error.message })
      return json(res, error.statusCode || 500, { error: { message: error.message || 'Не удалось присоединиться к организации.' } })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/account/billing/top-up-intent') {
    const session = await requireSession(req, res)
    if (!session) return
    const balance = await accountBalance(session.id)
    await recordAccountEvent(session.id, 'billing.top_up_requested', 'Запрошено пополнение баланса', { configured: Boolean(BILLING_TOP_UP_URL) })
    return json(res, 200, {
      ok: Boolean(BILLING_TOP_UP_URL),
      status: BILLING_TOP_UP_URL ? 'redirect_required' : 'not_configured',
      redirectUrl: BILLING_TOP_UP_URL || null,
      message: BILLING_TOP_UP_URL
        ? 'Откройте платежную страницу для пополнения баланса.'
        : 'Платежный провайдер еще не настроен. Баланс уже хранится на сервере, но реальные списания и пополнения выключены.',
      billing: billingOverview(balance),
    })
  }

  if (req.method === 'PATCH' && url.pathname === '/api/account/me') {
    const session = await requireSession(req, res)
    if (!session) return
    const body = await readJson(req)
    const displayName = String(body.displayName || body.name || '').trim()
    await db.run('UPDATE rox_users SET display_name = ?, updated_at = ? WHERE id = ?', displayName, nowIso(), session.id)
    const user = await db.get('SELECT * FROM rox_users WHERE id = ?', session.id)
    await recordAccountEvent(session.id, 'account.profile_updated', 'Профиль обновлен', { displayName })
    return json(res, 200, { mode: 'account', user: publicUser(user), currentSessionId: session.session_id })
  }

  if (req.method === 'GET' && url.pathname === '/api/account/sessions') {
    const session = await requireSession(req, res)
    if (!session) return
    const sessions = (await db.all(`
      SELECT id, user_agent, ip_address, created_at, expires_at, revoked_at
      FROM rox_sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `, session.id, nowIso())).map(publicSession)
    return json(res, 200, { currentSessionId: session.session_id, sessions })
  }

  if (req.method === 'POST' && url.pathname === '/api/account/sessions/revoke-all') {
    const session = await requireSession(req, res)
    if (!session) return
    await db.run('UPDATE rox_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL', nowIso(), session.id, session.session_id)
    await recordAccountEvent(session.id, 'account.sessions_revoked', 'Другие сессии отозваны', { currentSessionId: session.session_id })
    return json(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/account/password') {
    const session = await requireSession(req, res)
    if (!session) return
    const body = await readJson(req)
    if (!verifyPassword(String(body.currentPassword || ''), session.password_hash)) {
      return json(res, 403, { error: { message: 'Текущий пароль неверный.' } })
    }
    const newPassword = String(body.newPassword || body.password || '')
    if (newPassword.length < 8) return json(res, 400, { error: { message: 'Пароль должен быть не короче 8 символов.' } })
    await db.run('UPDATE rox_users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(newPassword), nowIso(), session.id)
    await recordAccountEvent(session.id, 'account.password_changed', 'Пароль изменен', { sessionId: session.session_id })
    return json(res, 200, { ok: true })
  }

  const sessionRevokeMatch = url.pathname.match(/^\/api\/account\/sessions\/([^/]+)$/)
  if (req.method === 'DELETE' && sessionRevokeMatch) {
    const session = await requireSession(req, res)
    if (!session) return
    await db.run('UPDATE rox_sessions SET revoked_at = ? WHERE user_id = ? AND id = ?', nowIso(), session.id, sessionRevokeMatch[1])
    await recordAccountEvent(session.id, 'account.session_revoked', 'Сессия отозвана', { sessionId: sessionRevokeMatch[1] })
    return json(res, 200, { ok: true })
  }

  return text(res, 404, 'Not found')
}

createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('[rox-auth]', error)
    if (error?.statusCode === 413) {
      return json(res, 413, { error: { message: 'Request body too large' } })
    }
    if (error instanceof SyntaxError) {
      return json(res, 400, { error: { message: 'Invalid JSON body' } })
    }
    json(res, 500, { error: { message: 'Internal server error' } })
  })
}).listen(PORT, HOST, () => {
  console.log(`[rox-auth] listening on ${HOST}:${PORT}`)
})
