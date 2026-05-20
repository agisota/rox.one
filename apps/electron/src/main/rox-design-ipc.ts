/**
 * IPC handler for design:openWithContext (T537 Phase B).
 *
 * Receives an OpenDesignRequest, validates it via Zod, stores a manifest
 * row + artifact file on disk, then returns an OpenDesignResult.
 */
import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { homedir } from 'os'

import { OpenDesignRequestSchema, type OpenDesignRequest, type OpenDesignResult } from '@rox-one/design-contract'
import { DesignManifest, writeArtifactFile } from '@rox-one/design-storage'

// Default artifact storage root: ~/.rox/storage/artifacts/design
const DEFAULT_STORAGE_DIR = join(homedir(), '.rox', 'storage', 'artifacts', 'design')

export interface OpenWithContextOptions {
  /** Override the storage directory (used in tests). */
  storageDir?: string
}

/**
 * Core logic for design:openWithContext — exported for unit testing without IPC.
 */
export async function handleOpenWithContext(
  raw: unknown,
  opts: OpenWithContextOptions = {},
): Promise<OpenDesignResult> {
  // 1. Validate input
  const parsed = OpenDesignRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return { status: 'failed', reason: parsed.error.message }
  }

  const req: OpenDesignRequest = parsed.data
  const storageDir = opts.storageDir ?? DEFAULT_STORAGE_DIR

  // 2. Persist artifact file (minimal placeholder — classifier fills real content in Phase C)
  const artifactContent = Buffer.from(JSON.stringify({ taskId: req.task.id, context: req.context }))
  const artifactDir = join(storageDir, req.task.id)
  const fileResult = await writeArtifactFile({
    storageDir: artifactDir,
    content: artifactContent,
    ext: 'json',
  })

  // 3. Write manifest row
  const manifestPath = join(storageDir, 'manifest.db')
  const manifest = new DesignManifest(manifestPath)
  try {
    manifest.insert({
      id: randomUUID(),
      taskId: req.task.id,
      type: 'html', // placeholder type; Phase C classifier will set correct type
      uri: fileResult.uri,
      bytes: fileResult.bytes,
      sha256: fileResult.sha256,
      createdAt: new Date().toISOString(),
    })
  } finally {
    manifest.close()
  }

  // 4. Return result — windowId 0 until Phase D wires real window management
  return { status: 'opened', windowId: 0 }
}

/**
 * Register the design:openWithContext IPC handler on ipcMain.
 * Call this once during app startup alongside other ipcMain.handle registrations.
 */
export function registerDesignIpcHandlers(opts: OpenWithContextOptions = {}): void {
  ipcMain.handle('design:openWithContext', (_event, raw: unknown) =>
    handleOpenWithContext(raw, opts),
  )
}
