/**
 * Core config I/O: StoredConfig type, file load/save, config-defaults sync,
 * config dir initialization, and clear-all teardown.
 * Sibling files: storage-settings.ts, storage-workspaces.ts,
 * storage-conversations.ts, storage-drafts.ts, storage-themes.ts,
 * storage-llm-connections.ts, storage-tool-icons.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { initializeDocs } from '../docs/index.ts';
import { expandPath, toPortablePath, getBundledAssetsDir } from '../utils/paths.ts';
import { debug } from '../utils/debug.ts';
import { readJsonFileSync } from '../utils/files.ts';
import { type ConfigDefaults } from './config-defaults-schema.ts';
import { parsePermissionMode, PERMISSION_MODE_ORDER } from '../agent/mode-types.ts';
import type { PermissionMode } from '../agent/mode-manager.ts';
import type { ThinkingLevel } from '../agent/thinking-levels.ts';
import {
  isValidWorkspace,
  createWorkspaceAtPath,
} from '../workspaces/storage.ts';
import { ensureToolIcons } from './storage-tool-icons.ts';
import { getConfigDirForScope, getConfigFile, getConfigDefaultsFile } from './storage-internal.ts';
import { DEFAULT_LOCAL_SCOPE, type BrandedWorkspaceScope } from './storage-scope.ts';

// Re-export base types from core (single source of truth)
export type {
  WorkspaceInfo,
  Workspace,
  McpAuthType,
  AuthType,
  OAuthCredentials,
} from '@rox-one/core/types';

// Import for local use
import type { Workspace } from '@rox-one/core/types';

// Import LLM connection types for the StoredConfig interface
import type { LlmConnection } from './llm-connections.ts';

// Config stored in JSON file (credentials stored in encrypted file, not here)
export interface StoredConfig {
  // LLM Connections (authoritative source for auth and model config)
  llmConnections?: LlmConnection[];
  defaultLlmConnection?: string;  // Slug of default connection for new sessions
  defaultThinkingLevel?: ThinkingLevel;  // App-level default thinking level for new sessions

  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeSessionId: string | null;  // Currently active session (primary scope)
  // Notifications
  notificationsEnabled?: boolean;  // Desktop notifications for task completion (default: true)
  // Appearance
  colorTheme?: string;  // ID of selected preset theme (e.g., 'dracula', 'nord'). Default: 'default'
  // Auto-update
  dismissedUpdateVersion?: string;  // Version that user dismissed (skip notifications for this version)
  // Input settings
  autoCapitalisation?: boolean;  // Auto-capitalize first letter when typing (default: true)
  sendMessageKey?: 'enter' | 'cmd-enter';  // Key to send messages (default: 'enter')
  spellCheck?: boolean;  // Enable spell check in input (default: false)
  // Power settings
  keepAwakeWhileRunning?: boolean;  // Prevent screen sleep while sessions are running (default: false)
  // Tool metadata
  richToolDescriptions?: boolean;  // Add intent/action metadata to all tool calls (default: true)
  // Tools
  browserToolEnabled?: boolean;  // Enable built-in browser tool (default: true). Disable for Playwright/Puppeteer.
  // Prompt caching & context
  extendedPromptCache?: boolean;  // Use 1h prompt cache TTL instead of 5m (default: false)
  enable1MContext?: boolean;  // Enable 1M context window for supported models (default: false — opt-in; requires Anthropic Tier 4+)
  // Network proxy
  networkProxy?: import('./types.ts').NetworkProxySettings;
  // Windows: path to Git Bash (bash.exe) for the SDK subprocess
  gitBashPath?: string;
  // User chose "Setup later" during onboarding — skip showing onboarding on next launch
  setupDeferred?: boolean;
  // Server mode — embedded remote server settings
  serverConfig?: import('./server-config.ts').ServerConfig;
  // One-shot migration markers. Used by migrations that should run at most
  // once per user (e.g. restoring a previously-removed model to connection
  // lists without re-adding it if the user later removes it deliberately).
  migrationsApplied?: string[];
}

// Track config-defaults synced per scoped config root (prevents re-sync on hot reload)
const configDefaultsSynced = new Set<string>();

/**
 * Sync config-defaults.json from bundled assets.
 * Always writes on launch to ensure defaults are up-to-date with the running version.
 * Follows the same pattern as docs, themes, and other bundled assets.
 *
 * Source of truth: apps/electron/resources/config-defaults.json
 */
