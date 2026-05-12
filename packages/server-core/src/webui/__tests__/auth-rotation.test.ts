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
  __resetAccountRotationMutexForTest,
  __accountRotationMutexSizeForTest,
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
      const existing = sessions.get(sessionId)
      if (!existing) return { revoked: false, sessionId: null }
      if (existing.revokedAt) return { revoked: false, sessionId }
      revoked.push(sessionId)
      sessions.set(sessionId, { ...existing, revokedAt: new Date().toISOString() })
      return { revoked: true, sessionId }
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

describe('rotateAccountSessionIfStale — concurrent rotation', () => {
  /**
   * Regression test for finding #1 on PR #19: with the previous read→
   * createSession→revokeSession ordering, two concurrent rotators against
   * the same source session each minted their own replacement, leaving an
   * orphan. The CAS-on-revoke contract guarantees that at most one rotator
   * succeeds and the losers return `null` without creating a session.
   */
  it('exposes exactly one new session when two rotators race the same source', async () => {
    // Use the actual InMemoryAccountStore (not the per-test stub) so we
    // exercise the production CAS implementation end-to-end.
    const { InMemoryAccountStore } = await import('../../persistence/agent-workbench-persistence')
    const store = new InMemoryAccountStore()
    const user = await store.createUser({ email: 'race@example.com', password: 'pw-1234567890' })
    const baseline = await store.createSession({ userId: user.id })

    // Force the source session past the rotation window without waiting in
    // real time: replace the persisted createdAt with a synthetic timestamp.
    const aged = new Date(Date.now() - (ACCOUNT_SESSION_ROTATION_WINDOW_MS + 5_000)).toISOString()
    // The InMemoryAccountStore does not expose internal mutation, but it
    // backs sessions on a private Map; use the sliding-window override
    // instead so rotation considers the session stale on the next call.
    void aged

    const identity: SessionIdentity = {
      userId: user.id,
      sessionId: baseline.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    }

    // Both rotators fire against the same source identity in parallel.
    const [a, b] = await Promise.all([
      rotateAccountSessionIfStale({
        identity,
        accountStore: store,
        secret: SECRET,
        secure: false,
        userAgent: null,
        ipAddress: null,
        rotationWindowMs: 0, // force "stale" without time travel
      }),
      rotateAccountSessionIfStale({
        identity,
        accountStore: store,
        secret: SECRET,
        secure: false,
        userAgent: null,
        ipAddress: null,
        rotationWindowMs: 0,
      }),
    ])

    // Exactly one rotator should have observed the CAS hit. The other
    // received `null` without creating a replacement session.
    const winners = [a, b].filter((result): result is NonNullable<typeof result> => result !== null)
    expect(winners).toHaveLength(1)
    const winner = winners[0]!
    expect(winner.previousSessionId).toBe(baseline.id)

    // After the race, the user has at most ONE live session — the winner's.
    const live = await store.listSessions(user.id)
    expect(live).toHaveLength(1)
    expect(live[0]!.id).toBe(winner.identity.sessionId)
    expect(live[0]!.id).not.toBe(baseline.id)

    // And the source session is revoked exactly once.
    const sourceRevoke = await store.revokeSession(baseline.id)
    // Already revoked by the winner, so a second CAS attempt must fail.
    expect(sourceRevoke.revoked).toBe(false)
  })
})

