/**
 * Tests for the design:openWithContext IPC handler (T537 Phase B).
 * Mocks electron + bun:sqlite so tests run outside Electron.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { randomUUID } from 'crypto'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// ── Electron mock ────────────────────────────────────────────────────────────
mock.module('electron', () => ({
  ipcMain: {
    handle: mock(() => undefined),
  },
  BrowserWindow: {
    getAllWindows: mock(() => []),
    fromWebContents: mock(() => null),
  },
}))

// ── Module under test (dynamic import after mocks) ───────────────────────────
const { handleOpenWithContext } = await import('../rox-design-ipc.ts') as typeof import('../rox-design-ipc.ts')

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeTmpDir(): string {
  const dir = join(tmpdir(), `design-ipc-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function validRequest() {
  return {
    task: {
      id: randomUUID(),
      description: 'Build a landing page',
      kind: 'landing' as const,
      locale: 'en',
      createdAt: new Date().toISOString(),
    },
    context: {
      sessionId: 'sess-1',
      workspaceId: null,
      attachedFileIds: [],
      theme: 'light' as const,
      locale: 'en',
    },
    autoLaunched: false,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('handleOpenWithContext · happy path', () => {
  let storageDir: string

  beforeEach(() => {
    storageDir = makeTmpDir()
  })

  it('returns status=opened and a numeric windowId', async () => {
    const result = await handleOpenWithContext(validRequest(), { storageDir })
    expect(result.status).toBe('opened')
    if (result.status === 'opened') {
      expect(typeof result.windowId).toBe('number')
    }
  })

  it('stores an artifact row in the manifest DB', async () => {
    const req = validRequest()
    await handleOpenWithContext(req, { storageDir })

    const { DesignManifest } = await import('@rox-one/design-storage')
    const dbPath = join(storageDir, 'manifest.db')
    const manifest = new DesignManifest(dbPath)
    const rows = manifest.listByTaskId(req.task.id)
    manifest.close()
    // At minimum one artifact row should exist for the task
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0]!.taskId).toBe(req.task.id)
  })

  it('writes the artifact file to disk', async () => {
    const req = validRequest()
    await handleOpenWithContext(req, { storageDir })

    const { DesignManifest } = await import('@rox-one/design-storage')
    const manifest = new DesignManifest(join(storageDir, 'manifest.db'))
    const rows = manifest.listByTaskId(req.task.id)
    manifest.close()

    expect(rows.length).toBeGreaterThanOrEqual(1)
    const { existsSync } = await import('fs')
    // URI is file:// — strip the scheme to get path
    const filePath = rows[0]!.uri.replace(/^file:\/\//, '')
    expect(existsSync(filePath)).toBe(true)
  })
})

describe('handleOpenWithContext · invalid request', () => {
  let storageDir: string

  beforeEach(() => {
    storageDir = makeTmpDir()
  })

  it('returns status=failed with a zod error reason for missing task', async () => {
    const result = await handleOpenWithContext({ context: validRequest().context } as unknown as ReturnType<typeof validRequest>, { storageDir })
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
    }
  })

  it('returns status=failed for null input', async () => {
    const result = await handleOpenWithContext(null as unknown as ReturnType<typeof validRequest>, { storageDir })
    expect(result.status).toBe('failed')
  })

  it('returns status=failed for bad task kind', async () => {
    const req = validRequest()
    ;(req.task as unknown as Record<string, unknown>).kind = 'not-a-valid-kind'
    const result = await handleOpenWithContext(req, { storageDir })
    expect(result.status).toBe('failed')
  })
})
