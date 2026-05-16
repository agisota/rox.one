import { describe, expect, it } from 'bun:test'
import { createSessionHeader, readSessionJsonl, writeSessionJsonl } from '../jsonl.ts'
import { sortSessionsForList } from '../sorting.ts'
import { SESSION_PERSISTENT_FIELDS } from '../types.ts'
import { pickSessionFields } from '../utils.ts'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import type { StoredSession } from '../types.ts'

describe('pinned session metadata', () => {
  it('is part of the persistent session field contract', () => {
    expect(SESSION_PERSISTENT_FIELDS).toContain('pinnedAt')
    expect(pickSessionFields({ id: 's1', pinnedAt: 42 })).toEqual({ id: 's1', pinnedAt: 42 })
  })

  it('round-trips pinnedAt through JSONL headers', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'rox-pinned-session-'))
    const filePath = join(tmpRoot, 'sessions', 's1', 'session.jsonl')
    mkdirSync(dirname(filePath), { recursive: true })

    try {
      const session: StoredSession = {
        id: 's1',
        workspaceRootPath: tmpRoot,
        createdAt: 1,
        lastUsedAt: 2,
        lastMessageAt: 3,
        pinnedAt: 4,
        messages: [],
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          contextTokens: 0,
          costUsd: 0,
        },
      } as StoredSession

      expect(createSessionHeader(session).pinnedAt).toBe(4)
      writeSessionJsonl(filePath, session)

      const reloaded = readSessionJsonl(filePath)
      expect(reloaded?.pinnedAt).toBe(4)
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})

describe('sortSessionsForList', () => {
  it('puts every pinned session first and orders pins by pin recency', () => {
    const ordered = sortSessionsForList([
      { id: 'recent-unpinned', lastMessageAt: 1000 },
      { id: 'older-pin', pinnedAt: 100, lastMessageAt: 1 },
      { id: 'newer-pin', pinnedAt: 200, lastMessageAt: 2 },
      { id: 'older-unpinned', lastMessageAt: 500 },
    ])

    expect(ordered.map(session => session.id)).toEqual([
      'newer-pin',
      'older-pin',
      'recent-unpinned',
      'older-unpinned',
    ])
  })
})
