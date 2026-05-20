/**
 * T537 PR #5b: Explicit design:fs IPC handlers.
 *
 * Provides narrowly-scoped read/write contracts for the Design embed surface.
 * All paths are validated against an allowlist before any fs operation.
 *
 * Allowed roots:
 *   - ~/.rox/storage/artifacts/design/  (per-workspace design artifacts)
 *   - ~/.rox/storage/workspaces/<id>/files/  (workspace file trees)
 *
 * IPC channels (registered externally in main/index.ts):
 *   design:fs:readSelected   — read a single file from an allowed path
 *   design:fs:writeArtifact  — atomically write content + return sha256
 */
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Allowed filesystem root directories for the Design embed surface.
 * Paths outside these roots are rejected with an error.
 */
export interface DesignFsAllowedRoots {
  /** ~/.rox/storage/artifacts/design (or equivalent) */
  artifactsDir: string
  /** Per-workspace file dirs: ~/.rox/storage/workspaces/<id>/files */
  workspaceDirs: string[]
}

export interface WriteArtifactResult {
  /** Hex-encoded SHA-256 of the written content (UTF-8). */
  sha256: string
  /** Absolute path the artifact was written to. */
  path: string
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

/**
 * Returns true iff `filePath` is strictly under one of the allowed roots.
 * Normalises the path first to eliminate traversal sequences.
 */
export function isAllowedDesignPath(filePath: string, roots: DesignFsAllowedRoots): boolean {
  if (!isAbsolute(filePath)) return false
  const normalised = normalize(resolve(filePath))

  const allRoots = [roots.artifactsDir, ...roots.workspaceDirs]
  for (const root of allRoots) {
    const normRoot = normalize(resolve(root))
    // Require normalised path to start with root + separator to prevent
    // prefix-confusion attacks (e.g. /root-evil matching /root).
    if (normalised.startsWith(normRoot + sep) || normalised === normRoot) {
      return true
    }
  }
  return false
}

function assertAllowed(filePath: string, roots: DesignFsAllowedRoots): void {
  if (!isAllowedDesignPath(filePath, roots)) {
    throw new Error(
      `design:fs — path not allowed: ${filePath}. ` +
      `Access is restricted to design artifact and workspace file directories.`
    )
  }
}

// ---------------------------------------------------------------------------
// readSelected
// ---------------------------------------------------------------------------

/**
 * Read a file from an allowed design path. Throws if the path is outside the
 * allowed roots or if the file does not exist.
 */
export async function readSelected(filePath: string, roots: DesignFsAllowedRoots): Promise<string> {
  assertAllowed(filePath, roots)
  return readFile(filePath, 'utf-8')
}

// ---------------------------------------------------------------------------
// writeArtifact
// ---------------------------------------------------------------------------

/**
 * Atomically write `content` (UTF-8) to `targetPath` using a temp file +
 * rename pattern. Returns the sha256 of the written content.
 *
 * The parent directory is created if it does not already exist.
 */
export async function writeArtifact(
  targetPath: string,
  content: string,
  roots: DesignFsAllowedRoots,
): Promise<WriteArtifactResult> {
  assertAllowed(targetPath, roots)

  const parentDir = dirname(targetPath)
  await mkdir(parentDir, { recursive: true })

  const sha256 = createHash('sha256').update(content, 'utf-8').digest('hex')

  // Write to a sibling temp file then rename for atomicity.
  const tmpSuffix = randomBytes(8).toString('hex')
  const tmpPath = targetPath + '.' + tmpSuffix + '.tmp'

  try {
    await writeFile(tmpPath, content, 'utf-8')
    await rename(tmpPath, targetPath)
  } catch (err) {
    // Best-effort cleanup of temp file on failure.
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(tmpPath)
    } catch {
      // ignore cleanup error
    }
    throw err
  }

  return { sha256, path: targetPath }
}
