import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { writeArtifactFile } from '../files.ts'

function makeTmpDir(): string {
  const dir = join(tmpdir(), `design-files-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('writeArtifactFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates file at dest path with correct content', async () => {
    const content = Buffer.from('hello design artifact')
    const result = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'html' })
    expect(existsSync(result.path)).toBe(true)
    expect(readFileSync(result.path)).toEqual(content)
  })

  it('uses sha256 of content in filename', async () => {
    const content = Buffer.from('deterministic content')
    const result = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'svg' })
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.path).toContain(result.sha256)
  })

  it('uses atomic rename (temp file does not linger)', async () => {
    const content = Buffer.from('atomic write test')
    const result = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'png' })
    // The final file must exist
    expect(existsSync(result.path)).toBe(true)
    // No .tmp files should remain
    const files = Array.from(
      (await import('fs')).readdirSync(tmpDir)
    )
    expect(files.some(f => f.endsWith('.tmp'))).toBe(false)
  })

  it('returns a file:// URI for the written path', async () => {
    const content = Buffer.from('uri test')
    const result = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'pdf' })
    expect(result.uri).toMatch(/^file:\/\//)
    expect(result.uri).toContain(result.path)
  })

  it('returns correct byte count', async () => {
    const content = Buffer.from('byte count test 12345')
    const result = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'html' })
    expect(result.bytes).toBe(content.byteLength)
  })

  it('content-addresses: same content produces same filename', async () => {
    const content = Buffer.from('same content')
    const r1 = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'html' })
    const r2 = await writeArtifactFile({ storageDir: tmpDir, content, ext: 'html' })
    expect(r1.path).toBe(r2.path)
    expect(r1.sha256).toBe(r2.sha256)
  })
})
