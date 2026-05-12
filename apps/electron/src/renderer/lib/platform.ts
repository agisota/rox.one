/**
 * Platform Detection Utilities
 *
 * Centralized platform detection for the renderer process.
 * Use these instead of accessing navigator.platform directly.
 *
 * @example
 * import { isMac, isWindows, PATH_SEP, getPathBasename } from '@/lib/platform'
 *
 * // Platform checks
 * const modifier = isMac ? '⌘' : 'Ctrl'
 *
 * // Path handling
 * const folderName = getPathBasename('/Users/alice/projects') // 'projects'
 */

/** True if running on macOS */
export const isMac =
  typeof navigator !== 'undefined' &&
  navigator.platform.toLowerCase().includes('mac')

/** True if running on Windows */
export const isWindows =
  typeof navigator !== 'undefined' &&
  navigator.platform.toLowerCase().includes('win')

/** True if running on Linux */
export const isLinux =
  typeof navigator !== 'undefined' &&
  navigator.platform.toLowerCase().includes('linux')

/**
 * Get the platform-specific file manager name.
 * macOS → "Finder", Windows → "Explorer", Linux → "File Manager"
 */
export function getFileManagerName(): string {
  if (isMac) return 'Finder'
  if (isWindows) return 'Explorer'
  return 'File Manager'
}

/** Native path separator for current OS */
export const PATH_SEP = isWindows ? '\\' : '/'

/**
 * Get the last segment of a path (folder/file name).
 * Handles both Unix (/) and Windows (\) separators because renderer paths can
 * come from local workspaces, remote servers, or test/runtime shims.
 */
export function getPathBasename(path: string): string {
  const withoutTrailingSeparators = path.replace(/[\\/]+$/, '')
  if (/^[A-Za-z]:$/.test(withoutTrailingSeparators)) return ''
  return withoutTrailingSeparators.split(/[\\/]/).pop() || ''
}
