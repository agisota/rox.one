/**
 * User-data migration shim — Phase R.8.
 *
 * Single-shot copy from legacy `~/.rox-agent/` (preferred) or
 * `~/.rox/` to the canonical `~/.rox/` directory on app startup.
 *
 * The shim is **non-destructive**: it always copies, never moves.
 * It writes a `.migrated-from-rox` marker inside the new root after
 * the copy succeeds. Subsequent launches short-circuit on the marker.
 *
 * Design contract:
 *   docs/superpowers/specs/2026-05-13-user-data-migration-design.md
 *
 * Behavior summary:
 *   - No legacy root            → no-op, reason = 'no-legacy-path'.
 *   - Exactly one legacy root,
 *     new root absent           → cpSync(legacy, newRoot), write marker.
 *   - Legacy + new root both    → warn, no copy, no marker.
 *     present (no marker)
 *   - Marker present            → fast no-op, reason = 'already-migrated'.
 *
 * The shim takes a dependency-injected `legacyRoots` / `newRoot` /
 * `logger` so tests run against fixture filesystems and never touch
 * the real home directory.
 */

import { cpSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export type MigrationReason =
  | 'no-legacy-path'
  | 'destination-exists'
  | 'already-migrated'

export interface MigrationResult {
  migrated: boolean
  reason?: MigrationReason
  source?: string
  filesCopied?: number
  conflict?: boolean
}

export interface MigrationLogger {
  info: (msg: string) => void
  warn: (msg: string) => void
}

export interface MigrationOptions {
  legacyRoots?: string[]
  newRoot?: string
  logger?: MigrationLogger
  marker?: string
}

const NOOP_LOGGER: MigrationLogger = {
  info: () => {},
  warn: () => {},
}

const DEFAULT_MARKER = '.migrated-from-rox'

function defaultLegacyRoots(): string[] {
  const home = homedir()
  return [join(home, '.rox-agent'), join(home, '.rox')]
}

function defaultNewRoot(): string {
  return join(homedir(), '.rox')
}

/**
 * Best-effort file count for a recursively copied tree. The shim
 * reports this as `filesCopied` so the Electron worklog/log shows
 * progress signal. Errors during the walk are swallowed — the count
 * is advisory, not contractual.
 */
function countFiles(root: string): number {
  let total = 0
  const stack: string[] = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry)
      let stats
      try {
        stats = statSync(full)
      } catch {
        continue
      }
      if (stats.isDirectory()) {
        stack.push(full)
      } else if (stats.isFile()) {
        total += 1
      }
    }
  }
  return total
}

function writeMarker(
  newRoot: string,
  markerName: string,
  source: string,
): void {
  const body =
    `migrated-from: ${source}\n` +
    `timestamp: ${new Date().toISOString()}\n`
  writeFileSync(join(newRoot, markerName), body, 'utf8')
}

/**
 * Run the user-data migration once. Safe to call on every app launch —
 * the marker short-circuits subsequent invocations.
 */
export function migrateUserDataIfNeeded(
  opts: MigrationOptions = {},
): MigrationResult {
  const legacyRoots = opts.legacyRoots ?? defaultLegacyRoots()
  const newRoot = opts.newRoot ?? defaultNewRoot()
  const logger = opts.logger ?? NOOP_LOGGER
  const markerName = opts.marker ?? DEFAULT_MARKER
  const markerPath = join(newRoot, markerName)

  // Fast path: marker already exists → silent no-op.
  if (existsSync(markerPath)) {
    return { migrated: false, reason: 'already-migrated' }
  }

  // Find the first legacy root that actually exists.
  const source = legacyRoots.find((p) => existsSync(p))
  if (!source) {
    return { migrated: false, reason: 'no-legacy-path' }
  }

  // Conflict: legacy + new root both present, no marker. Refuse to merge.
  // If newRoot is itself one of the legacyRoots (e.g. ~/.rox/ listed as a
  // lower-priority source after ~/.rox-agent/), it is a migration source, not
  // independently-curated user data, so copying over it is safe and intended.
  const newRootIsLegacySource = legacyRoots.includes(newRoot)
  if (existsSync(newRoot) && !newRootIsLegacySource) {
    logger.warn(
      `[user-data-migration] both ${source} and ${newRoot} exist; ` +
        'skipping migration. Consolidate manually if you want the ' +
        'legacy data.',
    )
    return {
      migrated: false,
      reason: 'destination-exists',
      conflict: true,
    }
  }

  // Happy path: copy tree → marker.
  logger.info(
    `[user-data-migration] starting copy from ${source} -> ${newRoot}`,
  )

  // `verbatimSymlinks: true` keeps symlinks instead of dereferencing
  // them. Node 22+ honors the option; older hosts silently ignore it
  // (degradation, not corruption — see spec §6).
  // `force: true` ensures existing files at the destination are overwritten;
  // Bun's cpSync skips existing files by default unlike Node.js.
  cpSync(source, newRoot, {
    recursive: true,
    verbatimSymlinks: true,
    force: true,
  } as Parameters<typeof cpSync>[2])

  const filesCopied = countFiles(newRoot)
  writeMarker(newRoot, markerName, source)

  logger.info(
    `[user-data-migration] copy complete (${filesCopied} files), ` +
      `marker written at ${markerPath}`,
  )

  return {
    migrated: true,
    source,
    filesCopied,
  }
}
