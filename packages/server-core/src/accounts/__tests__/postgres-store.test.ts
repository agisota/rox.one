import { describe, expect, it } from 'bun:test'
import { createPostgresAccountStore } from '../postgres-store'

describe('PostgresAccountStore', () => {
  it('can be integration-tested when ROX_DATABASE_URL is provided', async () => {
    if (!process.env.ROX_DATABASE_URL) {
      expect(process.env.ROX_DATABASE_URL).toBeUndefined()
      return
    }

    const store = createPostgresAccountStore({ connectionString: process.env.ROX_DATABASE_URL })
    await store.migrate()
    const email = `test-${Date.now()}@example.com`
    const user = await store.createUser({ email, password: 'password123', displayName: 'Test User' })
    const verified = await store.verifyPassword(email, 'password123')
    expect(verified?.id).toBe(user.id)

    const session = await store.createSession({ userId: user.id })
    const identity = await store.getSessionIdentity(session.id)
    expect(identity?.userId).toBe(user.id)

    await store.revokeSession(session.id)
    expect(await store.getSessionIdentity(session.id)).toBeNull()
    await store.close?.()
  })
})
