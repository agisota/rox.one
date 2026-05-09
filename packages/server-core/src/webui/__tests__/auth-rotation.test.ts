/**
 * Sliding-window session-id rotation.
 *
 * Slice 4 hardening: a stolen cookie must age out even when the user is
 * actively using the app. We rotate the underlying DB session id on a
 * configurable sliding window (default 15 minutes) without forcing the user
 * to re-authenticate.
 *
 * Contract:
 *   - `rotateAccountSessionIfStale` returns `null` if the existing session is
 *     younger than the rotation window.
 *   - It returns a new `{ identity, cookie, previousSessionId }` triple if the
 *     session is older than the window. The previous DB session is revoked
 *     and a fresh server-side session id is minted.
 *   - The freshly issued cookie has the same shape as `buildSessionCookie`
 *     (HttpOnly, SameSite=Strict, Path=/, Max-Age = JWT TTL).
 */

import { describe, expect, it } from 'bun:test'
import {
  ACCOUNT_SESSION_ROTATION_WINDOW_MS,
  rotateAccountSessionIfStale,
  ACCOUNT_SESSION_TTL_SECONDS,
} from '../auth'
import type {
  AccountSession,
  AccountStore,
  CreateAccountSessionInput,
  SessionIdentity,
} from '../../accounts'

const SECRET = 'test-secret-with-enough-length-1234'

interface Stub {
  store: AccountStore
  /** Sessions keyed by id, with overrideable createdAt for the rotation test. */
  sessions: Map<string, AccountSession>
  identities: Map<string, SessionIdentity>
  revoked: string[]
  newSessionIds: string[]
}

function buildStubStore(initial: { identity: SessionIdentity; createdAt: string }): Stub {
  const sessions = new Map<string, AccountSession>()
  const identities = new Map<string, SessionIdentity>()
  const revoked: string[] = []
  const newSessionIds: string[] = []

  const expiresAt = new Date(Date.now() + ACCOUNT_SESSION_TTL_SECONDS * 1000).toISOString()
  sessions.set(initial.identity.sessionId, {
    id: initial.identity.sessionId,
    userId: initial.identity.userId,
    userAgent: null,
    ipAddress: null,
    authMethod: 'password',
    createdAt: initial.createdAt,
    expiresAt,
    revokedAt: null,
  })
  identities.set(initial.identity.sessionId, initial.identity)

  let counter = 0
  const store: AccountStore = {
    async migrate() {},
    async getUserCount() { return 1 },
    async createUser() { throw new Error('not used') },
    async getUserByEmail() { return null },
    async verifyPassword() { return null },
    async createSession(input: CreateAccountSessionInput): Promise<AccountSession> {
      counter += 1
      const id = `rotated-${counter}`
      const now = new Date().toISOString()
      const session: AccountSession = {
        id,
        userId: input.userId,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        authMethod: input.authMethod ?? 'password',
        createdAt: now,
        expiresAt: new Date(Date.now() + ACCOUNT_SESSION_TTL_SECONDS * 1000).toISOString(),
        revokedAt: null,
      }
      sessions.set(id, session)
      const previous = identities.get(initial.identity.sessionId)!
      identities.set(id, { ...previous, sessionId: id })
      newSessionIds.push(id)
      return session
    },
    async getSessionIdentity(sessionId) {
      return identities.get(sessionId) ?? null
    },
    async listSessions(userId: string) {
      return [...sessions.values()].filter(session => session.userId === userId && !session.revokedAt)
    },
    async revokeSession(sessionId: string) {
      revoked.push(sessionId)
      const existing = sessions.get(sessionId)
      if (existing) sessions.set(sessionId, { ...existing, revokedAt: new Date().toISOString() })
    },
    async revokeUserSessions() {},
    async revokeOtherSessions() {},
    async getUser() { return null },
    async updateUser() { throw new Error('not used') },
    async markEmailVerified() { throw new Error('not used') },
    async createEmailToken() { throw new Error('not used') },
    async consumeEmailToken() { return null },
    async setPassword() {},
    async changePassword() {},
    async grantWorkspaceOwner() {},
    async isWorkspaceOwner() { return false },
    async listWorkspaceIds() { return [] },
  }

  return { store, sessions, identities, revoked, newSessionIds }
}

