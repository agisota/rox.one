import { randomBytes, randomUUID } from 'node:crypto'
import type { AccountCabinetOrganization } from './account-cabinet'

export type AccountTeamRole = 'owner' | 'admin' | 'member' | 'viewer'
export type AccountTeamStatus = 'active'

export interface AccountTeamOrganization {
  id: string
  name: string
  slug: string
  role: AccountTeamRole
  status: AccountTeamStatus
  createdAt: string
  updatedAt: string
}

export interface AccountTeamInvite {
  id: string
  organizationId: string
  code: string
  role: Exclude<AccountTeamRole, 'owner'>
  createdByUserId: string
  createdAt: string
  consumedAt: string | null
  consumedByUserId: string | null
}

export interface AccountTeamStore {
  createOrganization(input: { actorUserId: string; name: string }): Promise<AccountTeamOrganization>
  listOrganizations(userId: string): Promise<AccountTeamOrganization[]>
  createInvite(input: {
    actorUserId: string
    organizationId: string
    role?: Exclude<AccountTeamRole, 'owner'>
  }): Promise<AccountTeamInvite>
  joinWithInvite(input: { userId: string; code: string }): Promise<AccountTeamOrganization>
}

export class AccountTeamForbiddenError extends Error {
  constructor(message = 'Team action is not allowed') {
    super(message)
    this.name = 'AccountTeamForbiddenError'
  }
}

export class AccountTeamInviteError extends Error {
  constructor(message = 'Team invite is invalid or expired') {
    super(message)
    this.name = 'AccountTeamInviteError'
  }
}

function slugifyName(name: string, id: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'team'
  return `${base}-${id.slice(0, 8)}`
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Organization name is required')
  if (trimmed.length > 120) throw new Error('Organization name is too long')
  return trimmed
}

function canCreateInvite(role: AccountTeamRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

function copyOrganization(organization: AccountTeamOrganization): AccountTeamOrganization {
  return { ...organization }
}

function copyInvite(invite: AccountTeamInvite): AccountTeamInvite {
  return { ...invite }
}

export class InMemoryAccountTeamStore implements AccountTeamStore {
  private readonly organizations = new Map<string, Omit<AccountTeamOrganization, 'role'>>()
  private readonly memberships = new Map<string, Map<string, AccountTeamRole>>()
  private readonly invitesByCode = new Map<string, AccountTeamInvite>()

  async createOrganization(input: { actorUserId: string; name: string }): Promise<AccountTeamOrganization> {
    const name = normalizeName(input.name)
    const id = randomUUID()
    const now = new Date().toISOString()
    const organization = {
      id,
      name,
      slug: slugifyName(name, id),
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    }
    this.organizations.set(id, organization)
    this.memberships.set(id, new Map([[input.actorUserId, 'owner']]))
    return { ...organization, role: 'owner' }
  }

  async listOrganizations(userId: string): Promise<AccountTeamOrganization[]> {
    const result: AccountTeamOrganization[] = []
    for (const [organizationId, members] of this.memberships.entries()) {
      const role = members.get(userId)
      const organization = this.organizations.get(organizationId)
      if (!role || !organization) continue
      result.push({ ...organization, role })
    }
    return result.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map(copyOrganization)
  }

  async createInvite(input: {
    actorUserId: string
    organizationId: string
    role?: Exclude<AccountTeamRole, 'owner'>
  }): Promise<AccountTeamInvite> {
    const members = this.memberships.get(input.organizationId)
    const organization = this.organizations.get(input.organizationId)
    if (!members || !organization) throw new AccountTeamInviteError('Organization not found')
    if (!canCreateInvite(members.get(input.actorUserId) ?? null)) {
      throw new AccountTeamForbiddenError()
    }

    const invite: AccountTeamInvite = {
      id: randomUUID(),
      organizationId: input.organizationId,
      code: randomBytes(18).toString('base64url'),
      role: input.role ?? 'member',
      createdByUserId: input.actorUserId,
      createdAt: new Date().toISOString(),
      consumedAt: null,
      consumedByUserId: null,
    }
    this.invitesByCode.set(invite.code, invite)
    return copyInvite(invite)
  }

  async joinWithInvite(input: { userId: string; code: string }): Promise<AccountTeamOrganization> {
    const invite = this.invitesByCode.get(input.code.trim())
    if (!invite || invite.consumedAt) throw new AccountTeamInviteError()

    const organization = this.organizations.get(invite.organizationId)
    const members = this.memberships.get(invite.organizationId)
    if (!organization || !members) throw new AccountTeamInviteError()

    members.set(input.userId, invite.role)
    const consumed = {
      ...invite,
      consumedAt: new Date().toISOString(),
      consumedByUserId: input.userId,
    }
    this.invitesByCode.set(invite.code, consumed)
    return copyOrganization({ ...organization, role: invite.role })
  }
}

export function createAccountCabinetOrganizationsFromTeams(organizations: AccountTeamOrganization[]): { organizations: AccountCabinetOrganization[] } {
  return {
    organizations: organizations.map(organization => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: organization.role,
      status: organization.status,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    })),
  }
}