/** Minimal config-defaults used when bundled assets aren't available (CI, standalone server). */
const FALLBACK_CONFIG_DEFAULTS: ConfigDefaults = {
  version: '1.0',
  description: 'Default configuration values for ROX ONE',
  defaults: {
    notificationsEnabled: true,
    colorTheme: 'default',
    autoCapitalisation: true,
    sendMessageKey: 'enter',
    spellCheck: false,
    keepAwakeWhileRunning: false,
    richToolDescriptions: true,
    extendedPromptCache: false,
    browserToolEnabled: true,
  },
  workspaceDefaults: {
    thinkingLevel: 'medium',
    permissionMode: 'ask',
    cyclablePermissionModes: ['safe', 'ask', 'allow-all'],
    localMcpServers: { enabled: true },
  },
};

function syncConfigDefaults(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const defaultsFile = getConfigDefaultsFile(_scope);
  if (configDefaultsSynced.has(defaultsFile) && existsSync(defaultsFile)) return;
  configDefaultsSynced.add(defaultsFile);

  // Get bundled config-defaults.json from resources folder
  const bundledDir = getBundledAssetsDir('.');
  if (!bundledDir) {
    debug('[config] No bundled assets dir found - using fallback config-defaults');
    if (!existsSync(defaultsFile)) {
      writeFileSync(defaultsFile, JSON.stringify(FALLBACK_CONFIG_DEFAULTS, null, 2), 'utf-8');
    }
    return;
  }

  const bundledFile = join(bundledDir, 'config-defaults.json');
  if (!existsSync(bundledFile)) {
    debug('[config] Bundled config-defaults.json not found at: ' + bundledFile + ' - using fallback');
    if (!existsSync(defaultsFile)) {
      writeFileSync(defaultsFile, JSON.stringify(FALLBACK_CONFIG_DEFAULTS, null, 2), 'utf-8');
    }
    return;
  }

  // Sync from bundled file (same pattern as docs)
  const content = readFileSync(bundledFile, 'utf-8');
  writeFileSync(defaultsFile, content, 'utf-8');
  debug('[config] Synced config-defaults.json from bundled assets');
}

/**
 * Load config defaults from ~/.rox/config-defaults.json
 * This file is synced from bundled assets on every launch.
 */
export function loadConfigDefaults(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): ConfigDefaults {
  const defaultsFile = getConfigDefaultsFile(_scope);
  const configDir = getConfigDirForScope(_scope);
  if (!existsSync(defaultsFile)) {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    ensureConfigDefaults(_scope);
  }

  const defaults = readJsonFileSync<ConfigDefaults>(defaultsFile);

  const parsedPermissionMode =
    typeof defaults.workspaceDefaults?.permissionMode === 'string'
      ? parsePermissionMode(defaults.workspaceDefaults.permissionMode)
      : null;
  defaults.workspaceDefaults.permissionMode = parsedPermissionMode ?? 'ask';

  const rawCyclable = Array.isArray(defaults.workspaceDefaults?.cyclablePermissionModes)
    ? defaults.workspaceDefaults.cyclablePermissionModes
    : [];

  const normalizedCyclable: PermissionMode[] = [];
  for (const mode of rawCyclable) {
    if (typeof mode !== 'string') continue;
    const parsed = parsePermissionMode(mode);
    if (!parsed) continue;
    if (!normalizedCyclable.includes(parsed)) {
      normalizedCyclable.push(parsed);
    }
  }

  defaults.workspaceDefaults.cyclablePermissionModes =
    normalizedCyclable.length >= 2 ? normalizedCyclable : [...PERMISSION_MODE_ORDER];

  return defaults;
}

