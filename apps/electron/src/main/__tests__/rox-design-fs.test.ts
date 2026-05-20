/**
 * T537 PR #5b: TDD cycles 7-10 — explicit design:fs IPC handlers.
 *
 * Covers:
 *   - readSelected: throws on path outside allowed roots
 *   - writeArtifact: creates file with sha256 + atomic rename
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import {
  readSelected,
  writeArtifact,
  isAllowedDesignPath,
  type DesignFsAllowedRoots,
} from '../rox-design-fs'

const tempDirs: string[] = []

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'rox-design-fs-test-'))
  tempDirs.push(d)
  return d
}

afterEach(() => {
  for (const d of tempDirs) {
    rmSync(d, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

// ---------------------------------------------------------------------------
// isAllowedDesignPath
// ---------------------------------------------------------------------------

describe('isAllowedDesignPath', () => {
  it('allows paths under the artifacts root', () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: [],
    }
    expect(isAllowedDesignPath('/home/user/.rox/storage/artifacts/design/proj/file.json', roots)).toBe(true)
  })

  it('allows paths under a workspace files dir', () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: ['/home/user/.rox/storage/workspaces/ws-1/files'],
    }
    expect(isAllowedDesignPath('/home/user/.rox/storage/workspaces/ws-1/files/doc.json', roots)).toBe(true)
  })

  it('rejects path outside all allowed roots', () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: [],
    }
    expect(isAllowedDesignPath('/etc/passwd', roots)).toBe(false)
    expect(isAllowedDesignPath('/tmp/evil', roots)).toBe(false)
  })

  it('rejects path traversal attempts', () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: [],
    }
    expect(isAllowedDesignPath('/home/user/.rox/storage/artifacts/design/../../../etc/passwd', roots)).toBe(false)
  })

  it('rejects prefix-confusion attacks (path starts with root but is not a child)', () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: [],
    }
    expect(isAllowedDesignPath('/home/user/.rox/storage/artifacts/design-evil/file', roots)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// readSelected
// ---------------------------------------------------------------------------

describe('readSelected', () => {
  it('reads file content when path is inside allowed root', async () => {
    const dir = makeTempDir()
    const file = join(dir, 'doc.json')
    const content = JSON.stringify({ hello: 'world' })
    await Bun.write(file, content)

    const roots: DesignFsAllowedRoots = { artifactsDir: dir, workspaceDirs: [] }
    const result = await readSelected(file, roots)
    expect(result).toBe(content)
  })

  it('throws when path is outside allowed roots', async () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: [],
    }
    await expect(readSelected('/etc/passwd', roots)).rejects.toThrow(/not allowed/)
  })

  it('throws when file does not exist', async () => {
    const dir = makeTempDir()
    const roots: DesignFsAllowedRoots = { artifactsDir: dir, workspaceDirs: [] }
    await expect(readSelected(join(dir, 'nonexistent.json'), roots)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// writeArtifact
// ---------------------------------------------------------------------------

describe('writeArtifact', () => {
  it('writes content to target path atomically via temp rename', async () => {
    const dir = makeTempDir()
    const target = join(dir, 'output.json')
    const content = JSON.stringify({ result: 'ok' })

    const roots: DesignFsAllowedRoots = { artifactsDir: dir, workspaceDirs: [] }
    const result = await writeArtifact(target, content, roots)

    expect(existsSync(target)).toBe(true)
    expect(readFileSync(target, 'utf-8')).toBe(content)
    expect(result.sha256).toBe(
      createHash('sha256').update(content, 'utf-8').digest('hex')
    )
  })

  it('returns the sha256 of written content', async () => {
    const dir = makeTempDir()
    const target = join(dir, 'artifact.json')
    const content = 'test-content'

    const roots: DesignFsAllowedRoots = { artifactsDir: dir, workspaceDirs: [] }
    const result = await writeArtifact(target, content, roots)

    const expected = createHash('sha256').update('test-content', 'utf-8').digest('hex')
    expect(result.sha256).toBe(expected)
  })

  it('creates parent directory if it does not exist', async () => {
    const dir = makeTempDir()
    const target = join(dir, 'subdir', 'output.json')
    const content = '{"nested":true}'

    const roots: DesignFsAllowedRoots = { artifactsDir: dir, workspaceDirs: [] }
    await writeArtifact(target, content, roots)
    expect(existsSync(target)).toBe(true)
  })

  it('throws when target path is outside allowed roots', async () => {
    const roots: DesignFsAllowedRoots = {
      artifactsDir: '/home/user/.rox/storage/artifacts/design',
      workspaceDirs: [],
    }
    await expect(writeArtifact('/tmp/evil.json', 'data', roots)).rejects.toThrow(/not allowed/)
  })

  it('leaves no temp file on success (atomic rename completed)', async () => {
    const dir = makeTempDir()
    const target = join(dir, 'clean.json')

    const roots: DesignFsAllowedRoots = { artifactsDir: dir, workspaceDirs: [] }
    await writeArtifact(target, 'content', roots)

    // Only the final file should exist; no *.tmp files
    const files = Array.from(require('fs').readdirSync(dir) as string[])
    const temps = files.filter((f: string) => f.endsWith('.tmp'))
    expect(temps).toHaveLength(0)
  })
})
