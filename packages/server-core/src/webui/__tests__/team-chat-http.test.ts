import { afterEach, describe, expect, it } from 'bun:test'
import { createAccountSessionToken } from '../auth'
import { createWebuiHandler, type WebuiHandler } from '../http-server'
import { InMemoryAccountTeamStore } from '../account-teams'
import { InMemoryTeamChatStore } from '../team-chat'
import type { AccountStore, SessionIdentity } from '../../accounts'

const SECRET = 'test-secret-with-enough-length'

function createAccountStore(identities: SessionIdentity[]): AccountStore {
  const bySessionId = new Map(identities.map(identity => [identity.sessionId, identity]))
  return {
    async getSessionIdentity(sessionId: string): Promise<SessionIdentity | null> {
      return bySessionId.get(sessionId) ?? null
    },
  } as AccountStore
}

async function cookieFor(identity: SessionIdentity): Promise<string> {
  return `craft_session=${await createAccountSessionToken(SECRET, identity)}`
}

describe('team chat HTTP collaboration routes', () => {
  const handlers: WebuiHandler[] = []

  afterEach(() => {
    for (const handler of handlers.splice(0)) handler.dispose()
  })

  function createHandler(input: {
    accountStore: AccountStore
    teamStore: InMemoryAccountTeamStore
    chatStore: InMemoryTeamChatStore
  }): WebuiHandler {
    const handler = createWebuiHandler({
      webuiDir: '/tmp/does-not-need-static-assets',
      secret: SECRET,
      wsProtocol: 'ws',
      wsPort: 9100,
      getHealthCheck: () => ({ status: 'ok' }),
      logger: { info() {}, warn() {}, error() {}, debug() {} } as any,
      accountStore: input.accountStore,
      accountTeamStore: input.teamStore,
      accountTeamChatStore: input.chatStore,
    })
    handlers.push(handler)
    return handler
  }

  it('lets members create and list team messages while denying viewer writes and outsiders', async () => {
    const owner: SessionIdentity = {
      userId: 'user-owner',
      sessionId: 'session-owner',
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'user',
    }
    const viewer: SessionIdentity = {
      userId: 'user-viewer',
      sessionId: 'session-viewer',
      email: 'viewer@example.com',
      displayName: 'Viewer',
      role: 'user',
    }
    const outsider: SessionIdentity = {
      userId: 'user-outsider',
      sessionId: 'session-outsider',
      email: 'outsider@example.com',
      displayName: 'Outsider',
      role: 'user',
    }
    const accountStore = createAccountStore([owner, viewer, outsider])
    const teamStore = new InMemoryAccountTeamStore()
    const chatStore = new InMemoryTeamChatStore()
    const team = await teamStore.createOrganization({ actorUserId: owner.userId, name: 'ROX Ops' })
    const invite = await teamStore.createInvite({
      actorUserId: owner.userId,
      organizationId: team.id,
      role: 'viewer',
    })
    await teamStore.joinWithInvite({ userId: viewer.userId, code: invite.code })
    const handler = createHandler({ accountStore, teamStore, chatStore })

    const create = await handler.fetch(new Request(`http://craft.test/api/account/teams/${team.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: await cookieFor(owner),
      },
      body: JSON.stringify({
        workspaceId: 'workspace-a',
        body: 'Launch review note',
        refs: [{ type: 'artifact', id: 'artifact-final-fix-plan' }],
        labels: ['Review'],
      }),
    }))

    expect(create.status).toBe(201)
    const created = await create.json() as { message: { body: string; labels: string[] } }
    expect(created.message).toMatchObject({
      body: 'Launch review note',
      labels: ['review'],
    })

    const list = await handler.fetch(new Request(`http://craft.test/api/account/teams/${team.id}/messages?workspaceId=workspace-a`, {
      headers: { cookie: await cookieFor(viewer) },
    }))
    expect(list.status).toBe(200)
    const listed = await list.json() as { messages: Array<{ body: string; refs: unknown[] }> }
    expect(listed.messages).toHaveLength(1)
    expect(listed.messages[0]).toMatchObject({
      body: 'Launch review note',
      refs: [{ type: 'artifact', id: 'artifact-final-fix-plan' }],
    })

    const deniedWrite = await handler.fetch(new Request(`http://craft.test/api/account/teams/${team.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: await cookieFor(viewer),
      },
      body: JSON.stringify({ body: 'viewer write should be blocked' }),
    }))
    expect(deniedWrite.status).toBe(403)

    const deniedRead = await handler.fetch(new Request(`http://craft.test/api/account/teams/${team.id}/messages`, {
      headers: { cookie: await cookieFor(outsider) },
    }))
    expect(deniedRead.status).toBe(403)
  })
})
