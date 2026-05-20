import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { DesignArtifactSchema } from '@rox-one/design-contract'
import { DesignManifest } from '../manifest.ts'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `design-manifest-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('DesignManifest · schema migration', () => {
  let tmpDir: string
  let manifest: DesignManifest

  beforeEach(() => {
    tmpDir = makeTmpDir()
    manifest = new DesignManifest(join(tmpDir, 'manifest.db'))
  })

  afterEach(() => {
    manifest.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates the artifacts table on open', () => {
    const tables = manifest.listTables()
    expect(tables).toContain('artifacts')
  })

  it('applies schema_migrations table for version tracking', () => {
    const tables = manifest.listTables()
    expect(tables).toContain('schema_migrations')
  })

  it('reports schema version 1 after fresh open', () => {
    expect(manifest.schemaVersion()).toBe(1)
  })
})

describe('DesignManifest · insert + read (Zod validation)', () => {
  let tmpDir: string
  let manifest: DesignManifest

  beforeEach(() => {
    tmpDir = makeTmpDir()
    manifest = new DesignManifest(join(tmpDir, 'manifest.db'))
  })

  afterEach(() => {
    manifest.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('insert + read returns same DesignArtifact passing Zod parse', () => {
    const artifact = {
      id: randomUUID(),
      taskId: randomUUID(),
      type: 'html' as const,
      uri: `file:///tmp/design/test.html`,
      bytes: 1024,
      sha256: 'a'.repeat(64),
      createdAt: new Date().toISOString(),
      thumbnailUri: undefined,
    }
    manifest.insert(artifact)
    const found = manifest.findById(artifact.id)
    expect(found).not.toBeNull()
    const parsed = DesignArtifactSchema.parse(found)
    expect(parsed.id).toBe(artifact.id)
    expect(parsed.taskId).toBe(artifact.taskId)
    expect(parsed.type).toBe('html')
    expect(parsed.bytes).toBe(1024)
    expect(parsed.sha256).toBe('a'.repeat(64))
  })

  it('insert with thumbnailUri round-trips thumbnailUri', () => {
    const artifact = {
      id: randomUUID(),
      taskId: randomUUID(),
      type: 'png' as const,
      uri: `file:///tmp/design/test.png`,
      bytes: 512,
      sha256: 'b'.repeat(64),
      createdAt: new Date().toISOString(),
      thumbnailUri: `file:///tmp/design/test.thumb.png`,
    }
    manifest.insert(artifact)
    const found = manifest.findById(artifact.id)
    expect(found?.thumbnailUri).toBe(artifact.thumbnailUri)
  })

  it('findById returns null for unknown id', () => {
    const found = manifest.findById(randomUUID())
    expect(found).toBeNull()
  })

  it('listByTaskId returns all artifacts for a task', () => {
    const taskId = randomUUID()
    const a1 = { id: randomUUID(), taskId, type: 'html' as const, uri: 'file:///a.html', bytes: 1, sha256: 'c'.repeat(64), createdAt: new Date().toISOString() }
    const a2 = { id: randomUUID(), taskId, type: 'svg' as const, uri: 'file:///a.svg', bytes: 2, sha256: 'd'.repeat(64), createdAt: new Date().toISOString() }
    manifest.insert(a1)
    manifest.insert(a2)
    const list = manifest.listByTaskId(taskId)
    expect(list.length).toBe(2)
    expect(list.map(a => a.id).sort()).toEqual([a1.id, a2.id].sort())
  })
})
