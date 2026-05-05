import { describe, expect, it } from 'bun:test'
import {
  InMemoryTeamChatStore,
  TeamChatForbiddenError,
  TeamChatValidationError,
  canReadTeamMessages,
  canWriteTeamMessages,
} from '../team-chat'

describe('team chat collaboration model and RBAC', () => {
  it('creates immutable team messages with refs, labels, and workspace filtering', async () => {
    const chat = new InMemoryTeamChatStore()

    const first = await chat.appendMessage({
      actorUserId: 'user-owner',
      actorRole: 'owner',
      teamId: 'team-a',
      workspaceId: 'workspace-a',
      body: '  Review the blocker map before final verification.  ',
      refs: [
        { type: 'workspace', id: 'workspace-a', title: 'Launch Space' },
        { type: 'artifact', id: 'artifact-final-fix-plan' },
      ],
      labels: [' Review ', 'launch', 'review'],
    })
    const second = await chat.appendMessage({
      actorUserId: 'user-member',
      actorRole: 'member',
      teamId: 'team-a',
      body: 'Team-level note',
    })
    await chat.appendMessage({
      actorUserId: 'user-owner',
      actorRole: 'owner',
      teamId: 'team-b',
      body: 'Other team note',
    })

    expect(first).toMatchObject({
      teamId: 'team-a',
      workspaceId: 'workspace-a',
      authorUserId: 'user-owner',
      body: 'Review the blocker map before final verification.',
      labels: ['review', 'launch'],
    })
    expect(first.refs).toEqual([
      { type: 'workspace', id: 'workspace-a', title: 'Launch Space' },
      { type: 'artifact', id: 'artifact-final-fix-plan' },
    ])
    expect(first.id).toBeTruthy()
    expect(first.createdAt).toBeTruthy()

    const allTeamMessages = await chat.listMessages({ actorRole: 'viewer', teamId: 'team-a' })
    expect(allTeamMessages.map(message => message.id)).toEqual([first.id, second.id])

    const workspaceMessages = await chat.listMessages({
      actorRole: 'viewer',
      teamId: 'team-a',
      workspaceId: 'workspace-a',
    })
    expect(workspaceMessages).toEqual([first])

    first.refs[0]!.title = 'mutated'
    first.labels.push('mutated')
    const refetched = await chat.listMessages({ actorRole: 'owner', teamId: 'team-a', workspaceId: 'workspace-a' })
    expect(refetched[0]!.refs[0]!.title).toBe('Launch Space')
    expect(refetched[0]!.labels).toEqual(['review', 'launch'])
  })

  it('enforces read/write role policy without letting paid capacity bypass quality gates', async () => {
    const chat = new InMemoryTeamChatStore()

    expect(canReadTeamMessages('viewer')).toBe(true)
    expect(canWriteTeamMessages('owner')).toBe(true)
    expect(canWriteTeamMessages('admin')).toBe(true)
    expect(canWriteTeamMessages('member')).toBe(true)
    expect(canWriteTeamMessages('viewer')).toBe(false)
    expect(canWriteTeamMessages('viewer', { viewerCanWrite: true })).toBe(true)

    await expect(chat.appendMessage({
      actorUserId: 'user-viewer',
      actorRole: 'viewer',
      teamId: 'team-a',
      body: 'viewer write',
    })).rejects.toBeInstanceOf(TeamChatForbiddenError)

    const allowed = await chat.appendMessage({
      actorUserId: 'user-viewer',
      actorRole: 'viewer',
      teamId: 'team-a',
      body: 'viewer write with explicit policy',
      policy: { viewerCanWrite: true },
    })
    expect(allowed.authorUserId).toBe('user-viewer')
  })

  it('rejects empty body, malformed refs, and invalid labels', async () => {
    const chat = new InMemoryTeamChatStore()

    await expect(chat.appendMessage({
      actorUserId: 'user-owner',
      actorRole: 'owner',
      teamId: 'team-a',
      body: ' ',
    })).rejects.toBeInstanceOf(TeamChatValidationError)

    await expect(chat.appendMessage({
      actorUserId: 'user-owner',
      actorRole: 'owner',
      teamId: 'team-a',
      body: 'bad ref',
      refs: [{ type: 'artifact', id: '' }],
    })).rejects.toBeInstanceOf(TeamChatValidationError)

    await expect(chat.appendMessage({
      actorUserId: 'user-owner',
      actorRole: 'owner',
      teamId: 'team-a',
      body: 'bad label',
      labels: ['valid', ''],
    })).rejects.toBeInstanceOf(TeamChatValidationError)
  })
})
