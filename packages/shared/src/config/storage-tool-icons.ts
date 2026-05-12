/**
 * Tool icons (CLI tool icons used for the turn-card display).
 * Sibling files: storage-io.ts, storage-settings.ts, storage-workspaces.ts,
 * storage-conversations.ts, storage-drafts.ts, storage-themes.ts,
 * storage-llm-connections.ts.
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getConfigDir } from './paths.ts';
import { getBundledAssetsDir } from '../utils/paths.ts';
import { DEFAULT_LOCAL_SCOPE, type WorkspaceScope } from './storage-scope.ts';

const TOOL_ICONS_DIR_NAME = 'tool-icons';

/**
 * Returns the path to the tool-icons directory: ~/.rox/tool-icons/
 */
export function getToolIconsDir(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): string {
  return join(getConfigDir(), TOOL_ICONS_DIR_NAME);
}

/**
 * Ensure tool-icons directory exists and has bundled defaults.
 * Resolves bundled path automatically via getBundledAssetsDir('tool-icons').
 * Copies bundled tool-icons.json and icon files on first run.
 * Only copies files that don't already exist (preserves user customizations).
 */
export function ensureToolIcons(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const toolIconsDir = getToolIconsDir();

  // Create tool-icons directory if it doesn't exist
  if (!existsSync(toolIconsDir)) {
    mkdirSync(toolIconsDir, { recursive: true });
  }

  // Resolve bundled tool-icons directory via shared asset resolver
  const bundledToolIconsDir = getBundledAssetsDir('tool-icons');
  if (!bundledToolIconsDir) {
    return;
  }

  // Copy each bundled file if it doesn't exist in the target dir
  // This includes tool-icons.json and all icon files (png, ico, svg, jpg)
  try {
    const bundledFiles = readdirSync(bundledToolIconsDir);
    for (const file of bundledFiles) {
      const destPath = join(toolIconsDir, file);
      if (!existsSync(destPath)) {
        const srcPath = join(bundledToolIconsDir, file);
        copyFileSync(srcPath, destPath);
      }
    }
  } catch {
    // Ignore errors — tool icons are optional enhancement
  }
}
