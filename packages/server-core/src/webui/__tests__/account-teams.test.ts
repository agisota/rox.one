import { describe, expect, it } from 'bun:test'
import {
  AccountTeamForbiddenError,
  AccountTeamInviteError,
  InMemoryAccountTeamStore,
} from '../account-teams'

describe('account team model and RBAC', () => {
  it('creates organizations with the actor as owner and scopes listings per user', async () => {
    const teams = new InMemoryAccountTeamStore()

    const organization = await teams.createOrganization({
      actorUserId: 'user-owner',
      name: 'ROX Ops',
    })

    expect(organization).toMatchObject({
      name: 'ROX Ops',
      role: 'owner',
      status: 'active',
    })
    expect(organization.slug).toStartWith('rox-ops-')
    expect(await teams.listOrganizations('user-owner')).toEqual([organization])
    expect(await teams.listOrganizations('user-other')).toEqual([])
  })

  it('requires owner or admin role to create invites', async () => {
    const teams = new InMemoryAccountTeamStore()
    const organization = await teams.createOrganization({
      actorUserId: 'user-owner',
      name: 'ROX Ops',
    })

    await expect(teams.createInvite({
      actorUserId: 'user-other',
      organizationId: organization.id,
    })).rejects.toBeInstanceOf(AccountTeamForbiddenError)

    const invite = await teams.createInvite({
      actorUserId: 'user-owner',
      organizationId: organization.id,
    })

    expect(invite).toMatchObject({
      organizationId: organization.id,
      role: 'member',
      consumedAt: null,
    })
    expect(invite.code).toBeTruthy()
  })

  it('lets invitees join once and denies reused or unknown invite codes', async () => {
    const teams = new InMemoryAccountTeamStore()
    const organization = await teams.createOrganization({
      actorUserId: 'user-owner',
      name: 'ROX Ops',
    })
    const invite = await teams.createInvite({
      actorUserId: 'user-owner',
      organizationId: organization.id,
      role: 'viewer',
    })

    const joined = await teams.joinWithInvite({
      userId: 'user-member',
      code: invite.code,
    })

    expect(joined).toMatchObject({
      id: organization.id,
      role: 'viewer',
      status: 'active',
    })
    expect(await teams.listOrganizations('user-member')).toEqual([joined])

    await expect(teams.joinWithInvite({
      userId: 'user-other',
      code: invite.code,
    })).rejects.toBeInstanceOf(AccountTeamInviteError)

    await expect(teams.joinWithInvite({
      userId: 'user-other',
      code: 'missing-code',
    })).rejects.toBeInstanceOf(AccountTeamInviteError)
  })
})
