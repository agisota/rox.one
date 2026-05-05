import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createFileAccountSessionStore, type SafeAccountSessionStorage } from '../account-session-store'

function createFakeSafeStorage(): SafeAccountSessionStorage {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) => Buffer.from(`encrypted:${plainText}`, 'utf8'),
    decryptString: (encrypted) => {
      const text = Buffer.from(encrypted).toString('utf8')
      if (!text.startsWith('encrypted:')) {
        throw new Error('bad encrypted payload')
      }
      return text.slice('encrypted:'.length)
    },
  }
}

describe('file account session store', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rox-account-session-'))
    filePath = join(dir, 'account-session.enc')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('saves and loads an encrypted account session', async () => {
    const store = createFileAccountSessionStore({
      filePath,
      safeStorage: createFakeSafeStorage(),
      now: () => '2026-05-05T00:00:00.000Z',
    })

    await store.save({ cookie: 'rox_session=session-token', savedAt: 'ignored', source: 'login' })

    const raw = await readFile(filePath, 'utf8')
    expect(raw).not.toContain('session-token')
    expect(await store.load()).toEqual({
      cookie: 'rox_session=session-token',
      savedAt: '2026-05-05T00:00:00.000Z',
      source: 'login',
    })
  })

  test('removes corrupt persisted sessions and fails closed', async () => {
    const store = createFileAccountSessionStore({
      filePath,
      safeStorage: createFakeSafeStorage(),
    })

    await writeFile(filePath, Buffer.from('not-json').toString('base64'), 'utf8')

    await expect(store.load()).resolves.toBeNull()
    await expect(readFile(filePath, 'utf8')).rejects.toThrow()
  })

  test('does not persist when encryption is unavailable', async () => {
    const store = createFileAccountSessionStore({
      filePath,
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from(''),
        decryptString: () => '',
      },
    })

    await store.save({ cookie: 'rox_session=session-token', savedAt: 'ignored', source: 'login' })

    await expect(store.load()).resolves.toBeNull()
    await expect(readFile(filePath, 'utf8')).rejects.toThrow()
  })
})
