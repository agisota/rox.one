import { afterEach, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createWebuiHandler, type WebuiHandler } from '../http-server'
import type { AccountSession, AccountStore, CreateAccountSessionInput, CreateEmailTokenInput, CreateUserInput, EmailTokenPurpose, PublicUser, SessionIdentity } from '../../accounts'
import { AccountAuthError, AccountConflictError } from '../../accounts'
import type { AccountEmailInput, AccountEmailService } from '../email'

class MemoryAccountStore implements AccountStore {
  users = new Map<string, PublicUser & { passwordHash: string }>()
  sessions = new Map<string, AccountSession>()
  tokens = new Map<string, { userId: string; purpose: EmailTokenPurpose; expiresAt: string; consumedAt: string | null }>()
  latestToken: string | null = null
  latestTokensByPurpose = new Map<EmailTokenPurpose, string>()

  async migrate(): Promise<void> {}
  async getUserCount(): Promise<number> { return this.users.size }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase()
    if ([...this.users.values()].some(user => user.email === email)) {
      throw new AccountConflictError()
    }
    const user = {
      id: randomUUID(),
      email,
      displayName: input.displayName?.trim() || null,
      role: 'user' as const,
      status: 'pending_email_verification' as const,
      emailVerifiedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      passwordHash: await Bun.password.hash(input.password, { algorithm: 'argon2id' }),
    }
    this.users.set(user.id, user)
    const { passwordHash: _passwordHash, ...publicUser } = user
    return publicUser
  }

  async getUserByEmail(email: string): Promise<PublicUser | null> {
    const user = [...this.users.values()].find(candidate => candidate.email === email.trim().toLowerCase())
    if (!user) return null
    const { passwordHash: _passwordHash, ...publicUser } = user
    return publicUser
  }

  async verifyPassword(email: string, password: string): Promise<PublicUser | null> {
    const user = [...this.users.values()].find(candidate => candidate.email === email.trim().toLowerCase())
    if (!user) return null
    if (!await Bun.password.verify(password, user.passwordHash)) return null
    const { passwordHash: _passwordHash, ...publicUser } = user
    return publicUser
  }

  async createSession(input: CreateAccountSessionInput): Promise<AccountSession> {
    const session: AccountSession = {
      id: randomUUID(),
      userId: input.userId,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      authMethod: input.authMethod ?? 'password',
      createdAt: new Date().toISOString(),
      expiresAt: (input.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
      revokedAt: null,
    }
    this.sessions.set(session.id, session)
    return session
  }

  async getSessionIdentity(sessionId: string): Promise<SessionIdentity | null> {
    const session = this.sessions.get(sessionId)
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) return null
    const user = this.users.get(session.userId)
    if (!user) return null
    return { userId: user.id, sessionId, email: user.email, displayName: user.displayName, role: user.role }
  }

  async listSessions(userId: string): Promise<AccountSession[]> {
    return [...this.sessions.values()].filter(session =>
      session.userId === userId
      && !session.revokedAt
      && new Date(session.expiresAt).getTime() > Date.now()
    )
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) this.sessions.set(sessionId, { ...session, revokedAt: new Date().toISOString() })
  }

  async revokeUserSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        this.sessions.set(session.id, { ...session, revokedAt: new Date().toISOString() })
      }
    }
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.id !== currentSessionId && !session.revokedAt) {
        this.sessions.set(session.id, { ...session, revokedAt: new Date().toISOString() })
      }
    }
  }

  async getUser(userId: string): Promise<PublicUser | null> {
    const user = this.users.get(userId)
    if (!user) return null
    const { passwordHash: _passwordHash, ...publicUser } = user
    return publicUser
  }

  async markEmailVerified(userId: string): Promise<PublicUser> {
    const user = this.users.get(userId)
    if (!user) throw new Error('User not found')
    const next = {
      ...user,
      status: 'active' as const,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.users.set(userId, next)
    const { passwordHash: _passwordHash, ...publicUser } = next
    return publicUser
  }

  async createEmailToken(input: CreateEmailTokenInput): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = randomUUID()
    const expiresAt = (input.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString()
    this.tokens.set(rawToken, { userId: input.userId, purpose: input.purpose, expiresAt, consumedAt: null })
    this.latestToken = rawToken
    this.latestTokensByPurpose.set(input.purpose, rawToken)
    return { rawToken, expiresAt }
  }

  async consumeEmailToken(purpose: EmailTokenPurpose, rawToken: string): Promise<PublicUser | null> {
    const token = this.tokens.get(rawToken)
    if (!token || token.purpose !== purpose || token.consumedAt || new Date(token.expiresAt).getTime() <= Date.now()) return null
    this.tokens.set(rawToken, { ...token, consumedAt: new Date().toISOString() })
    return this.getUser(token.userId)
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId)
    if (!user) throw new Error('User not found')
    this.users.set(userId, {
      ...user,
      passwordHash: await Bun.password.hash(newPassword, { algorithm: 'argon2id' }),
      updatedAt: new Date().toISOString(),
    })
  }

  async updateUser(userId: string, patch: { displayName?: string | null }): Promise<PublicUser> {
    const user = this.users.get(userId)
    if (!user) throw new Error('User not found')
    const next = { ...user, displayName: patch.displayName ?? null, updatedAt: new Date().toISOString() }
    this.users.set(userId, next)
    const { passwordHash: _passwordHash, ...publicUser } = next
    return publicUser
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId)
    if (!user || !await Bun.password.verify(currentPassword, user.passwordHash)) {
      throw new AccountAuthError()
    }
    await this.setPassword(userId, newPassword)
  }
  async grantWorkspaceOwner(): Promise<void> {}
  async isWorkspaceOwner(): Promise<boolean> { return true }
  async listWorkspaceIds(): Promise<string[]> { return [] }
}

