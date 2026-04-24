/**
 * Centralized path configuration for ROX.
 *
 * Supports multi-instance development via CRAFT_CONFIG_DIR environment variable.
 *
 * Default (non-numbered folders): ~/.rox/
 * Instance 1 (-1 suffix): ~/.rox-1/
 * Instance 2 (-2 suffix): ~/.rox-2/
 */

import { existsSync, cpSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function resolveDefaultConfigDir(): string {
  const home = homedir();
  const newDir = join(home, '.rox');
  const legacyDir = join(home, '.craft-agent');

  // Auto-migrate legacy config directory when ROX is first launched.
  if (!existsSync(newDir) && existsSync(legacyDir)) {
    mkdirSync(newDir, { recursive: true });
    cpSync(legacyDir, newDir, { recursive: true });
  }

  return newDir;
}

// Allow override via environment variable for multi-instance dev
export const CONFIG_DIR = process.env.CRAFT_CONFIG_DIR || resolveDefaultConfigDir();
