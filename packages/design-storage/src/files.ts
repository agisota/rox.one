/**
 * File-write helper for design artifacts.
 * Uses sha256 content-addressing + atomic rename via a .tmp staging file.
 */
import { createHash, randomUUID } from 'crypto'
import { mkdirSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface WriteArtifactFileOptions {
  /** Base directory to write into (created if absent). */
  storageDir: string
  /** Raw file bytes. */
  content: Buffer
  /** File extension without dot, e.g. 'html', 'png'. */
  ext: string
}

export interface WriteArtifactFileResult {
  /** Absolute path to the written file. */
  path: string
  /** file:// URI for the written path. */
  uri: string
  /** Hex-encoded SHA-256 of content. */
  sha256: string
  /** Byte length of content. */
  bytes: number
}

/**
 * Write artifact content to disk with sha256 content-addressing and atomic rename.
 *
 * Filename: `<sha256>.<ext>` — content-addressed, same content → same filename.
 * Atomic pattern: write to `<sha256>-<uuid>.tmp` then rename to final path.
 */
export async function writeArtifactFile(opts: WriteArtifactFileOptions): Promise<WriteArtifactFileResult> {
  const { storageDir, content, ext } = opts

  mkdirSync(storageDir, { recursive: true })

  const sha256 = createHash('sha256').update(content).digest('hex')
  const filename = `${sha256}.${ext}`
  const finalPath = join(storageDir, filename)
  const tmpPath = join(storageDir, `${sha256}-${randomUUID()}.tmp`)

  // Atomic write: stage to .tmp, then rename to content-addressed final path
  writeFileSync(tmpPath, content)
  renameSync(tmpPath, finalPath)

  const uri = `file://${finalPath}`

  return {
    path: finalPath,
    uri,
    sha256,
    bytes: content.byteLength,
  }
}
