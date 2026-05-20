import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { StoredSession } from '../types.ts'
import {
  getSessionArtifact,
  listSessionArtifacts,
  saveSession,
  upsertSessionArtifact,
} from '../storage.ts'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `artifact-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeStoredSession(workspaceRootPath: string): StoredSession {
  return {
    id: 'session-1',
    workspaceRootPath,
    createdAt: 1000,
    lastUsedAt: 1000,
    messages: [],
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      costUsd: 0,
    },
  } as StoredSession
}

describe('session artifact persistence', () => {
  let workspaceRoot: string

  beforeEach(async () => {
    workspaceRoot = makeTmpDir()
    await saveSession(makeStoredSession(workspaceRoot))
  })

  afterEach(() => {
    if (existsSync(workspaceRoot)) {
      rmSync(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('creates a first-class artifact with an initial version', async () => {
    const artifact = await upsertSessionArtifact(workspaceRoot, 'session-1', {
      conversationId: 'session-1',
      type: 'html',
      title: 'Landing page',
      content: '<h1>Hello</h1>',
      now: 1000,
      versionId: 'version-1',
    })

    expect(artifact.id).toBeDefined()
    expect(artifact.conversationId).toBe('session-1')
    expect(artifact.type).toBe('html')
    expect(artifact.title).toBe('Landing page')
    expect(artifact.content).toBe('<h1>Hello</h1>')
    expect(artifact.currentVersionId).toBe('version-1')
    expect(artifact.versions).toHaveLength(1)
    expect(artifact.versions[0]).toMatchObject({
      id: 'version-1',
      artifactId: artifact.id,
      content: '<h1>Hello</h1>',
      createdAt: 1000,
    })

    expect(listSessionArtifacts(workspaceRoot, 'session-1')).toEqual([artifact])
  })

  it('updates the active artifact and appends a version instead of creating a duplicate', async () => {
    const first = await upsertSessionArtifact(workspaceRoot, 'session-1', {
      conversationId: 'session-1',
      type: 'markdown',
      title: 'Spec',
      content: '# Draft',
      now: 1000,
      versionId: 'version-1',
    })

    const updated = await upsertSessionArtifact(workspaceRoot, 'session-1', {
      id: first.id,
      conversationId: 'session-1',
      type: 'markdown',
      title: 'Spec',
      content: '# Final',
      now: 2000,
      versionId: 'version-2',
      sourceMessageId: 'message-2',
    })

    expect(updated.id).toBe(first.id)
    expect(updated.content).toBe('# Final')
    expect(updated.currentVersionId).toBe('version-2')
    expect(updated.versions).toHaveLength(2)
    expect(updated.versions[1]).toMatchObject({
      id: 'version-2',
      artifactId: first.id,
      content: '# Final',
      sourceMessageId: 'message-2',
      createdAt: 2000,
    })
    expect(listSessionArtifacts(workspaceRoot, 'session-1')).toHaveLength(1)
    expect(getSessionArtifact(workspaceRoot, 'session-1', first.id)?.versions).toHaveLength(2)
  })

  it('updates the stable title-derived artifact when no id is provided on a follow-up edit', async () => {
    const first = await upsertSessionArtifact(workspaceRoot, 'session-1', {
      conversationId: 'session-1',
      type: 'html',
      title: 'Dashboard',
      content: '<h1>Draft</h1>',
      now: 1000,
      versionId: 'version-1',
    })

    const updated = await upsertSessionArtifact(workspaceRoot, 'session-1', {
      conversationId: 'session-1',
      type: 'html',
      title: 'Dashboard',
      content: '<h1>Final</h1>',
      now: 2000,
      versionId: 'version-2',
    })

    expect(updated.id).toBe(first.id)
    expect(updated.content).toBe('<h1>Final</h1>')
    expect(updated.versions).toHaveLength(2)
    expect(listSessionArtifacts(workspaceRoot, 'session-1')).toEqual([updated])
  })
})
