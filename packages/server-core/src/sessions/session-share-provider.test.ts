import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import { getSessionFilePath, loadSession, writeSessionJsonl, type StoredSession } from '@craft-agent/shared/sessions'
import type { StoredMessage } from '@rox-one/core/types'

import { createFakeShareProvider, setSessionShareProviderForTests } from './share-provider'
import { SessionManager, createManagedSession } from './SessionManager.ts'

describe('SessionManager share provider integration', () => {
  let tmpRoot: string
  let sm: SessionManager

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'sm-share-provider-'))
    sm = new SessionManager()
  })

  afterEach(() => {
    setSessionShareProviderForTests(null)
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  function workspace() {
    return {
      id: 'ws_test',
      name: 'Test Workspace',
      rootPath: tmpRoot,
      createdAt: Date.now(),
    }
  }

  function seedSession(sessionId: string, overrides: Partial<StoredSession> = {}) {
    const filePath = getSessionFilePath(tmpRoot, sessionId)
    mkdirSync(dirname(filePath), { recursive: true })
    const stored = {
      id: sessionId,
      workspaceRootPath: tmpRoot,
      name: 'share session',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      messages: [
        { id: 'm1', type: 'user', content: 'hello', timestamp: Date.now() } as StoredMessage,
      ],
      headers: {
        authorization: 'Bearer should-not-upload',
      },
      rox_session: 'cookie-should-not-upload',
      ...overrides,
    } as StoredSession
    writeSessionJsonl(filePath, stored)

    const managed = createManagedSession(
      {
        id: sessionId,
        name: stored.name,
        createdAt: stored.createdAt,
        sharedId: stored.sharedId,
        sharedUrl: stored.sharedUrl,
      },
      workspace() as never,
      { messagesLoaded: true },
    )
    ;(sm as unknown as { sessions: Map<string, unknown> }).sessions.set(sessionId, managed)
  }

  it('persists share metadata only after upload and public shortlink creation succeed', async () => {
    const provider = createFakeShareProvider({ baseUrl: 'https://viewer.test' })
    setSessionShareProviderForTests(provider)
    seedSession('session-share-success')

    const result = await sm.shareToViewer('session-share-success')

    expect(result).toEqual({ success: true, url: 'https://viewer.test/s/share_session-share-success' })
    const reloaded = loadSession(tmpRoot, 'session-share-success')
    expect(reloaded?.sharedUrl).toBe('https://viewer.test/s/share_session-share-success')
    expect(reloaded?.sharedId).toBe('share_session-share-success')

    const uploadedPayload = JSON.stringify(provider.listUploads()[0]?.bundle)
    expect(uploadedPayload).not.toContain('should-not-upload')
  })

  it('does not persist share metadata when provider upload fails', async () => {
    const provider = createFakeShareProvider({
      baseUrl: 'https://viewer.test',
      uploadFailure: {
        success: false,
        code: 'auth_required',
        error: 'Authentication required to create a public session link. Sign in again in Account and retry.',
        retryable: false,
        status: 401,
      },
    })
    setSessionShareProviderForTests(provider)
    seedSession('session-share-fail')

    const result = await sm.shareToViewer('session-share-fail')

    expect(result).toEqual({
      success: false,
      code: 'auth_required',
      error: 'Authentication required to create a public session link. Sign in again in Account and retry.',
      status: 401,
    })
    const reloaded = loadSession(tmpRoot, 'session-share-fail')
    expect(reloaded?.sharedUrl).toBeUndefined()
    expect(reloaded?.sharedId).toBeUndefined()
  })

  it('routes update and revoke through the provider seam', async () => {
    const provider = createFakeShareProvider({ baseUrl: 'https://viewer.test' })
    setSessionShareProviderForTests(provider)
    seedSession('session-share-update', {
      sharedId: 'share_session-share-update',
      sharedUrl: 'https://viewer.test/s/share_session-share-update',
    })

    expect(await sm.updateShare('session-share-update')).toEqual({
      success: true,
      url: 'https://viewer.test/s/share_session-share-update',
    })
    expect(provider.listUpdates()).toEqual([
      { shareId: 'share_session-share-update', sessionId: 'session-share-update' },
    ])

    expect(await sm.revokeShare('session-share-update')).toEqual({ success: true })
    expect(provider.listRevocations()).toEqual([
      { shareId: 'share_session-share-update', sessionId: 'session-share-update' },
    ])
    const reloaded = loadSession(tmpRoot, 'session-share-update')
    expect(reloaded?.sharedUrl).toBeUndefined()
    expect(reloaded?.sharedId).toBeUndefined()
  })

  it('queries share status through the provider seam without mutating metadata', async () => {
    const provider = createFakeShareProvider({ baseUrl: 'https://viewer.test' })
    setSessionShareProviderForTests(provider)
    seedSession('session-share-status')

    const share = await sm.shareToViewer('session-share-status')
    expect(share.success).toBe(true)

    expect(await sm.getShareStatus('session-share-status')).toEqual({
      success: true,
      shareId: 'share_session-share-status',
      status: 'active',
    })

    const reloaded = loadSession(tmpRoot, 'session-share-status')
    expect(reloaded?.sharedUrl).toBe('https://viewer.test/s/share_session-share-status')
    expect(reloaded?.sharedId).toBe('share_session-share-status')
  })
})
