import { describe, expect, it } from 'bun:test'
import {
  InMemoryAccountEventHistory,
  toAccountCabinetEvents,
} from '../account-events'

describe('account event history', () => {
  it('records structured events newest first for each user', async () => {
    const history = new InMemoryAccountEventHistory()

    await history.append({
      userId: 'user-a',
      type: 'account.login',
      title: 'Signed in',
      details: { method: 'password' },
    })
    await history.append({
      userId: 'user-b',
      type: 'account.login',
      title: 'Other user signed in',
      details: { method: 'password' },
    })
    await history.append({
      userId: 'user-a',
      type: 'billing.debit',
      title: 'Usage debit',
      details: { amountUnits: 42 },
    })

    const events = await history.listForUser('user-a')

    expect(events).toHaveLength(2)
    expect(events.map(event => event.type)).toEqual(['billing.debit', 'account.login'])
    expect(events.every(event => event.userId === 'user-a')).toBe(true)
    expect(events[0]).toMatchObject({
      type: 'billing.debit',
      title: 'Usage debit',
      details: { amountUnits: 42 },
    })
  })

  it('redacts common secrets recursively before storing details', async () => {
    const history = new InMemoryAccountEventHistory()

    await history.append({
      userId: 'user-a',
      type: 'security.updated',
      title: 'Security settings changed',
      details: {
        token: 'raw-token',
        apiKey: 'raw-key',
        authorization: 'Bearer raw',
        nested: {
          password: 'raw-password',
          cookie: 'raw-cookie',
          visible: 'safe',
        },
        list: [{ secret: 'raw-secret' }],
      },
    })

    const [event] = await history.listForUser('user-a')

    expect(event!.details).toEqual({
      token: '[redacted]',
      apiKey: '[redacted]',
      authorization: '[redacted]',
      nested: {
        password: '[redacted]',
        cookie: '[redacted]',
        visible: 'safe',
      },
      list: [{ secret: '[redacted]' }],
    })
  })

  it('returns defensive copies and limits account cabinet output', async () => {
    const history = new InMemoryAccountEventHistory()
    await history.append({
      userId: 'user-a',
      type: 'account.profile_updated',
      title: 'Profile updated',
      details: { displayName: 'ROX User' },
    })

    const firstRead = await history.listForUser('user-a')
    firstRead[0]!.details.displayName = 'mutated'

    const secondRead = await history.listForUser('user-a')
    expect(secondRead[0]!.details).toEqual({ displayName: 'ROX User' })

    const cabinet = toAccountCabinetEvents(secondRead)
    expect(cabinet.events).toHaveLength(1)
    expect(cabinet.events[0]).toEqual({
      id: secondRead[0]!.id,
      type: 'account.profile_updated',
      title: 'Profile updated',
      details: { displayName: 'ROX User' },
      createdAt: secondRead[0]!.createdAt,
    })
    expect(cabinet.events[0]).not.toHaveProperty('userId')
  })
})
