import { dirname } from 'path'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'

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

export interface FileAccountSessionStoreOptions {
  filePath: string
  safeStorage: SafeAccountSessionStorage
  now?: () => string
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

  async function removeUnsafeSessionFile() {
    await rm(options.filePath, { force: true })
  }

  return {
    async load() {
      if (!options.safeStorage.isEncryptionAvailable()) return null

      let encrypted: Buffer
      try {
        const encoded = await readFile(options.filePath, 'utf8')
        encrypted = Buffer.from(encoded, 'base64')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        await removeUnsafeSessionFile()
        return null
      }

      try {
        const decrypted = options.safeStorage.decryptString(encrypted)
        const parsed = parseAccountSession(JSON.parse(decrypted))
        if (!parsed) {
          await removeUnsafeSessionFile()
          return null
        }
        return parsed
      } catch {
        await removeUnsafeSessionFile()
        return null
      }
    },

    async save(session) {
      if (!options.safeStorage.isEncryptionAvailable()) return
      const normalized: AccountSession = {
        cookie: session.cookie,
        savedAt: now(),
        source: session.source,
      }
      const encrypted = options.safeStorage.encryptString(JSON.stringify(normalized))
      await mkdir(dirname(options.filePath), { recursive: true })
      await writeFile(options.filePath, Buffer.from(encrypted).toString('base64'), 'utf8')
    },

    async clear() {
      await removeUnsafeSessionFile()
    },
  }
}
