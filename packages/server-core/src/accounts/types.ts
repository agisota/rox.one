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

export interface AccountStore {
  migrate(): Promise<void>
  getUserCount(): Promise<number>
  createUser(input: CreateUserInput): Promise<PublicUser>
  getUserByEmail(email: string): Promise<PublicUser | null>
  verifyPassword(email: string, password: string): Promise<PublicUser | null>
  createSession(input: CreateAccountSessionInput): Promise<AccountSession>
  getSessionIdentity(sessionId: string): Promise<SessionIdentity | null>
  listSessions(userId: string): Promise<AccountSession[]>
  revokeSession(sessionId: string): Promise<void>
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
