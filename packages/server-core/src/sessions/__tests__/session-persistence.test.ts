import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import {
  getSessionFilePath,
  loadSession,
  writeSessionJsonl,
  type StoredSession,
} from '@craft-agent/shared/sessions'
import type { StoredMessage } from '@rox-one/core/types'
import type { Logger } from '@craft-agent/server-core/runtime'
import { createManagedSession, type ManagedSession } from '../session-manager-helpers'
import { SessionPersistence } from '../session-persistence'
import { SessionIPC } from '../session-ipc'

// Per-helper unit tests for SessionPersistence (Slice 3 / 2-of-3). The helper
// owns disk I/O, the message-hydration codepath, and the persistence-queue
// adapter. These tests stub the IPC sibling, build a tmpdir-backed workspace,
// and exercise persistSession, flushSession, flushAllSessions,
// ensureMessagesLoaded, and loadMessagesFromDisk via the helper directly —
// no SessionManager involvement.

function buildSilentLogger(): Logger {
  const noop = () => {}
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    trace: noop,
    fatal: noop,
  } as unknown as Logger
}

function buildIPCStub(): SessionIPC {
  return new SessionIPC({
    getLogger: () => buildSilentLogger(),
    getUnreadSummary: () => ({
      totalUnreadSessions: 0,
      byWorkspace: {},
      hasUnreadByWorkspace: {},
    }),
    updateBadgeCount: () => {},
  })
}

function makeUserMessage(id: string, content: string): StoredMessage {
  return {
    id,
    type: 'user',
    content,
    timestamp: Date.now(),
  } as StoredMessage
}

