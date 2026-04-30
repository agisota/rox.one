import { afterEach, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createWebuiHandler, type WebuiHandler } from '../http-server'
import type { AccountSession, AccountStore, CreateAccountSessionInput, CreateEmailTokenInput, CreateUserInput, EmailTokenPurpose, PublicUser, SessionIdentity } from '../../accounts'
import { AccountAuthError, AccountConflictError } from '../../accounts'
import type { AccountEmailInput, AccountEmailService } from '../email'
import { InMemoryAccountUsageLedger } from '../account-ledger'
import { InMemoryAccountEventHistory } from '../account-events'
import { InMemoryAccountTeamStore } from '../account-teams'
import { InMemoryManagedCloudWorkspaceStore } from '../account-cloud-workspaces'
import { createDvnetWebhookSignature } from '../account-billing'

class MemoryAccountStore implements AccountStore {
  users = new Map<string, PublicUser & { passwordHash: string }>()
  sessions = new Map<string, AccountSession>()
  tokens = new Map<string, { userId: string; purpose: EmailTokenPurpose; expiresAt: string; consumedAt: string | null }>()
  workspaceIdsByUserId = new Map<string, Set<string>>()
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
  async grantWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
    const workspaceIds = this.workspaceIdsByUserId.get(userId) ?? new Set<string>()
    workspaceIds.add(workspaceId)
    this.workspaceIdsByUserId.set(userId, workspaceIds)
  }

  async isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
    return this.workspaceIdsByUserId.get(userId)?.has(workspaceId) ?? false
  }

  async listWorkspaceIds(userId: string): Promise<string[]> {
    return [...(this.workspaceIdsByUserId.get(userId) ?? [])].sort()
  }
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

  function createHandler(
    store = new MemoryAccountStore(),
    emailService?: AccountEmailService,
    usageLedger?: InMemoryAccountUsageLedger,
    eventHistory?: InMemoryAccountEventHistory,
    teamStore?: InMemoryAccountTeamStore,
    cloudWorkspaceStore?: InMemoryManagedCloudWorkspaceStore,
    dvnetBilling?: { storeUuid: string; paymentBaseUrl: string; webhookSecret: string },
  ) {
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
      accountUsageLedger: usageLedger,
      accountEventHistory: eventHistory,
      accountTeamStore: teamStore,
      accountCloudWorkspaceStore: cloudWorkspaceStore,
      accountDvnetBilling: dvnetBilling,
    })
    handlers.push(handler)
    return handler
  }

  function createLegacyHandler() {
    const handler = createWebuiHandler({
      webuiDir: '/tmp/does-not-need-static-assets',
      secret: 'test-secret-with-enough-length',
      wsProtocol: 'ws',
      wsPort: 9100,
      getHealthCheck: () => ({ status: 'ok' }),
      logger: { info() {}, warn() {}, error() {}, debug() {} } as any,
    })
    handlers.push(handler)
    return handler
  }

  it('registers, verifies email, sets a session cookie, and returns the current account', async () => {
    const store = new MemoryAccountStore()
    const emailService = new RecordingAccountEmailService()
    const handler = createHandler(store, emailService)
    const register = await handler.fetch(new Request('http://craft.test/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'User@Example.com', password: 'password123', displayName: 'User' }),
    }))

    expect(register.status).toBe(200)
    expect(register.headers.get('set-cookie')).toBeNull()
    expect(store.latestToken).toBeTruthy()
    expect(emailService.verificationEmails).toHaveLength(1)
    expect(emailService.verificationEmails[0]?.url).toStartWith('https://app.rox.one/api/auth/verify-email?token=')

    const verify = await handler.fetch(new Request(`http://craft.test/api/auth/verify-email?token=${store.latestToken}`))
    expect(verify.status).toBe(302)
    const cookie = verify.headers.get('set-cookie')
    expect(cookie).toContain('craft_session=')

    const me = await handler.fetch(new Request('http://craft.test/api/account/me', {
      headers: { cookie: cookie ?? '' },
    }))
    expect(me.status).toBe(200)
    const body = await me.json() as { mode: string; user: { email: string } }
    expect(body.mode).toBe('account')
    expect(body.user.email).toBe('user@example.com')
  })

  it('exposes a cloud session boundary with only the current users workspace ids', async () => {
    const store = new MemoryAccountStore()
    const firstUser = await store.createUser({ email: 'first@example.com', password: 'password123' })
    await store.markEmailVerified(firstUser.id)
    const secondUser = await store.createUser({ email: 'second@example.com', password: 'password123' })
    await store.markEmailVerified(secondUser.id)
    await store.grantWorkspaceOwner(firstUser.id, 'workspace-a')
    await store.grantWorkspaceOwner(firstUser.id, 'workspace-b')
    await store.grantWorkspaceOwner(secondUser.id, 'workspace-other')
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'first@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const me = await handler.fetch(new Request('http://craft.test/api/account/me', {
      headers: { cookie },
    }))
    expect(me.status).toBe(200)
    const body = await me.json() as {
      mode: string
      sessionBoundary: {
        mode: string
        cloud: boolean
        userId: string
        sessionId: string
        email: string
        role: string
        workspaceIds: string[]
      }
    }

    expect(body.mode).toBe('account')
    expect(body.sessionBoundary).toMatchObject({
      mode: 'cloud',
      cloud: true,
      userId: firstUser.id,
      email: 'first@example.com',
      role: 'user',
      workspaceIds: ['workspace-a', 'workspace-b'],
    })
    expect(body.sessionBoundary.sessionId).toBeTruthy()
    expect(body.sessionBoundary.workspaceIds).not.toContain('workspace-other')
  })

  it('rejects invalid hosted-account login credentials', async () => {
    const store = new MemoryAccountStore()
    await store.createUser({ email: 'user@example.com', password: 'password123' })
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'wrong-password' }),
    }))

    expect(login.status).toBe(401)
  })

  it('reports legacy auth as a local session boundary without cloud access', async () => {
    const handler = createLegacyHandler()

    const auth = await handler.fetch(new Request('http://craft.test/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-secret-with-enough-length' }),
    }))
    expect(auth.status).toBe(200)
    const cookie = auth.headers.get('set-cookie') ?? ''

    const me = await handler.fetch(new Request('http://craft.test/api/account/me', {
      headers: { cookie },
    }))
    expect(me.status).toBe(200)
    const body = await me.json() as { mode: string; sessionBoundary: unknown }

    expect(body.mode).toBe('legacy')
    expect(body.sessionBoundary).toEqual({
      mode: 'local',
      cloud: false,
      userId: null,
      sessionId: null,
      email: null,
      role: null,
      workspaceIds: [],
    })
  })

  it('logs in verified users, returns account details, updates profile, and logs out', async () => {
    const store = new MemoryAccountStore()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('craft_session=')

    const patch = await handler.fetch(new Request('http://craft.test/api/account/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ displayName: 'ROX User' }),
    }))
    expect(patch.status).toBe(200)

    const me = await handler.fetch(new Request('http://craft.test/api/account/me', {
      headers: { cookie },
    }))
    const meBody = await me.json() as { user: { displayName: string | null } }
    expect(me.status).toBe(200)
    expect(meBody.user.displayName).toBe('ROX User')

    const logout = await handler.fetch(new Request('http://craft.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    }))
    expect(logout.status).toBe(204)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')

    const afterLogout = await handler.fetch(new Request('http://craft.test/api/account/me', {
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

    const oldLogin = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const oldCookie = oldLogin.headers.get('set-cookie') ?? ''
    expect(oldLogin.status).toBe(200)

    const requestReset = await handler.fetch(new Request('http://craft.test/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    }))
    expect(requestReset.status).toBe(200)
    expect(emailService.passwordResetEmails).toHaveLength(1)
    expect(emailService.passwordResetEmails[0]?.url).toStartWith('https://app.rox.one/reset-password?token=')

    const resetToken = store.latestTokensByPurpose.get('password_reset')
    expect(resetToken).toBeTruthy()
    const confirmReset = await handler.fetch(new Request('http://craft.test/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword: 'new-password123' }),
    }))
    expect(confirmReset.status).toBe(200)
    expect(confirmReset.headers.get('set-cookie')).toContain('craft_session=')

    const oldSession = await handler.fetch(new Request('http://craft.test/api/account/me', {
      headers: { cookie: oldCookie },
    }))
    expect(oldSession.status).toBe(401)

    const newLogin = await handler.fetch(new Request('http://craft.test/api/auth/login', {
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

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const billing = await handler.fetch(new Request('http://craft.test/api/account/billing', {
      headers: { cookie },
    }))
    expect(billing.status).toBe(200)
    expect(await billing.json()).toEqual({
      balance: {
        userId: created.id,
        balanceUnits: 0,
        currency: 'USDT',
        updatedAt: null,
      },
      topUp: {
        enabled: false,
        provider: 'manual',
        url: null,
      },
    })

    const events = await handler.fetch(new Request('http://craft.test/api/account/events', {
      headers: { cookie },
    }))
    expect(events.status).toBe(200)
    expect(await events.json()).toEqual({ events: [] })

    const organizations = await handler.fetch(new Request('http://craft.test/api/account/organizations', {
      headers: { cookie },
    }))
    expect(organizations.status).toBe(200)
    expect(await organizations.json()).toEqual({ organizations: [] })

    const storage = await handler.fetch(new Request('http://craft.test/api/account/storage', {
      headers: { cookie },
    }))
    expect(storage.status).toBe(200)
    const storageBody = await storage.json() as {
      endpointStatus: string
      buckets: Array<{ ownerType: string; ownerId: string; bucket: string; prefix: string; endpoint: string | null; quotaBytes: number }>
    }
    expect(storageBody.endpointStatus).toBe('unhealthy')
    expect(storageBody.buckets).toEqual([
      expect.objectContaining({
        ownerType: 'user',
        ownerId: created.id,
        bucket: `rox-user-${created.id}`,
        prefix: `users/${created.id}/`,
        endpoint: null,
        quotaBytes: 1024 ** 3,
      }),
    ])
    expect(JSON.stringify(storageBody)).not.toContain('secret')
    expect(JSON.stringify(storageBody)).not.toContain('accessKey')
    expect(JSON.stringify(storageBody)).not.toContain('credential')
  })

  it('denies cabinet data and mutations without an account session', async () => {
    const handler = createHandler(new MemoryAccountStore())

    for (const path of ['/api/account/billing', '/api/account/events', '/api/account/organizations', '/api/account/storage']) {
      const res = await handler.fetch(new Request(`http://craft.test${path}`))
      expect(res.status).toBe(401)
    }

    const topUp = await handler.fetch(new Request('http://craft.test/api/account/billing/top-up-intent', {
      method: 'POST',
    }))
    expect(topUp.status).toBe(401)

    const createOrg = await handler.fetch(new Request('http://craft.test/api/account/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ROX Ops' }),
    }))
    expect(createOrg.status).toBe(401)

    const joinOrg = await handler.fetch(new Request('http://craft.test/api/account/organizations/join', {
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

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const topUp = await handler.fetch(new Request('http://craft.test/api/account/billing/top-up-intent', {
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
          currency: 'USDT',
          updatedAt: null,
        },
        topUp: {
          enabled: false,
          provider: 'manual',
          url: null,
        },
      },
    })

    const createOrg = await handler.fetch(new Request('http://craft.test/api/account/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name: 'ROX Ops' }),
    }))
    expect(createOrg.status).toBe(501)

    const joinOrg = await handler.fetch(new Request('http://craft.test/api/account/organizations/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ code: 'rox-ops' }),
    }))
    expect(joinOrg.status).toBe(501)
  })

  it('creates account organizations through an injected team store', async () => {
    const store = new MemoryAccountStore()
    const teams = new InMemoryAccountTeamStore()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store, undefined, undefined, undefined, teams)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const createOrg = await handler.fetch(new Request('http://craft.test/api/account/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name: 'ROX Ops' }),
    }))
    expect(createOrg.status).toBe(200)
    const createBody = await createOrg.json() as { organizations: Array<{ name: string; role: string; slug: string }> }

    expect(createBody.organizations).toHaveLength(1)
    expect(createBody.organizations[0]).toMatchObject({
      name: 'ROX Ops',
      role: 'owner',
    })
    expect(createBody.organizations[0]!.slug).toStartWith('rox-ops-')
  })

  it('joins account organizations through single-use invites without leaking unrelated teams', async () => {
    const store = new MemoryAccountStore()
    const teams = new InMemoryAccountTeamStore()
    const owner = await store.createUser({ email: 'owner@example.com', password: 'password123' })
    await store.markEmailVerified(owner.id)
    const member = await store.createUser({ email: 'member@example.com', password: 'password123' })
    await store.markEmailVerified(member.id)
    const otherOwner = await store.createUser({ email: 'other@example.com', password: 'password123' })
    await store.markEmailVerified(otherOwner.id)
    const organization = await teams.createOrganization({ actorUserId: owner.id, name: 'ROX Ops' })
    await teams.createOrganization({ actorUserId: otherOwner.id, name: 'Other Team' })
    const invite = await teams.createInvite({ actorUserId: owner.id, organizationId: organization.id })
    const handler = createHandler(store, undefined, undefined, undefined, teams)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const joinOrg = await handler.fetch(new Request('http://craft.test/api/account/organizations/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ code: invite.code }),
    }))
    expect(joinOrg.status).toBe(200)
    const joinBody = await joinOrg.json() as { organizations: Array<{ name: string; role: string }> }

    expect(joinBody.organizations).toEqual([
      expect.objectContaining({ name: 'ROX Ops', role: 'member' }),
    ])

    const reused = await handler.fetch(new Request('http://craft.test/api/account/organizations/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ code: invite.code }),
    }))
    expect(reused.status).toBe(400)
  })

  it('exposes teams, spaces, and invite aliases with deny-by-default RBAC', async () => {
    const store = new MemoryAccountStore()
    const teams = new InMemoryAccountTeamStore()
    const owner = await store.createUser({ email: 'owner@example.com', password: 'password123' })
    await store.markEmailVerified(owner.id)
    const viewer = await store.createUser({ email: 'viewer@example.com', password: 'password123' })
    await store.markEmailVerified(viewer.id)
    const outsider = await store.createUser({ email: 'outsider@example.com', password: 'password123' })
    await store.markEmailVerified(outsider.id)
    const handler = createHandler(store, undefined, undefined, undefined, teams)

    const ownerLogin = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'password123' }),
    }))
    const ownerCookie = ownerLogin.headers.get('set-cookie') ?? ''
    expect(ownerLogin.status).toBe(200)

    const createTeam = await handler.fetch(new Request('http://craft.test/api/account/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ name: 'ROX Ops' }),
    }))
    expect(createTeam.status).toBe(200)
    const createTeamBody = await createTeam.json() as { teams: Array<{ id: string; name: string; role: string }> }
    const teamId = createTeamBody.teams[0]!.id
    expect(createTeamBody.teams[0]).toMatchObject({ name: 'ROX Ops', role: 'owner' })

    const createSpace = await handler.fetch(new Request(`http://craft.test/api/account/teams/${teamId}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ name: 'Research' }),
    }))
    expect(createSpace.status).toBe(201)
    const createSpaceBody = await createSpace.json() as { spaces: Array<{ name: string; storagePrefix: string }> }
    expect(createSpaceBody.spaces).toEqual([
      expect.objectContaining({ name: 'Research', storagePrefix: expect.stringContaining(`/spaces/`) }),
    ])

    const invite = await handler.fetch(new Request(`http://craft.test/api/account/teams/${teamId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ role: 'viewer' }),
    }))
    expect(invite.status).toBe(201)
    const inviteBody = await invite.json() as { invite: { code: string; role: string } }
    expect(inviteBody.invite.role).toBe('viewer')

    const viewerLogin = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.com', password: 'password123' }),
    }))
    const viewerCookie = viewerLogin.headers.get('set-cookie') ?? ''
    const accept = await handler.fetch(new Request(`http://craft.test/api/account/invites/${inviteBody.invite.code}/accept`, {
      method: 'POST',
      headers: { cookie: viewerCookie },
    }))
    expect(accept.status).toBe(200)
    const acceptBody = await accept.json() as { teams: Array<{ name: string; role: string }> }
    expect(acceptBody.teams).toEqual([expect.objectContaining({ name: 'ROX Ops', role: 'viewer' })])

    const viewerSpaces = await handler.fetch(new Request(`http://craft.test/api/account/teams/${teamId}/spaces`, {
      headers: { cookie: viewerCookie },
    }))
    expect(viewerSpaces.status).toBe(200)

    const viewerCreateSpace = await handler.fetch(new Request(`http://craft.test/api/account/teams/${teamId}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: viewerCookie },
      body: JSON.stringify({ name: 'Viewer Draft' }),
    }))
    expect(viewerCreateSpace.status).toBe(403)

    const outsiderLogin = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'outsider@example.com', password: 'password123' }),
    }))
    const outsiderCookie = outsiderLogin.headers.get('set-cookie') ?? ''
    const outsiderSpaces = await handler.fetch(new Request(`http://craft.test/api/account/teams/${teamId}/spaces`, {
      headers: { cookie: outsiderCookie },
    }))
    expect(outsiderSpaces.status).toBe(403)

    const reused = await handler.fetch(new Request(`http://craft.test/api/account/invites/${inviteBody.invite.code}/accept`, {
      method: 'POST',
      headers: { cookie: outsiderCookie },
    }))
    expect(reused.status).toBe(400)
  })

  it('creates managed cloud workspaces through account sessions and grants explicit ownership', async () => {
    const store = new MemoryAccountStore()
    const cloudWorkspaces = new InMemoryManagedCloudWorkspaceStore()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store, undefined, undefined, undefined, undefined, cloudWorkspaces)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const createWorkspace = await handler.fetch(new Request('http://craft.test/api/account/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Research Ops' }),
    }))
    expect(createWorkspace.status).toBe(201)
    const createBody = await createWorkspace.json() as { workspace: { id: string; name: string; slug: string; ownerUserId: string; storage: { prefix: string } } }

    expect(createBody.workspace).toMatchObject({
      name: 'Research Ops',
      slug: 'research-ops',
      ownerUserId: created.id,
      storage: { prefix: `managed-workspaces/${createBody.workspace.id}/` },
    })
    expect(await store.isWorkspaceOwner(created.id, createBody.workspace.id)).toBe(true)

    const me = await handler.fetch(new Request('http://craft.test/api/account/me', {
      headers: { cookie },
    }))
    const meBody = await me.json() as { sessionBoundary: { workspaceIds: string[] } }
    expect(meBody.sessionBoundary.workspaceIds).toContain(createBody.workspace.id)
  })

  it('lists only current users managed cloud workspaces and rejects unauthenticated creation', async () => {
    const store = new MemoryAccountStore()
    const cloudWorkspaces = new InMemoryManagedCloudWorkspaceStore()
    const firstUser = await store.createUser({ email: 'first@example.com', password: 'password123' })
    await store.markEmailVerified(firstUser.id)
    const secondUser = await store.createUser({ email: 'second@example.com', password: 'password123' })
    await store.markEmailVerified(secondUser.id)
    await cloudWorkspaces.createWorkspace({ ownerUserId: firstUser.id, name: 'First Cloud' })
    await cloudWorkspaces.createWorkspace({ ownerUserId: secondUser.id, name: 'Second Cloud' })
    const handler = createHandler(store, undefined, undefined, undefined, undefined, cloudWorkspaces)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'first@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const listWorkspaces = await handler.fetch(new Request('http://craft.test/api/account/workspaces', {
      headers: { cookie },
    }))
    expect(listWorkspaces.status).toBe(200)
    const listBody = await listWorkspaces.json() as { workspaces: Array<{ name: string; ownerUserId: string }> }
    expect(listBody.workspaces).toEqual([
      expect.objectContaining({ name: 'First Cloud', ownerUserId: firstUser.id }),
    ])

    const unauthenticatedCreate = await handler.fetch(new Request('http://craft.test/api/account/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Session' }),
    }))
    expect(unauthenticatedCreate.status).toBe(401)
  })

  it('returns account billing from the injected usage ledger without leaking other users balances', async () => {
    const store = new MemoryAccountStore()
    const ledger = new InMemoryAccountUsageLedger()
    const firstUser = await store.createUser({ email: 'first@example.com', password: 'password123' })
    await store.markEmailVerified(firstUser.id)
    const secondUser = await store.createUser({ email: 'second@example.com', password: 'password123' })
    await store.markEmailVerified(secondUser.id)
    await ledger.recordCredit({
      userId: firstUser.id,
      amountUnits: 1000,
      reason: 'manual_top_up',
      idempotencyKey: 'first-credit',
    })
    await ledger.recordCredit({
      userId: secondUser.id,
      amountUnits: 2222,
      reason: 'manual_top_up',
      idempotencyKey: 'second-credit',
    })
    await ledger.recordDebit({
      userId: firstUser.id,
      amountUnits: 125,
      reason: 'agent_usage',
      idempotencyKey: 'first-usage',
      metadata: { sessionId: 'session-1' },
    })
    const handler = createHandler(store, undefined, ledger)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'first@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const billing = await handler.fetch(new Request('http://craft.test/api/account/billing', {
      headers: { cookie },
    }))
    expect(billing.status).toBe(200)
    const body = await billing.json() as { balance: { userId: string; balanceUnits: number }; ledger: { entries: Array<{ userId: string; amountUnits: number }> } }

    expect(body.balance).toMatchObject({
      userId: firstUser.id,
      balanceUnits: 875,
    })
    expect(body.ledger.entries.map(entry => entry.userId)).toEqual([firstUser.id, firstUser.id])
    expect(body.ledger.entries.map(entry => entry.amountUnits)).toEqual([1000, 125])
  })

  it('creates DV.net top-up intents and credits confirmed webhooks once', async () => {
    const store = new MemoryAccountStore()
    const usageLedger = new InMemoryAccountUsageLedger()
    const created = await store.createUser({ email: 'user@example.com', password: 'password123' })
    await store.markEmailVerified(created.id)
    const handler = createHandler(store, undefined, usageLedger, undefined, undefined, undefined, {
      storeUuid: '0cbffe2b-d2a5-433d-94f5-77ce93a7c0eb',
      paymentBaseUrl: 'https://checkout.dv.net',
      webhookSecret: 'webhook-secret',
    })

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const topUp = await handler.fetch(new Request('http://craft.test/api/account/billing/top-up-intent', {
      method: 'POST',
      headers: { cookie },
    }))
    expect(topUp.status).toBe(200)
    const topUpBody = await topUp.json() as { status: string; provider: string; redirectUrl: string; billing: { balance: { currency: string } } }
    expect(topUpBody.status).toBe('ready')
    expect(topUpBody.provider).toBe('dv.net')
    expect(topUpBody.redirectUrl).toContain('https://checkout.dv.net/pay/store/0cbffe2b-d2a5-433d-94f5-77ce93a7c0eb/')
    expect(topUpBody.billing.balance.currency).toBe('USDT')
    expect(JSON.stringify(topUpBody)).not.toContain('webhook-secret')

    const rawBody = JSON.stringify({
      amount: '12.50',
      status: 'completed',
      type: 'PaymentReceived',
      transactions: {
        amount_usd: '12.50',
        bc_uniq_key: '1',
        tx_hash: 'tx-hash-http-1',
      },
      wallet: {
        store_external_id: created.id,
      },
    })
    const signature = createDvnetWebhookSignature(rawBody, 'webhook-secret')

    const webhook = await handler.fetch(new Request('http://craft.test/api/webhooks/dvnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dv-signature': signature },
      body: rawBody,
    }))
    expect(webhook.status).toBe(200)
    expect(await webhook.json()).toEqual({ success: true })

    const duplicate = await handler.fetch(new Request('http://craft.test/api/webhooks/dvnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dv-signature': signature },
      body: rawBody,
    }))
    expect(duplicate.status).toBe(200)
    expect((await usageLedger.getBalance(created.id)).balanceUnits).toBe(12_500_000)
    expect((await usageLedger.getBalance(created.id)).entries).toHaveLength(1)

    const invalid = await handler.fetch(new Request('http://craft.test/api/webhooks/dvnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dv-signature': 'bad' },
      body: rawBody,
    }))
    expect(invalid.status).toBe(400)
  })

  it('returns account events from injected history without leaking other users or raw user ids', async () => {
    const store = new MemoryAccountStore()
    const eventHistory = new InMemoryAccountEventHistory()
    const firstUser = await store.createUser({ email: 'first@example.com', password: 'password123' })
    await store.markEmailVerified(firstUser.id)
    const secondUser = await store.createUser({ email: 'second@example.com', password: 'password123' })
    await store.markEmailVerified(secondUser.id)
    await eventHistory.append({
      userId: firstUser.id,
      type: 'account.login',
      title: 'Signed in',
      details: { method: 'password', token: 'raw-token' },
    })
    await eventHistory.append({
      userId: secondUser.id,
      type: 'account.login',
      title: 'Other user signed in',
      details: { method: 'password' },
    })
    await eventHistory.append({
      userId: firstUser.id,
      type: 'billing.debit',
      title: 'Usage debit',
      details: { amountUnits: 125 },
    })
    const handler = createHandler(store, undefined, undefined, eventHistory)

    const login = await handler.fetch(new Request('http://craft.test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'first@example.com', password: 'password123' }),
    }))
    const cookie = login.headers.get('set-cookie') ?? ''
    expect(login.status).toBe(200)

    const events = await handler.fetch(new Request('http://craft.test/api/account/events', {
      headers: { cookie },
    }))
    expect(events.status).toBe(200)
    const body = await events.json() as { events: Array<Record<string, unknown>> }

    expect(body.events).toHaveLength(2)
    expect(body.events.map(event => event.type)).toEqual(['billing.debit', 'account.login'])
    expect(body.events.some(event => event.title === 'Other user signed in')).toBe(false)
    expect(body.events.some(event => 'userId' in event)).toBe(false)
    expect(body.events[1]!.details).toEqual({ method: 'password', token: '[redacted]' })
  })
})
