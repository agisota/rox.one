/**
 * Centralized path configuration for Rox Agent.
 *
 * Supports multi-instance development via ROX_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., rox-tui-agent-1), the detect-instance.sh
 * script sets ROX_CONFIG_DIR to ~/.rox-agent-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.rox-agent/
 * Instance 1 (-1 suffix): ~/.rox-agent-1/
 * Instance 2 (-2 suffix): ~/.rox-agent-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.rox-agent/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.ROX_CONFIG_DIR || join(homedir(), '.rox-agent');
