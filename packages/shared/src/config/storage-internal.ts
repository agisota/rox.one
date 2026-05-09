/**
 * Private shared helpers for the storage submodules.
 * NOT re-exported from the storage.ts barrel — these are file-internal helpers
 * that were previously private inside storage.ts and are kept private to preserve
 * the original public API after the split.
 *
 * Sibling files: storage-io.ts, storage-settings.ts, storage-workspaces.ts,
 * storage-conversations.ts, storage-drafts.ts, storage-themes.ts,
 * storage-llm-connections.ts, storage-tool-icons.ts.
 */
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getConfigDir } from './paths.ts';

export function getConfigFile(): string {
  return join(getConfigDir(), 'config.json');
}

export function getConfigDefaultsFile(): string {
  return join(getConfigDir(), 'config-defaults.json');
}

export function getWorkspacesDir(): string {
  return join(getConfigDir(), 'workspaces');
}

export function ensureWorkspaceDir(workspaceId: string): string {
  const dir = join(getWorkspacesDir(), workspaceId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