const baseIdentity: SessionIdentity = {
  userId: 'user-1',
  sessionId: 'session-old',
  email: 'a@example.com',
  displayName: null,
  role: 'user',
}

describe('rotateAccountSessionIfStale', () => {
  it('returns null when the session is younger than the rotation window', async () => {
    const stub = buildStubStore({
      identity: baseIdentity,
      // 1 minute old, default window is 15 min
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    })

    const result = await rotateAccountSessionIfStale({
      identity: baseIdentity,
      accountStore: stub.store,
      secret: SECRET,
      secure: false,
      userAgent: null,
      ipAddress: null,
    })

    expect(result).toBeNull()
    expect(stub.revoked).toHaveLength(0)
    expect(stub.newSessionIds).toHaveLength(0)
  })

  it('rotates and revokes when the session is older than the rotation window', async () => {
    const stub = buildStubStore({
      identity: baseIdentity,
      createdAt: new Date(Date.now() - (ACCOUNT_SESSION_ROTATION_WINDOW_MS + 1_000)).toISOString(),
    })

    const result = await rotateAccountSessionIfStale({
      identity: baseIdentity,
      accountStore: stub.store,
      secret: SECRET,
      secure: false,
      userAgent: 'Mozilla/5.0',
      ipAddress: '203.0.113.5',
    })

    expect(result).not.toBeNull()
    expect(result!.identity.sessionId).not.toBe('session-old')
    expect(result!.previousSessionId).toBe('session-old')
    expect(stub.revoked).toEqual(['session-old'])
    expect(stub.newSessionIds).toHaveLength(1)
    expect(result!.cookie).toContain('craft_session=')
    expect(result!.cookie).toContain('HttpOnly')
    expect(result!.cookie).toContain('SameSite=Strict')
    expect(result!.cookie).toContain('Path=/')
    expect(result!.cookie).not.toContain('Secure') // secure=false
  })

  it('preserves the user, email, displayName, and role across rotation', async () => {
    const richIdentity: SessionIdentity = {
      userId: 'user-7',
      sessionId: 'session-rich',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'admin',
    }
    const stub = buildStubStore({
      identity: richIdentity,
      createdAt: new Date(Date.now() - (ACCOUNT_SESSION_ROTATION_WINDOW_MS + 5_000)).toISOString(),
    })

    const result = await rotateAccountSessionIfStale({
      identity: richIdentity,
      accountStore: stub.store,
      secret: SECRET,
      secure: true,
      userAgent: null,
      ipAddress: null,
    })

    expect(result).not.toBeNull()
    expect(result!.identity.userId).toBe('user-7')
    expect(result!.identity.email).toBe('admin@example.com')
    expect(result!.identity.displayName).toBe('Admin User')
    expect(result!.identity.role).toBe('admin')
    expect(result!.cookie).toContain('Secure')
  })

  it('does not double-rotate when the session is revoked between read and write', async () => {
    const stub = buildStubStore({
      identity: baseIdentity,
      createdAt: new Date(Date.now() - (ACCOUNT_SESSION_ROTATION_WINDOW_MS + 1_000)).toISOString(),
    })

    // Pre-revoke the existing session — getSessionIdentity will now return null,
    // so rotation must bail out rather than mint a fresh one for an absent user.
    stub.identities.delete('session-old')

    const result = await rotateAccountSessionIfStale({
      identity: baseIdentity,
      accountStore: stub.store,
      secret: SECRET,
      secure: false,
      userAgent: null,
      ipAddress: null,
    })

    expect(result).toBeNull()
    expect(stub.newSessionIds).toHaveLength(0)
  })
})

describe('ACCOUNT_SESSION_TTL_SECONDS', () => {
  it('is shortened from the previous 24h bearer to a tighter window', () => {
    // 24h = 86_400. The rotation hardening MUST tighten this to a value
    // that bounds bearer reuse without forcing constant re-login. We set 1h.
    expect(ACCOUNT_SESSION_TTL_SECONDS).toBeLessThanOrEqual(60 * 60)
    expect(ACCOUNT_SESSION_TTL_SECONDS).toBeGreaterThanOrEqual(15 * 60)
  })
})