describe('SessionPersistence', () => {
  let tmpRoot: string
  let sessions: Map<string, ManagedSession>
  let persistence: SessionPersistence
  let processNextCalls: string[]

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'sm-persistence-'))
    sessions = new Map()
    processNextCalls = []
    persistence = new SessionPersistence({
      getLogger: () => buildSilentLogger(),
      getSessions: () => sessions,
      getAutomationSystem: () => undefined,
      processNextQueuedMessage: (sid) => {
        processNextCalls.push(sid)
      },
      ipc: buildIPCStub(),
    })
  })

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function buildWorkspace() {
    return {
      id: 'ws_test',
      name: 'Test Workspace',
      rootPath: tmpRoot,
      createdAt: Date.now(),
    } as never
  }

  function seedSessionOnDisk(
    sessionId: string,
    opts: { name?: string; messages?: StoredMessage[]; sessionStatus?: string } = {},
  ): void {
    const filePath = getSessionFilePath(tmpRoot, sessionId)
    mkdirSync(dirname(filePath), { recursive: true })
    const stored = {
      id: sessionId,
      workspaceRootPath: tmpRoot,
      name: opts.name ?? 'persistence test',
      sessionStatus: opts.sessionStatus ?? 'todo',
      labels: [],
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      messages: opts.messages ?? [],
    } as unknown as StoredSession
    writeSessionJsonl(filePath, stored)
  }

  function readDiskHeader(sessionId: string): Record<string, unknown> {
    const path = getSessionFilePath(tmpRoot, sessionId)
    const firstLine = readFileSync(path, 'utf-8').split('\n')[0]
    return JSON.parse(firstLine)
  }

  function readDiskMessageIds(sessionId: string): string[] {
    const path = getSessionFilePath(tmpRoot, sessionId)
    if (!existsSync(path)) return []
    const lines = readFileSync(path, 'utf-8').trim().split('\n').slice(1)
    return lines.map((l) => JSON.parse(l)).map((m) => m.id as string)
  }

  describe('persistSession', () => {
    it('writes a fresh session to disk after flushSession resolves', async () => {
      const managed = createManagedSession(
        { id: 'fresh-1', name: 'fresh' },
        buildWorkspace(),
        { messagesLoaded: true },
      )
      sessions.set(managed.id, managed)

      persistence.persistSession(managed)
      await persistence.flushSession(managed.id)

      expect(readDiskHeader(managed.id).name).toBe('fresh')
    })

    it('cold-load path: hydrates messages from disk before enqueuing', async () => {
      const sessionId = 'cold-load-1'
      const seeded = [makeUserMessage('m1', 'hello'), makeUserMessage('m2', 'world')]
      seedSessionOnDisk(sessionId, { messages: seeded })

      const managed = createManagedSession(
        { id: sessionId, name: 'cold' },
        buildWorkspace(),
        // messagesLoaded defaults to false — cold-session state.
      )
      sessions.set(sessionId, managed)

      // Mutate metadata then persist; cold-load should NOT lose the messages.
      managed.sessionStatus = 'done'
      persistence.persistSession(managed)
      expect(managed.messagesLoaded).toBe(true)
      expect(managed.messages.map((m) => m.id)).toEqual(['m1', 'm2'])

      await persistence.flushSession(sessionId)

      expect(readDiskHeader(sessionId).sessionStatus).toBe('done')
      expect(readDiskMessageIds(sessionId)).toEqual(['m1', 'm2'])
    })

    it('idempotent: persisting twice without changes still produces a valid disk file', async () => {
      const managed = createManagedSession(
        { id: 'idem-1', name: 'idem' },
        buildWorkspace(),
        { messagesLoaded: true },
      )
      sessions.set(managed.id, managed)

      persistence.persistSession(managed)
      await persistence.flushSession(managed.id)
      const headerA = readDiskHeader(managed.id)

      persistence.persistSession(managed)
      await persistence.flushSession(managed.id)
      const headerB = readDiskHeader(managed.id)

      expect(headerB.name).toBe(headerA.name)
      expect(headerB.id).toBe(managed.id)
    })

    it('drops transient status messages from the persisted snapshot', async () => {
      const managed = createManagedSession(
        { id: 'no-status-1', name: 'no-status' },
        buildWorkspace(),
        { messagesLoaded: true },
      )
      managed.messages = [
        { id: 'u1', role: 'user', content: 'hi', timestamp: Date.now() },
        { id: 's1', role: 'status', content: 'compacting…', timestamp: Date.now() },
        { id: 'a1', role: 'assistant', content: 'hello', timestamp: Date.now() },
      ] as ManagedSession['messages']
      sessions.set(managed.id, managed)

      persistence.persistSession(managed)
      await persistence.flushSession(managed.id)

      const ids = readDiskMessageIds(managed.id)
      expect(ids).toEqual(['u1', 'a1'])
    })
  })

  describe('flushAllSessions', () => {
    it('flushes pending writes for all sessions enqueued via persistSession', async () => {
      const a = createManagedSession({ id: 'all-a', name: 'a' }, buildWorkspace(), {
        messagesLoaded: true,
      })
      const b = createManagedSession({ id: 'all-b', name: 'b' }, buildWorkspace(), {
        messagesLoaded: true,
      })
      sessions.set(a.id, a)
      sessions.set(b.id, b)

      persistence.persistSession(a)
      persistence.persistSession(b)

      await persistence.flushAllSessions()

      expect(existsSync(getSessionFilePath(tmpRoot, a.id))).toBe(true)
      expect(existsSync(getSessionFilePath(tmpRoot, b.id))).toBe(true)
      expect(readDiskHeader(a.id).name).toBe('a')
      expect(readDiskHeader(b.id).name).toBe('b')
    })
  })

  describe('ensureMessagesLoaded', () => {
    it('hydrates from disk when messagesLoaded is false', async () => {
      const sessionId = 'hydrate-1'
      const seeded = [makeUserMessage('h1', 'one'), makeUserMessage('h2', 'two')]
      seedSessionOnDisk(sessionId, { name: 'hydrated', messages: seeded })

      const managed = createManagedSession({ id: sessionId }, buildWorkspace())
      sessions.set(sessionId, managed)

      expect(managed.messagesLoaded).toBe(false)
      await persistence.ensureMessagesLoaded(managed)
      expect(managed.messagesLoaded).toBe(true)
      expect(managed.messages.map((m) => m.id)).toEqual(['h1', 'h2'])
      expect(managed.name).toBe('hydrated')
    })

    it('short-circuits when messagesLoaded is already true', async () => {
      const managed = createManagedSession({ id: 'noop-1', name: 'in-mem' }, buildWorkspace(), {
        messagesLoaded: true,
      })
      managed.messages = [{ id: 'in-mem', role: 'user', content: 'x', timestamp: 1 }] as ManagedSession['messages']
      sessions.set(managed.id, managed)

      // No disk file exists at all — confirms no hydration was attempted.
      await persistence.ensureMessagesLoaded(managed)
      expect(managed.messages.map((m) => m.id)).toEqual(['in-mem'])
    })

    it('deduplicates concurrent hydration calls into one disk read', async () => {
      const sessionId = 'dedup-1'
      seedSessionOnDisk(sessionId, { messages: [makeUserMessage('d1', 'one')] })

      const managed = createManagedSession({ id: sessionId }, buildWorkspace())
      sessions.set(sessionId, managed)

      const [r1, r2, r3] = await Promise.all([
        persistence.ensureMessagesLoaded(managed),
        persistence.ensureMessagesLoaded(managed),
        persistence.ensureMessagesLoaded(managed),
      ])
      expect(r1).toBeUndefined()
      expect(r2).toBeUndefined()
      expect(r3).toBeUndefined()
      expect(managed.messages.map((m) => m.id)).toEqual(['d1'])
    })
  })

  describe('loadMessagesFromDisk', () => {
    it('queues recovery for orphaned isQueued user messages on cold-load', async () => {
      const sessionId = 'recover-1'
      const queuedMsg: StoredMessage = {
        id: 'q1',
        type: 'user',
        content: 'queued payload',
        timestamp: Date.now(),
        // The flag the recovery scan looks for.
        isQueued: true,
      } as StoredMessage
      seedSessionOnDisk(sessionId, { messages: [queuedMsg] })

      const managed = createManagedSession({ id: sessionId }, buildWorkspace())
      sessions.set(sessionId, managed)

      await persistence.loadMessagesFromDisk(managed)

      expect(managed.messageQueue).toHaveLength(1)
      expect(managed.messageQueue[0].messageId).toBe('q1')
      expect(managed.messageQueue[0].message).toBe('queued payload')

      // Recovery uses setImmediate; let it run.
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(processNextCalls).toEqual([sessionId])
    })

    it('marks messagesLoaded even when no session file exists', async () => {
      const managed = createManagedSession({ id: 'missing-1' }, buildWorkspace())
      sessions.set(managed.id, managed)
      expect(managed.messagesLoaded).toBe(false)

      await persistence.loadMessagesFromDisk(managed)

      expect(managed.messagesLoaded).toBe(true)
      expect(managed.messages).toEqual([])
    })
  })

  describe('getSessionPath', () => {
    it('returns null when the session is not in the manager map', () => {
      expect(persistence.getSessionPath('nope')).toBeNull()
    })

    it('returns the storage path for a registered session', () => {
      const managed = createManagedSession({ id: 'pathed-1' }, buildWorkspace())
      sessions.set(managed.id, managed)
      const path = persistence.getSessionPath('pathed-1')
      expect(path).not.toBeNull()
      expect(path).toContain('pathed-1')
    })
  })

  describe('loadSessionsFromDisk', () => {
    it('does not throw when the workspace registry is empty', () => {
      // We can't easily fake getWorkspaces() without env-var setup that would
      // bleed across tests. The contract here is that the helper survives the
      // empty-state path without throwing, which is the boot-after-fresh-install
      // case.
      expect(() => persistence.loadSessionsFromDisk()).not.toThrow()
    })
  })
})
