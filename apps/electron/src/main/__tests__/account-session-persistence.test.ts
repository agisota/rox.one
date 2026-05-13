import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createAccountApiProxy } from '../account-api'
import {
  createFileAccountSessionStore,
  type AccountSessionStore,
  type SafeAccountSessionStorage,
} from '../account-session-store'

type LogEntry = { level: 'info' | 'warn' | 'error'; message: string; meta?: unknown }

function createCapturingLogger() {
  const entries: LogEntry[] = []
  return {
    entries,
    logger: {
      info: (message: string, meta?: unknown) => entries.push({ level: 'info', message, meta }),
      warn: (message: string, meta?: unknown) => entries.push({ level: 'warn', message, meta }),
      error: (message: string, meta?: unknown) => entries.push({ level: 'error', message, meta }),
    },
  }
}

function createFakeSafeStorage(): SafeAccountSessionStorage {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) => Buffer.from(`encrypted:${plainText}`, 'utf8'),
    decryptString: (encrypted) => {
      const text = Buffer.from(encrypted).toString('utf8')
      if (!text.startsWith('encrypted:')) throw new Error('bad encrypted payload')
      return text.slice('encrypted:'.length)
    },
  }
}

describe('account session persistence', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rox-m4-persistence-'))
    filePath = join(dir, 'account-session.enc')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  // Case 1: Login captures rox_session, encrypts via safeStorage.encryptString(),
  // writes to userData/session.enc
  test('case 1: login encrypts rox_session via safeStorage and writes the persistence file', async () => {
    const safeStorage = createFakeSafeStorage()
    const store = createFileAccountSessionStore({
      filePath,
      safeStorage,
      now: () => '2026-05-13T00:00:00.000Z',
    })

    const proxy = createAccountApiProxy({
      sessionStore: store,
      fetch: async (url) => {
        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }
        return new Response('{}', { status: 200 })
      },
    })

    await proxy.request('/api/auth/login', { method: 'POST' })

    const raw = await readFile(filePath, 'utf8')
    expect(raw).not.toContain('session-token')
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    expect(decoded.startsWith('encrypted:')).toBe(true)
    expect(decoded).toContain('rox_session=session-token')
  })

  // Case 2: On startup, file exists and decrypts -> hydrate cookie into proxy
  // and confirm via /api/account/me request carrying the hydrated Cookie header.
  test('case 2: startup hydrates persisted cookie and forwards it to /api/account/me', async () => {
    const safeStorage = createFakeSafeStorage()

    // Seed the file as if a prior session had been saved.
    const seedStore = createFileAccountSessionStore({
      filePath,
      safeStorage,
      now: () => '2026-05-13T00:00:00.000Z',
    })
    await seedStore.save({ cookie: 'rox_session=restored-token', savedAt: '', source: 'login' })

    // New proxy + store instance (simulates a fresh app startup).
    const startupStore = createFileAccountSessionStore({ filePath, safeStorage })
    const requestHeaders: Array<Record<string, string> | undefined> = []
    const proxy = createAccountApiProxy({
      sessionStore: startupStore,
      fetch: async (_url, init) => {
        requestHeaders.push(init?.headers as Record<string, string> | undefined)
        return new Response(JSON.stringify({ mode: 'account', user: { id: 'u1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    const me = await proxy.request<{ mode: string; user: { id: string } }>('/api/account/me')

    expect(me).toEqual({ mode: 'account', user: { id: 'u1' } })
    expect(requestHeaders).toHaveLength(1)
    expect(requestHeaders[0]?.Cookie).toBe('rox_session=restored-token')
  })

  // Case 3: On logout, the persistence file is deleted.
  test('case 3: logout clears the persisted session file from disk', async () => {
    const safeStorage = createFakeSafeStorage()
    const store = createFileAccountSessionStore({ filePath, safeStorage })

    const proxy = createAccountApiProxy({
      sessionStore: store,
      fetch: async (url) => {
        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await proxy.request('/api/auth/login', { method: 'POST' })
    await stat(filePath) // exists after login

    await proxy.request('/api/auth/logout', { method: 'POST' })

    await expect(stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  // Case 4: Corrupt session file (bad bytes / decrypt failure)
  // -> fail closed: delete file, clear proxy state, treat as logged-out.
  test('case 4: corrupt persisted session is deleted, fails closed, and no auth cookie is sent', async () => {
    const safeStorage = createFakeSafeStorage()
    await writeFile(filePath, Buffer.from('not-encrypted-payload').toString('base64'), 'utf8')

    const store = createFileAccountSessionStore({ filePath, safeStorage })
    const requestHeaders: Array<Record<string, string> | undefined> = []
    const proxy = createAccountApiProxy({
      sessionStore: store,
      fetch: async (_url, init) => {
        requestHeaders.push(init?.headers as Record<string, string> | undefined)
        return new Response(JSON.stringify({ mode: 'guest' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    await proxy.request('/api/account/me')

    await expect(stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(requestHeaders).toHaveLength(1)
    expect(requestHeaders[0]?.Cookie).toBeUndefined()
  })

  // Case 5: safeStorage.isEncryptionAvailable() false at startup
  // -> fall back to in-memory-only and log a warning.
  test('case 5: missing safeStorage encryption falls back to in-memory and logs a warning', async () => {
    const { entries, logger } = createCapturingLogger()
    const store = createFileAccountSessionStore({
      filePath,
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: () => Buffer.from(''),
        decryptString: () => '',
      },
      logger,
    })

    const proxy = createAccountApiProxy({
      sessionStore: store,
      fetch: async (url) => {
        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await proxy.request('/api/auth/login', { method: 'POST' })

    await expect(stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(entries.some((e) => e.level === 'warn' && /encryption/i.test(e.message))).toBe(true)
  })

  // Case 6: File-system errors (EACCES, ENOSPC) during write
  // -> log + revert to in-memory (don't crash the app). The same proxy must
  // still serve the cookie in subsequent same-process requests.
  test('case 6: EACCES write error is logged and falls back to in-memory without crashing', async () => {
    const { entries, logger } = createCapturingLogger()
    const failingSafeStorage = createFakeSafeStorage()

    // Inject an underlying writer that throws EACCES so the store cannot persist.
    // We override the file path's parent directory access by routing writes
    // through a failing fs adapter: simplest is to inject a fileWriter option.
    const store: AccountSessionStore = createFileAccountSessionStore({
      filePath,
      safeStorage: failingSafeStorage,
      logger,
      // Inject a write hook that simulates EACCES.
      writeFile: async () => {
        const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException
        err.code = 'EACCES'
        throw err
      },
    })

    const requestHeaders: Array<Record<string, string> | undefined> = []
    const proxy = createAccountApiProxy({
      sessionStore: store,
      fetch: async (url, init) => {
        requestHeaders.push(init?.headers as Record<string, string> | undefined)
        if (String(url).endsWith('/api/auth/login')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'set-cookie': 'rox_session=session-token; Path=/; HttpOnly' },
          })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    // Must not throw — the FS error is contained inside the store.
    await proxy.request('/api/auth/login', { method: 'POST' })
    await proxy.request('/api/account/me')

    await expect(stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(requestHeaders[1]?.Cookie).toBe('rox_session=session-token')
    expect(entries.some((e) => e.level === 'error' && /EACCES|persist/i.test(e.message))).toBe(true)
  })

  test('case 6b: ENOSPC write error is logged and falls back to in-memory without crashing', async () => {
    const { entries, logger } = createCapturingLogger()
    const store: AccountSessionStore = createFileAccountSessionStore({
      filePath,
      safeStorage: createFakeSafeStorage(),
      logger,
      writeFile: async () => {
        const err = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException
        err.code = 'ENOSPC'
        throw err
      },
    })

    await expect(
      store.save({ cookie: 'rox_session=token', savedAt: '', source: 'login' }),
    ).resolves.toBeUndefined()

    expect(entries.some((e) => e.level === 'error' && /ENOSPC|persist/i.test(e.message))).toBe(true)
  })
})