class RecordingAccountEmailService implements AccountEmailService {
  verificationEmails: AccountEmailInput[] = []
  passwordResetEmails: AccountEmailInput[] = []
  passwordChangedEmails: Array<{ to: string; displayName?: string | null }> = []

  async sendVerificationEmail(input: AccountEmailInput): Promise<void> {
    this.verificationEmails.push(input)
  }

  async sendPasswordResetEmail(input: AccountEmailInput): Promise<void> {
    this.passwordResetEmails.push(input)
  }

  async sendPasswordChangedEmail(input: { to: string; displayName?: string | null }): Promise<void> {
    this.passwordChangedEmails.push(input)
  }
}

describe('account webui auth', () => {
  const handlers: WebuiHandler[] = []

  afterEach(() => {
    for (const handler of handlers.splice(0)) handler.dispose()
  })

  function createHandler(store = new MemoryAccountStore(), emailService?: AccountEmailService) {
    const handler = createWebuiHandler({
      webuiDir: '/tmp/does-not-need-static-assets',
      secret: 'test-secret-with-enough-length',
      wsProtocol: 'ws',
      wsPort: 9100,
      getHealthCheck: () => ({ status: 'ok' }),
      logger: { info() {}, warn() {}, error() {}, debug() {} } as any,
      accountStore: store,
      publicAppUrl: 'https://app.rox.one',
      accountEmailService: emailService,
    })
    handlers.push(handler)
    return handler
  }

  it('registers, verifies email, sets a session cookie, and returns the current account', async () => {
    const store = new MemoryAccountStore()
    const emailService = new RecordingAccountEmailService()
    const handler = createHandler(store, emailService)
    const register = await handler.fetch(new Request('http://rox.test/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'User@Example.com', password: 'password123', displayName: 'User' }),
    }))

    expect(register.status).toBe(200)
    expect(register.headers.get('set-cookie')).toBeNull()
    expect(store.latestToken).toBeTruthy()
    expect(emailService.verificationEmails).toHaveLength(1)
    expect(emailService.verificationEmails[0]?.url).toStartWith('https://app.rox.one/api/auth/verify-email?token=')

    const verify = await handler.fetch(new Request(`http://rox.test/api/auth/verify-email?token=${store.latestToken}`))
    expect(verify.status).toBe(302)
    const cookie = verify.headers.get('set-cookie')
    expect(cookie).toContain('rox_session=')

    const me = await handler.fetch(new Request('http://rox.test/api/account/me', {
      headers: { cookie: cookie ?? '' },
    }))
    expect(me.status).toBe(200)
    const body = await me.json() as { mode: string; user: { email: string } }
    expect(body.mode).toBe('account')
    expect(body.user.email).toBe('user@example.com')
  })

  it('rejects invalid hosted-account login credentials', async () => {
    const store = new MemoryAccountStore()
    await store.createUser({ email: 'user@example.com', password: 'password123' })
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://rox.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'wrong-password' }),
    }))

    expect(login.status).toBe(401)
  })

  it('logs in verified users, returns account details, updates profile, and logs out', async () => {
    const store = new MemoryAccountStore()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://rox.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('rox_session=')

    const patch = await handler.fetch(new Request('http://rox.test/api/account/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ displayName: 'ROX User' }),
    }))
    expect(patch.status).toBe(200)

    const me = await handler.fetch(new Request('http://rox.test/api/account/me', {
      headers: { cookie },
    }))
    const meBody = await me.json() as { user: { displayName: string | null } }
    expect(me.status).toBe(200)
    expect(meBody.user.displayName).toBe('ROX User')

    const logout = await handler.fetch(new Request('http://rox.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    }))
    expect(logout.status).toBe(204)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')

    const afterLogout = await handler.fetch(new Request('http://rox.test/api/account/me', {
      headers: { cookie },
    }))
    expect(afterLogout.status).toBe(401)
  })

  it('resets passwords through the public ROX ONE app URL and revokes old sessions', async () => {
    const store = new MemoryAccountStore()
    const emailService = new RecordingAccountEmailService()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store, emailService)

    const oldLogin = await handler.fetch(new Request('http://rox.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const oldCookie = oldLogin.headers.get('set-cookie') ?? ''
    expect(oldLogin.status).toBe(200)

    const requestReset = await handler.fetch(new Request('http://rox.test/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    }))
    expect(requestReset.status).toBe(200)
    expect(emailService.passwordResetEmails).toHaveLength(1)
    expect(emailService.passwordResetEmails[0]?.url).toStartWith('https://app.rox.one/reset-password?token=')

    const resetToken = store.latestTokensByPurpose.get('password_reset')
    expect(resetToken).toBeTruthy()
    const confirmReset = await handler.fetch(new Request('http://rox.test/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword: 'new-password123' }),
    }))
    expect(confirmReset.status).toBe(200)
    expect(confirmReset.headers.get('set-cookie')).toContain('rox_session=')

    const oldSession = await handler.fetch(new Request('http://rox.test/api/account/me', {
      headers: { cookie: oldCookie },
    }))
    expect(oldSession.status).toBe(401)

    const newLogin = await handler.fetch(new Request('http://rox.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'new-password123' }),
    }))
    expect(newLogin.status).toBe(200)
  })

  it('returns protected cabinet defaults for billing, events, and organizations', async () => {
    const store = new MemoryAccountStore()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123', displayName: 'User' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://rox.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const billing = await handler.fetch(new Request('http://rox.test/api/account/billing', {
      headers: { cookie },
    }))
    expect(billing.status).toBe(200)
    expect(await billing.json()).toEqual({
      balance: {
        userId: created.id,
        balanceUnits: 0,
        currency: 'ROX',
        updatedAt: null,
      },
      topUp: {
        enabled: false,
        provider: 'manual',
        url: null,
      },
    })

    const events = await handler.fetch(new Request('http://rox.test/api/account/events', {
      headers: { cookie },
    }))
    expect(events.status).toBe(200)
    expect(await events.json()).toEqual({ events: [] })

    const organizations = await handler.fetch(new Request('http://rox.test/api/account/organizations', {
      headers: { cookie },
    }))
    expect(organizations.status).toBe(200)
    expect(await organizations.json()).toEqual({ organizations: [] })
  })

  it('denies cabinet data and mutations without an account session', async () => {
    const handler = createHandler(new MemoryAccountStore())

    for (const path of ['/api/account/billing', '/api/account/events', '/api/account/organizations']) {
      const res = await handler.fetch(new Request(`http://rox.test${path}`))
      expect(res.status).toBe(401)
    }

    const topUp = await handler.fetch(new Request('http://rox.test/api/account/billing/top-up-intent', {
      method: 'POST',
    }))
    expect(topUp.status).toBe(401)

    const createOrg = await handler.fetch(new Request('http://rox.test/api/account/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ROX Ops' }),
    }))
    expect(createOrg.status).toBe(401)

    const joinOrg = await handler.fetch(new Request('http://rox.test/api/account/organizations/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'rox-ops' }),
    }))
    expect(joinOrg.status).toBe(401)
  })

  it('keeps unavailable cabinet mutations explicit instead of faking billing or team setup', async () => {
    const store = new MemoryAccountStore()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://rox.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const topUp = await handler.fetch(new Request('http://rox.test/api/account/billing/top-up-intent', {
      method: 'POST',
      headers: { cookie },
    }))
    expect(topUp.status).toBe(200)
    expect(await topUp.json()).toEqual({
      status: 'disabled',
      redirectUrl: null,
      message: 'Billing top-up is not configured for this workspace.',
      billing: {
        balance: {
          userId: created.id,
          balanceUnits: 0,
          currency: 'ROX',
          updatedAt: null,
        },
        topUp: {
          enabled: false,
          provider: 'manual',
          url: null,
        },
      },
    })

    const createOrg = await handler.fetch(new Request('http://rox.test/api/account/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name: 'ROX Ops' }),
    }))
    expect(createOrg.status).toBe(501)

    const joinOrg = await handler.fetch(new Request('http://rox.test/api/account/organizations/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ code: 'rox-ops' }),
    }))
    expect(joinOrg.status).toBe(501)
  })
})
