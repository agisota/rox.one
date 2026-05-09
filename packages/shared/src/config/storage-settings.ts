/**
 * Named app-level setting getters/setters that read/write fields on
 * StoredConfig: notifications, input, power, tool metadata, prompt cache,
 * 1M context, Git Bash path, color theme, dismissed update version,
 * default thinking level, network proxy, setup deferred, and server config.
 * Sibling files: storage-io.ts, storage-workspaces.ts, storage-conversations.ts,
 * storage-drafts.ts, storage-themes.ts, storage-llm-connections.ts,
 * storage-tool-icons.ts.
 */
import { randomUUID } from 'crypto';
import { loadStoredConfig, saveConfig, loadConfigDefaults } from './storage-io.ts';
import type { ThinkingLevel } from '../agent/thinking-levels.ts';
import { normalizeThinkingLevel } from '../agent/thinking-levels.ts';
import type { NetworkProxySettings } from './types.ts';
import { DEFAULT_SERVER_CONFIG, type ServerConfig } from './server-config.ts';

/**
 * Get whether desktop notifications are enabled.
 * Defaults to true if not set.
 */
export function getNotificationsEnabled(): boolean {
  const config = loadStoredConfig();
  if (config?.notificationsEnabled !== undefined) {
    return config.notificationsEnabled;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.notificationsEnabled;
}

/**
 * Set whether desktop notifications are enabled.
 */
export function setNotificationsEnabled(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.notificationsEnabled = enabled;
  saveConfig(config);
}

/**
 * Get whether auto-capitalisation is enabled.
 * Defaults to true if not set.
 */
export function getAutoCapitalisation(): boolean {
  const config = loadStoredConfig();
  if (config?.autoCapitalisation !== undefined) {
    return config.autoCapitalisation;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.autoCapitalisation;
}

/**
 * Set whether auto-capitalisation is enabled.
 */
export function setAutoCapitalisation(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.autoCapitalisation = enabled;
  saveConfig(config);
}

/**
 * Get the key combination used to send messages.
 * Defaults to 'enter' if not set.
 */
export function getSendMessageKey(): 'enter' | 'cmd-enter' {
  const config = loadStoredConfig();
  if (config?.sendMessageKey !== undefined) {
    return config.sendMessageKey;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.sendMessageKey;
}

/**
 * Set the key combination used to send messages.
 */
export function setSendMessageKey(key: 'enter' | 'cmd-enter'): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.sendMessageKey = key;
  saveConfig(config);
}

/**
 * Get whether spell check is enabled in the input.
 */
export function getSpellCheck(): boolean {
  const config = loadStoredConfig();
  if (config?.spellCheck !== undefined) {
    return config.spellCheck;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.spellCheck;
}

/**
 * Set whether spell check is enabled in the input.
 */
export function setSpellCheck(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.spellCheck = enabled;
  saveConfig(config);
}

/**
 * Get whether screen should stay awake while sessions are running.
 * Defaults to false if not set.
 */
export function getKeepAwakeWhileRunning(): boolean {
  const config = loadStoredConfig();
  if (config?.keepAwakeWhileRunning !== undefined) {
    return config.keepAwakeWhileRunning;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.keepAwakeWhileRunning;
}

/**
 * Set whether screen should stay awake while sessions are running.
 */
export function setKeepAwakeWhileRunning(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.keepAwakeWhileRunning = enabled;
  saveConfig(config);
}

/**
 * Get whether rich tool descriptions are enabled.
 * When enabled, all tool calls include intent and display name metadata.
 * Defaults to true if not set.
 */
export function getRichToolDescriptions(): boolean {
  const config = loadStoredConfig();
  if (config?.richToolDescriptions !== undefined) {
    return config.richToolDescriptions;
  }
  return true;
}

/**
 * Set whether rich tool descriptions are enabled.
 */
export function setRichToolDescriptions(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.richToolDescriptions = enabled;
  saveConfig(config);
}

/**
 * Get whether extended prompt cache (1h TTL) is enabled.
 * When enabled, the interceptor upgrades cache_control TTL from 5m to 1h.
 * Defaults to false if not set.
 */
export function getExtendedPromptCache(): boolean {
  const config = loadStoredConfig();
  return config?.extendedPromptCache ?? false;
}

/**
 * Set whether extended prompt cache (1h TTL) is enabled.
 */
export function setExtendedPromptCache(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.extendedPromptCache = enabled;
  saveConfig(config);
}

/**
 * Get whether the built-in browser tool is enabled.
 * When disabled, browser_tool is not included in session tools.
 * Defaults to true if not set.
 */
export function getBrowserToolEnabled(): boolean {
  const config = loadStoredConfig();
  if (config?.browserToolEnabled !== undefined) {
    return config.browserToolEnabled;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.browserToolEnabled;
}

/**
 * Set whether the built-in browser tool is enabled.
 */
export function setBrowserToolEnabled(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.browserToolEnabled = enabled;
  saveConfig(config);

  // Clear session tool caches so all sessions pick up the change immediately.
  // Lazy import to avoid circular dependency (storage ← session-scoped-tools ← storage).
  import('../agent/session-scoped-tools.ts').then(m => m.invalidateAllSessionToolsCaches()).catch(() => {});
}

/**
 * Get whether 1M context window is enabled.
 * When disabled, models use 200K context and the interceptor strips the context-1m beta header.
 * Defaults to false — the 1M beta requires Anthropic Tier 4+, and enabling it by default
 * causes 400 "Invalid Request" for lower-tier API keys on large contexts (issue #567).
 * Users opt in via AI Settings → Performance → Extended Context (1M).
 */
export function getEnable1MContext(): boolean {
  const config = loadStoredConfig();
  return config?.enable1MContext === true;
}

/**
 * Set whether 1M context window is enabled.
 */
export function setEnable1MContext(enabled: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.enable1MContext = enabled;
  saveConfig(config);
}

/**
 * Get persisted Git Bash path (Windows only).
 * Used to set CLAUDE_CODE_GIT_BASH_PATH for the SDK subprocess.
 */
export function getGitBashPath(): string | undefined {
  const config = loadStoredConfig();
  return config?.gitBashPath;
}

/**
 * Set Git Bash path (Windows only).
 * Persists to config so it survives app restarts.
 * Returns false if the config could not be loaded (path not persisted).
 */
export function setGitBashPath(path: string): boolean {
  const config = loadStoredConfig();
  if (!config) {
    console.warn('[storage] Failed to persist Git Bash path: config could not be loaded');
    return false;
  }
  config.gitBashPath = path;
  saveConfig(config);
  return true;
}

/**
 * Clear persisted Git Bash path (Windows only).
 * Used when the stored path is stale or invalid.
 */
export function clearGitBashPath(): void {
  const config = loadStoredConfig();
  if (!config || !config.gitBashPath) return;
  delete config.gitBashPath;
  saveConfig(config);
}

// Note: getDefaultWorkingDirectory/setDefaultWorkingDirectory removed
// Working directory is now stored per-workspace in workspace config.json (defaults.workingDirectory)
// Note: getDefaultPermissionMode/getEnabledPermissionModes removed
// Permission settings are now stored per-workspace in workspace config.json (defaults.permissionMode, defaults.cyclablePermissionModes)

// ============================================
// Color Theme Selection (stored in config)
// ============================================

/**
 * Get the currently selected color theme ID.
 * Returns 'default' if not set.
 */
export function getColorTheme(): string {
  const config = loadStoredConfig();
  if (config?.colorTheme !== undefined) {
    return config.colorTheme;
  }
  const defaults = loadConfigDefaults();
  return defaults.defaults.colorTheme;
}

/**
 * Set the color theme ID.
 */
export function setColorTheme(themeId: string): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.colorTheme = themeId;
  saveConfig(config);
}

// ============================================
// Auto-Update Dismissed Version
// ============================================

/**
 * Get the dismissed update version.
 * Returns null if no version is dismissed.
 */
export function getDismissedUpdateVersion(): string | null {
  const config = loadStoredConfig();
  return config?.dismissedUpdateVersion ?? null;
}

/**
 * Set the dismissed update version.
 * Pass the version string to dismiss notifications for that version.
 */
export function setDismissedUpdateVersion(version: string): void {
  const config = loadStoredConfig();
  if (!config) return;
  config.dismissedUpdateVersion = version;
  saveConfig(config);
}

/**
 * Clear the dismissed update version.
 * Call this when a new version is released (or on successful update).
 */
export function clearDismissedUpdateVersion(): void {
  const config = loadStoredConfig();
  if (!config) return;
  delete config.dismissedUpdateVersion;
  saveConfig(config);
}

// ============================================
// Default Thinking Level
// ============================================

/**
 * Get the app-level default thinking level for new sessions.
 * Falls back to bundled config-defaults when unset.
 */
export function getDefaultThinkingLevel(): ThinkingLevel {
  const config = loadStoredConfig();
  if (config?.defaultThinkingLevel) {
    const normalized = normalizeThinkingLevel(config.defaultThinkingLevel);
    if (normalized) return normalized;
  }
  const defaults = loadConfigDefaults();
  return normalizeThinkingLevel(defaults.workspaceDefaults.thinkingLevel) ?? 'medium';
}

/**
 * Set the app-level default thinking level for new sessions.
 * @returns true if persisted, false if config could not be loaded
 */
export function setDefaultThinkingLevel(level: ThinkingLevel): boolean {
  const config = loadStoredConfig();
  if (!config) return false;

  config.defaultThinkingLevel = level;
  saveConfig(config);
  return true;
}

// ============================================
// Network Proxy Settings
// ============================================

function normalizeProxyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeNetworkProxySettings(
  settings: NetworkProxySettings,
): NetworkProxySettings {
  return {
    enabled: Boolean(settings.enabled),
    httpProxy: normalizeProxyString(settings.httpProxy),
    httpsProxy: normalizeProxyString(settings.httpsProxy),
    noProxy: normalizeProxyString(settings.noProxy),
  };
}

/**
 * Get the current network proxy settings.
 * Returns undefined if not configured.
 */
export function getNetworkProxySettings(): NetworkProxySettings | undefined {
  const config = loadStoredConfig();
  return config?.networkProxy;
}

/**
 * Persist network proxy settings.
 * Deletes the key when disabled and all proxy fields are empty.
 */
export function setNetworkProxySettings(settings: NetworkProxySettings): void {
  const config = loadStoredConfig();
  if (!config) return;

  const normalized = normalizeNetworkProxySettings(settings);

  // Remove the key entirely when proxy is disabled and all fields are blank
  if (!normalized.enabled && !normalized.httpProxy && !normalized.httpsProxy && !normalized.noProxy) {
    delete config.networkProxy;
  } else {
    config.networkProxy = normalized;
  }

  saveConfig(config);
}

// ============================================
// Setup Deferred (user skipped onboarding)
// ============================================

export function isSetupDeferred(): boolean {
  return loadStoredConfig()?.setupDeferred === true;
}

export function setSetupDeferred(deferred: boolean): void {
  const config = loadStoredConfig();
  if (!config) return;
  if (deferred) {
    config.setupDeferred = true;
  } else {
    delete config.setupDeferred;
  }
  saveConfig(config);
}

// ============================================
// Server Mode Configuration
// ============================================

/**
 * Get the current server configuration.
 * Returns defaults if not yet configured.
 */
export function getServerConfig(): ServerConfig {
  const config = loadStoredConfig();
  return config?.serverConfig ?? { ...DEFAULT_SERVER_CONFIG };
}

/**
 * Persist server configuration.
 * Auto-generates a stable auth token on first enable if none exists.
 */
export function setServerConfig(serverConfig: ServerConfig): void {
  const config = loadStoredConfig();
  if (!config) return;

  // Generate a stable token when first enabled (or if token is missing)
  if (serverConfig.enabled && !serverConfig.token) {
    serverConfig.token = randomUUID();
  }

  config.serverConfig = serverConfig;
  saveConfig(config);
}