/**
 * Ensure config-defaults.json exists and is up-to-date.
 * Syncs from bundled assets on every launch (like docs, themes, permissions).
 */
export function ensureConfigDefaults(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  syncConfigDefaults(_scope);
}

let initializedConfigDir: string | null = null;

export function ensureConfigDir(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const configDir = getConfigDirForScope(_scope);
  if (initializedConfigDir === configDir) return;

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  // Initialize bundled docs (creates ~/.rox/docs/ with sources.md, agents.md, permissions.md)
  initializeDocs();

  // Initialize config defaults
  ensureConfigDefaults(_scope);

  // Initialize tool icons (CLI tool icons for turn card display)
  ensureToolIcons(_scope);

  initializedConfigDir = configDir;
}

export function loadStoredConfig(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): StoredConfig | null {
  const configFile = getConfigFile(_scope);
  try {
    if (!existsSync(configFile)) {
      return null;
    }
    const config = readJsonFileSync<StoredConfig>(configFile);

    // Must have workspaces array
    if (!Array.isArray(config.workspaces)) {
      return null;
    }

    // Expand path variables (~ and ${HOME}) for portability
    for (const workspace of config.workspaces) {
      workspace.rootPath = expandPath(workspace.rootPath);
    }

    // Validate active workspace exists
    const activeWorkspace = config.workspaces.find(w => w.id === config.activeWorkspaceId);
    if (!activeWorkspace) {
      // Default to first workspace
      config.activeWorkspaceId = config.workspaces[0]?.id || null;
    }

    // Ensure workspace folder structure exists for all workspaces.
    // Failures here are non-fatal — the workspace will be re-created on next access.
    for (const workspace of config.workspaces) {
      if (!isValidWorkspace(workspace.rootPath)) {
        try {
          createWorkspaceAtPath(workspace.rootPath, workspace.name);
        } catch (wsError) {
          debug('[config] Failed to create workspace at', workspace.rootPath, ':', wsError instanceof Error ? wsError.message : wsError);
        }
      }
    }

    return config;
  } catch (error) {
    debug('[config] loadStoredConfig failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

// Legacy credential helpers removed - use connection-aware credential lookup instead:
// - getAnthropicApiKey() → credentialManager.getLlmApiKey(connectionSlug)
// - getClaudeOAuthToken() → credentialManager.getLlmOAuth(connectionSlug)

export function saveConfig(config: StoredConfig, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  ensureConfigDir(_scope);

  // Convert paths to portable form (~ prefix) for cross-machine compatibility
  const storageConfig: StoredConfig = {
    ...config,
    workspaces: config.workspaces.map(ws => ({
      ...ws,
      rootPath: toPortablePath(ws.rootPath),
    })),
  };

  writeFileSync(getConfigFile(_scope), JSON.stringify(storageConfig, null, 2), 'utf-8');
}

// Legacy updateApiKey() removed - use setupLlmConnection IPC handler instead.

// Legacy getters/setters removed - use LLM connections instead:
// - getAuthType/setAuthType -> derive from getDefaultLlmConnection()/getLlmConnection()
// - getAnthropicBaseUrl/setAnthropicBaseUrl -> use connection.baseUrl
// - getCustomModel/setCustomModel -> use connection.defaultModel

export function getConfigPath(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): string {
  return getConfigFile(_scope);
}

/**
 * Clear all configuration and credentials (for logout).
 * Deletes config file and credentials file.
 */
export async function clearAllConfig(_scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): Promise<void> {
  const configDir = getConfigDirForScope(_scope);

  // Delete config file
  const configFile = getConfigFile(_scope);
  if (existsSync(configFile)) {
    rmSync(configFile);
  }

  // Delete credentials file
  const credentialsFile = join(configDir, 'credentials.enc');
  if (existsSync(credentialsFile)) {
    rmSync(credentialsFile);
  }

  // Optionally: Delete workspace data (conversations)
  const workspacesDir = join(configDir, 'workspaces');
  if (existsSync(workspacesDir)) {
    rmSync(workspacesDir, { recursive: true });
  }
}
