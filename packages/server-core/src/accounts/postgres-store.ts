import { createRequire } from 'node:module'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Pool as PgPool, PoolConfig } from 'pg'
import type {
  AccountAuthMethod,
  AccountRole,
  AccountSession,
  AccountStatus,
  AccountStore,
  CreateAccountSessionInput,
  CreateEmailTokenInput,
  CreateUserInput,
  EmailTokenPurpose,
  PublicUser,
  SessionIdentity,
} from './types'
import { AccountAuthError, AccountConflictError } from './types'

const require = createRequire(import.meta.url)
const { Pool } = require('pg') as typeof import('pg')

const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string | null
  role: AccountRole
  status: AccountStatus
  email_verified_at: Date | null
  created_at: Date
  updated_at: Date
}

interface SessionRow {
  id: string
  user_id: string
  user_agent: string | null
  ip_address: string | null
  auth_method: AccountAuthMethod
  created_at: Date
  expires_at: Date
  revoked_at: Date | null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function defaultEmailTokenExpiry(purpose: EmailTokenPurpose): Date {
  const ttl = purpose === 'password_reset' ? DEFAULT_PASSWORD_RESET_TTL_MS : DEFAULT_EMAIL_VERIFY_TTL_MS
  return new Date(Date.now() + ttl)
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.email_verified_at ? row.email_verified_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function toAccountSession(row: SessionRow): AccountSession {
  return {
    id: row.id,
    userId: row.user_id,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    authMethod: row.auth_method,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
  }
}

export interface PostgresAccountStoreOptions {
  connectionString: string
  pool?: PoolConfig
}

export class PostgresAccountStore implements AccountStore {
  private readonly pool: PgPool

  constructor(options: PostgresAccountStoreOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: 10,
      ...options.pool,
    })
  }

  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rox_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'pending_email_verification',
        email_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE rox_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_email_verification';
      ALTER TABLE rox_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS rox_account_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
        user_agent TEXT,
        ip_address TEXT,
        auth_method TEXT NOT NULL DEFAULT 'password',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      );

      ALTER TABLE rox_account_sessions ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'password';

      CREATE INDEX IF NOT EXISTS rox_account_sessions_user_id_idx ON rox_account_sessions(user_id);
      CREATE INDEX IF NOT EXISTS rox_account_sessions_active_idx ON rox_account_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

      CREATE TABLE IF NOT EXISTS rox_account_email_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS rox_account_email_tokens_lookup_idx
        ON rox_account_email_tokens(purpose, token_hash, expires_at)
        WHERE consumed_at IS NULL;
      CREATE INDEX IF NOT EXISTS rox_account_email_tokens_user_id_idx
        ON rox_account_email_tokens(user_id);

      CREATE TABLE IF NOT EXISTS rox_workspace_owners (
        user_id TEXT NOT NULL REFERENCES rox_users(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, workspace_id)
      );

      CREATE INDEX IF NOT EXISTS rox_workspace_owners_workspace_id_idx ON rox_workspace_owners(workspace_id);
    `)
  }

  async getUserCount(): Promise<number> {
    const result = await this.pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM rox_users')
    return Number(result.rows[0]?.count ?? 0)
  }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const email = normalizeEmail(input.email)
    const passwordHash = await Bun.password.hash(input.password, { algorithm: 'argon2id' })
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT pg_advisory_xact_lock(hashtext('rox_account_first_admin')::bigint)")
      const countResult = await client.query<{ count: string }>('SELECT COUNT(*) AS count FROM rox_users')
      const role: AccountRole = Number(countResult.rows[0]?.count ?? 0) === 0 ? 'admin' : 'user'
      const result = await client.query<UserRow>(
        `INSERT INTO rox_users (id, email, password_hash, display_name, role, status)
         VALUES ($1, $2, $3, $4, $5, 'pending_email_verification')
         RETURNING id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at`,
        [randomUUID(), email, passwordHash, input.displayName?.trim() || null, role],
      )
      const createdUser = result.rows[0]
      if (!createdUser) throw new Error('Failed to create user')
      await client.query('COMMIT')
      return toPublicUser(createdUser)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if ((error as { code?: string }).code === '23505') {
        throw new AccountConflictError('Email is already registered')
      }
      throw error
    } finally {
      client.release()
    }
  }

  async getUserByEmail(email: string): Promise<PublicUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at
       FROM rox_users
       WHERE email = $1`,
      [normalizeEmail(email)],
    )
    return result.rows[0] ? toPublicUser(result.rows[0]) : null
  }

  async verifyPassword(email: string, password: string): Promise<PublicUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at
       FROM rox_users
       WHERE email = $1`,
      [normalizeEmail(email)],
    )
    const user = result.rows[0]
    if (!user) return null
    const ok = await Bun.password.verify(password, user.password_hash)
    return ok ? toPublicUser(user) : null
  }

  async createSession(input: CreateAccountSessionInput): Promise<AccountSession> {
    const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_SESSION_TTL_MS)
    const result = await this.pool.query<SessionRow>(
      `INSERT INTO rox_account_sessions (id, user_id, user_agent, ip_address, auth_method, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, user_agent, ip_address, auth_method, created_at, expires_at, revoked_at`,
      [randomUUID(), input.userId, input.userAgent ?? null, input.ipAddress ?? null, input.authMethod ?? 'password', expiresAt],
    )
    const createdSession = result.rows[0]
    if (!createdSession) throw new Error('Failed to create account session')
    return toAccountSession(createdSession)
  }

  async getSessionIdentity(sessionId: string): Promise<SessionIdentity | null> {
    const result = await this.pool.query<{
      session_id: string
      user_id: string
      email: string
      display_name: string | null
      role: AccountRole
    }>(
      `SELECT s.id AS session_id, u.id AS user_id, u.email, u.display_name, u.role
       FROM rox_account_sessions s
       JOIN rox_users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status <> 'disabled'`,
      [sessionId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      userId: row.user_id,
      sessionId: row.session_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    }
  }

  async listSessions(userId: string): Promise<AccountSession[]> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, user_agent, ip_address, auth_method, created_at, expires_at, revoked_at
       FROM rox_account_sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC`,
      [userId],
    )
    return result.rows.map(toAccountSession)
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE rox_account_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
      [sessionId],
    )
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE rox_account_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    )
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE rox_account_sessions
       SET revoked_at = now()
       WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
      [userId, currentSessionId],
    )
  }

  async getUser(userId: string): Promise<PublicUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at FROM rox_users WHERE id = $1`,
      [userId],
    )
    return result.rows[0] ? toPublicUser(result.rows[0]) : null
  }

  async updateUser(userId: string, patch: { displayName?: string | null }): Promise<PublicUser> {
    const result = await this.pool.query<UserRow>(
      `UPDATE rox_users
       SET display_name = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at`,
      [userId, patch.displayName?.trim() || null],
    )
    if (!result.rows[0]) throw new Error('User not found')
    return toPublicUser(result.rows[0])
  }

  async markEmailVerified(userId: string): Promise<PublicUser> {
    const result = await this.pool.query<UserRow>(
      `UPDATE rox_users
       SET email_verified_at = COALESCE(email_verified_at, now()), status = 'active', updated_at = now()
       WHERE id = $1
       RETURNING id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at`,
      [userId],
    )
    if (!result.rows[0]) throw new Error('User not found')
    return toPublicUser(result.rows[0])
  }

  async createEmailToken(input: CreateEmailTokenInput): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = randomBytes(32).toString('base64url')
    const expiresAt = input.expiresAt ?? defaultEmailTokenExpiry(input.purpose)
    await this.pool.query(
      `INSERT INTO rox_account_email_tokens (id, user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), input.userId, input.purpose, hashToken(rawToken), expiresAt],
    )
    return { rawToken, expiresAt: expiresAt.toISOString() }
  }

  async consumeEmailToken(purpose: EmailTokenPurpose, rawToken: string): Promise<PublicUser | null> {
    const result = await this.pool.query<{ user_id: string }>(
      `UPDATE rox_account_email_tokens
       SET consumed_at = now()
       WHERE id = (
         SELECT id
         FROM rox_account_email_tokens
         WHERE purpose = $1
           AND token_hash = $2
           AND consumed_at IS NULL
           AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING user_id`,
      [purpose, hashToken(rawToken)],
    )
    const userId = result.rows[0]?.user_id
    return userId ? this.getUser(userId) : null
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await Bun.password.hash(newPassword, { algorithm: 'argon2id' })
    await this.pool.query(
      `UPDATE rox_users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [userId, passwordHash],
    )
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const result = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, role, status, email_verified_at, created_at, updated_at FROM rox_users WHERE id = $1`,
      [userId],
    )
    const user = result.rows[0]
    if (!user || !await Bun.password.verify(currentPassword, user.password_hash)) {
      throw new AccountAuthError('Current password is invalid')
    }
    await this.setPassword(userId, newPassword)
  }

  async grantWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO rox_workspace_owners (user_id, workspace_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, workspace_id) DO NOTHING`,
      [userId, workspaceId],
    )
  }

  async isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM rox_workspace_owners WHERE user_id = $1 AND workspace_id = $2 LIMIT 1`,
      [userId, workspaceId],
    )
    return (result.rowCount ?? 0) > 0
  }

  async listWorkspaceIds(userId: string): Promise<string[]> {
    const result = await this.pool.query<{ workspace_id: string }>(
      `SELECT workspace_id FROM rox_workspace_owners WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    )
    return result.rows.map(row => row.workspace_id)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

export function createPostgresAccountStore(options: PostgresAccountStoreOptions): AccountStore {
  return new PostgresAccountStore(options)
}
