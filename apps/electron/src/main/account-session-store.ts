import { dirname } from 'path'
import { mkdir, readFile, rm, writeFile as nodeWriteFile } from 'fs/promises'

export type AccountSessionSource = 'login' | 'register' | 'restore'

export interface AccountSession {
  cookie: string
  savedAt: string
  source: AccountSessionSource
}

export interface AccountSessionStore {
  load(): Promise<AccountSession | null>
  save(session: AccountSession): Promise<void>
  clear(): Promise<void>
}

export interface SafeAccountSessionStorage {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface AccountSessionLogger {
  info: (message: string, meta?: unknown) => void
  warn: (message: string, meta?: unknown) => void
  error: (message: string, meta?: unknown) => void
}

export interface FileAccountSessionStoreOptions {
  filePath: string
  safeStorage: SafeAccountSessionStorage
  now?: () => string
  logger?: AccountSessionLogger
  // Injectable for tests; defaults to `fs/promises.writeFile`.
  writeFile?: (path: string, contents: string, encoding: 'utf8') => Promise<void>
}

function parseAccountSession(value: unknown): AccountSession | null {
  if (!value || typeof value !== 'object') return null
  const session = value as Partial<AccountSession>
  if (typeof session.cookie !== 'string' || !session.cookie.startsWith('rox_session=')) return null
  if (typeof session.savedAt !== 'string') return null
  if (session.source !== 'login' && session.source !== 'register' && session.source !== 'restore') return null
  return {
    cookie: session.cookie,
    savedAt: session.savedAt,
    source: session.source,
  }
}

export function createFileAccountSessionStore(options: FileAccountSessionStoreOptions): AccountSessionStore {
  const now = options.now ?? (() => new Date().toISOString())
  const writeFile = options.writeFile ?? ((path, contents, encoding) => nodeWriteFile(path, contents, encoding))
  const logger = options.logger
  let warnedNoEncryption = false

  async function removeUnsafeSessionFile() {
    try {
      await rm(options.filePath, { force: true })
    } catch (error) {
      logger?.warn('[account-session] failed to remove unsafe session file', error)
    }
  }

  function warnEncryptionUnavailableOnce(reason: 'save' | 'load') {
    if (warnedNoEncryption) return
    warnedNoEncryption = true
    logger?.warn(
      `[account-session] safeStorage encryption unavailable; falling back to in-memory only session (during ${reason})`,
    )
  }

  return {
    async load() {
      if (!options.safeStorage.isEncryptionAvailable()) {
        warnEncryptionUnavailableOnce('load')
        return null
      }

      let encrypted: Buffer
      try {
        const encoded = await readFile(options.filePath, 'utf8')
        encrypted = Buffer.from(encoded, 'base64')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        logger?.warn('[account-session] failed to read persisted session; removing file', error)
        await removeUnsafeSessionFile()
        return null
      }

      try {
        const decrypted = options.safeStorage.decryptString(encrypted)
        const parsed = parseAccountSession(JSON.parse(decrypted))
        if (!parsed) {
          logger?.warn('[account-session] persisted session payload was invalid; removing file')
          await removeUnsafeSessionFile()
          return null
        }
        return parsed
      } catch (error) {
        logger?.warn('[account-session] decrypt or parse failed; removing file', error)
        await removeUnsafeSessionFile()
        return null
      }
    },

    async save(session) {
      if (!options.safeStorage.isEncryptionAvailable()) {
        warnEncryptionUnavailableOnce('save')
        return
      }
      const normalized: AccountSession = {
        cookie: session.cookie,
        savedAt: now(),
        source: session.source,
      }
      let encrypted: Buffer
      try {
        encrypted = options.safeStorage.encryptString(JSON.stringify(normalized))
      } catch (error) {
        logger?.error(
          '[account-session] safeStorage.encryptString threw; failing to persist (in-memory only)',
          error,
        )
        return
      }

      try {
        await mkdir(dirname(options.filePath), { recursive: true })
        await writeFile(options.filePath, Buffer.from(encrypted).toString('base64'), 'utf8')
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        logger?.error(
          `[account-session] failed to persist session file (${code ?? 'unknown error'}); falling back to in-memory only`,
          error,
        )
        // Best-effort cleanup so a half-written file is not left around.
        await removeUnsafeSessionFile()
      }
    },

    async clear() {
      await removeUnsafeSessionFile()
    },
  }
}