describe('rotateAccountSessionIfStale — per-user rotation mutex (B2)', () => {
  /**
   * The CAS-on-revoke contract from PR #19 prevents orphaned sessions but
   * does not *serialize* concurrent rotation attempts. Two rotators that
   * race against the same userId still execute interleaved store calls,
   * exposing a transient window in which a `PATCH /api/account/me` issued
   * under the pre-rotation cookie can briefly observe a 401 between the
   * `revokeSession` and the response carrying the new `Set-Cookie`.
   *
   * The mutex closes that window: while rotator A holds the per-user lock,
   * rotator B waits. By the time B resumes, A has already revoked the
   * source session and minted the replacement, so B's `getSessionIdentity`
   * lookup of the (now-revoked) source returns `null` and B exits cleanly
   * without performing any store mutation of its own.
   */
  it('serializes concurrent rotators against the same userId', async () => {
    __resetAccountRotationMutexForTest()
    const { InMemoryAccountStore } = await import('../../persistence/agent-workbench-persistence')
    const store = new InMemoryAccountStore()
    const user = await store.createUser({ email: 'mutex@example.com', password: 'pw-1234567890' })
    const baseline = await store.createSession({ userId: user.id })

    const identity: SessionIdentity = {
      userId: user.id,
      sessionId: baseline.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    }

    // Instrument the store so we can prove the mutex serializes the
    // critical section: rotator B's *first* call to getSessionIdentity
    // must happen AFTER rotator A's revokeSession has completed.
    const eventLog: string[] = []
    const wrappedStore = new Proxy(store, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver)
        if (prop === 'getSessionIdentity' || prop === 'revokeSession' || prop === 'createSession') {
          return async (...args: unknown[]) => {
            eventLog.push(`enter:${String(prop)}`)
            // Yield to give the other rotator a chance to interleave if
            // serialization is broken.
            await new Promise(resolve => setImmediate(resolve))
            const result = await (original as (...inner: unknown[]) => Promise<unknown>).apply(target, args)
            eventLog.push(`exit:${String(prop)}`)
            return result
          }
        }
        return original
      },
    })

    const [a, b] = await Promise.all([
      rotateAccountSessionIfStale({
        identity,
        accountStore: wrappedStore,
        secret: SECRET,
        secure: false,
        userAgent: null,
        ipAddress: null,
        rotationWindowMs: 0,
      }),
      rotateAccountSessionIfStale({
        identity,
        accountStore: wrappedStore,
        secret: SECRET,
        secure: false,
        userAgent: null,
        ipAddress: null,
        rotationWindowMs: 0,
      }),
    ])

    // Exactly one rotation actually happened.
    const winners = [a, b].filter((result): result is NonNullable<typeof result> => result !== null)
    expect(winners).toHaveLength(1)

    // Serialization proof: the mutex guarantees that rotator B does not
    // even *enter* `getSessionIdentity` for the second time until after
    // rotator A has fully exited `createSession`. Without the mutex the
    // event log would interleave like
    //   enter:getSessionIdentity, enter:getSessionIdentity, ...
    // With the mutex we see one rotator's full critical section before
    // the other starts.
    const firstEnterIdx = eventLog.indexOf('enter:getSessionIdentity')
    const firstCreateExitIdx = eventLog.indexOf('exit:createSession')
    const secondEnterIdx = eventLog.indexOf('enter:getSessionIdentity', firstEnterIdx + 1)
    expect(firstEnterIdx).toBeGreaterThanOrEqual(0)
    expect(secondEnterIdx).toBeGreaterThan(firstCreateExitIdx)

    // After the race, exactly one live session remains — the winner's.
    const live = await store.listSessions(user.id)
    expect(live).toHaveLength(1)
    expect(live[0]!.id).toBe(winners[0]!.identity.sessionId)

    // Mutex must have released for this user — no leaked entry.
    expect(__accountRotationMutexSizeForTest()).toBe(0)
  })

  it('releases the mutex on error so subsequent rotations succeed', async () => {
    __resetAccountRotationMutexForTest()
    const { InMemoryAccountStore } = await import('../../persistence/agent-workbench-persistence')
    const store = new InMemoryAccountStore()
    const user = await store.createUser({ email: 'mutex-error@example.com', password: 'pw-1234567890' })
    const baseline = await store.createSession({ userId: user.id })

    const identity: SessionIdentity = {
      userId: user.id,
      sessionId: baseline.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    }

    // First call: simulate a store fault inside the critical section.
    const failingStore = new Proxy(store, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver)
        if (prop === 'createSession') {
          return async () => {
            throw new Error('simulated store fault')
          }
        }
        return original
      },
    })

    await expect(
      rotateAccountSessionIfStale({
        identity,
        accountStore: failingStore,
        secret: SECRET,
        secure: false,
        userAgent: null,
        ipAddress: null,
        rotationWindowMs: 0,
      }),
    ).rejects.toThrow('simulated store fault')

    // The mutex MUST be released even after a thrown error.
    expect(__accountRotationMutexSizeForTest()).toBe(0)

    // The aborted rotation revoked the source session before the fault, so
    // a brand-new session is needed to prove subsequent rotations succeed.
    const fresh = await store.createSession({ userId: user.id })
    const freshIdentity: SessionIdentity = { ...identity, sessionId: fresh.id }
    const recovered = await rotateAccountSessionIfStale({
      identity: freshIdentity,
      accountStore: store,
      secret: SECRET,
      secure: false,
      userAgent: null,
      ipAddress: null,
      rotationWindowMs: 0,
    })
    expect(recovered).not.toBeNull()
    expect(__accountRotationMutexSizeForTest()).toBe(0)
  })

  it('does not block rotations for different userIds', async () => {
    __resetAccountRotationMutexForTest()
    const { InMemoryAccountStore } = await import('../../persistence/agent-workbench-persistence')
    const store = new InMemoryAccountStore()
    const userA = await store.createUser({ email: 'user-a@example.com', password: 'pw-1234567890' })
    const userB = await store.createUser({ email: 'user-b@example.com', password: 'pw-1234567890' })
    const sessionA = await store.createSession({ userId: userA.id })
    const sessionB = await store.createSession({ userId: userB.id })

    const idA: SessionIdentity = {
      userId: userA.id, sessionId: sessionA.id,
      email: userA.email, displayName: userA.displayName, role: userA.role,
    }
    const idB: SessionIdentity = {
      userId: userB.id, sessionId: sessionB.id,
      email: userB.email, displayName: userB.displayName, role: userB.role,
    }

    const [resA, resB] = await Promise.all([
      rotateAccountSessionIfStale({
        identity: idA, accountStore: store, secret: SECRET, secure: false,
        userAgent: null, ipAddress: null, rotationWindowMs: 0,
      }),
      rotateAccountSessionIfStale({
        identity: idB, accountStore: store, secret: SECRET, secure: false,
        userAgent: null, ipAddress: null, rotationWindowMs: 0,
      }),
    ])

    expect(resA).not.toBeNull()
    expect(resB).not.toBeNull()
    expect(resA!.identity.sessionId).not.toBe(resB!.identity.sessionId)
    // Both mutex entries released after both rotations completed.
    expect(__accountRotationMutexSizeForTest()).toBe(0)
  })
})
