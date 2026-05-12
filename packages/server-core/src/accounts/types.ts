export type AccountRole = 'user' | 'admin'
export type AccountStatus = 'pending_email_verification' | 'active' | 'disabled'
export type AccountAuthMethod = 'password' | 'email_verification' | 'password_reset'
export type EmailTokenPurpose = 'verify_email' | 'password_reset' | 'change_email'

export interface PublicUser {
  id: string
  email: string
  displayName: string | null
  role: AccountRole
  status: AccountStatus
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountSession {
  id: string
  userId: string
  userAgent: string | null
  ipAddress: string | null
  authMethod?: AccountAuthMethod
  createdAt: string
  expiresAt: string
  revokedAt: string | null
}

export interface SessionIdentity {
  userId: string
  sessionId: string
  email: string
  displayName: string | null
  role: AccountRole
}

export interface CreateUserInput {
  email: string
  password: string
  displayName?: string | null
}

export interface CreateAccountSessionInput {
  userId: string
  userAgent?: string | null
  ipAddress?: string | null
  authMethod?: AccountAuthMethod
  expiresAt?: Date
}

export interface CreateEmailTokenInput {
  userId: string
  purpose: EmailTokenPurpose
  expiresAt?: Date
}

export interface CreatedEmailToken {
  rawToken: string
  expiresAt: string
}

/**
 * Outcome of a {@link AccountStore.revokeSession} call.
 *
 * `revoked` is `true` exactly when the call transitioned the row from active
 * to revoked. Concurrent callers therefore see at most one `revoked: true`,
 * making it safe to use as a compare-and-swap gate before minting a
 * replacement session (Slice 4 atomic rotation).
 *
 * `sessionId` echoes the input session id when the row existed at all, and
 * `null` when no such session was found (e.g. already deleted).
 */
export interface RevokeSessionResult {
  revoked: boolean
  sessionId: string | null
}

export interface AccountStore {
  migrate(): Promise<void>
  getUserCount(): Promise<number>
  createUser(input: CreateUserInput): Promise<PublicUser>
  getUserByEmail(email: string): Promise<PublicUser | null>
  verifyPassword(email: string, password: string): Promise<PublicUser | null>
  createSession(input: CreateAccountSessionInput): Promise<AccountSession>
  getSessionIdentity(sessionId: string): Promise<SessionIdentity | null>
  listSessions(userId: string): Promise<AccountSession[]>
  /**
   * Revoke a session by compare-and-swap. Returns `{ revoked: true }` only on
   * the call that actually transitions the row from active to revoked, so
   * concurrent rotators can safely gate replacement-session creation on this
   * boolean (Slice 4 atomic rotation).
   */
  revokeSession(sessionId: string): Promise<RevokeSessionResult>
  revokeUserSessions(userId: string): Promise<void>
  revokeOtherSessions(userId: string, currentSessionId: string): Promise<void>
  getUser(userId: string): Promise<PublicUser | null>
  updateUser(userId: string, patch: { displayName?: string | null }): Promise<PublicUser>
  markEmailVerified(userId: string): Promise<PublicUser>
  createEmailToken(input: CreateEmailTokenInput): Promise<CreatedEmailToken>
  consumeEmailToken(purpose: EmailTokenPurpose, rawToken: string): Promise<PublicUser | null>
  setPassword(userId: string, newPassword: string): Promise<void>
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>
  grantWorkspaceOwner(userId: string, workspaceId: string): Promise<void>
  isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean>
  listWorkspaceIds(userId: string): Promise<string[]>
  close?(): Promise<void>
}

export class AccountConflictError extends Error {
  constructor(message = 'Account already exists') {
    super(message)
    this.name = 'AccountConflictError'
  }
}

export class AccountAuthError extends Error {
  constructor(message = 'Invalid account credentials') {
    super(message)
    this.name = 'AccountAuthError'
  }
}
