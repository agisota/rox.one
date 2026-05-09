/**
 * LLM connection CRUD plus all startup migrations: legacy auth → connections,
 * Codex/Copilot → Pi, Bedrock/Vertex → Pi, model bumps (Opus/Sonnet 4.5 → 4.6,
 * Opus 4.6 restoration), modelDefaults backfill, orphaned default repair, and
 * legacy credential migration.
 * Sibling files: storage-io.ts, storage-settings.ts, storage-workspaces.ts,
 * storage-conversations.ts, storage-drafts.ts, storage-themes.ts,
 * storage-tool-icons.ts.
 */
import { getCredentialManager } from '../credentials/index.ts';
import { loadWorkspaceConfig, saveWorkspaceConfig } from '../workspaces/storage.ts';
import { debug } from '../utils/debug.ts';
import type { AuthType } from '@rox-agent/core/types';
import type { LlmConnection } from './llm-connections.ts';
import {
  isValidProviderAuthCombination,
  getDefaultModelsForConnection,
  getDefaultModelForConnection,
  isPiProvider,
  toBedrockNativeId,
  type LlmProviderType,
} from './llm-connections.ts';
import { getModelProvider, getModelById } from './models.ts';
import { loadStoredConfig, saveConfig, type StoredConfig } from './storage-io.ts';
import { getWorkspaces } from './storage-workspaces.ts';
import { DEFAULT_LOCAL_SCOPE, type WorkspaceScope } from './storage-scope.ts';

// Re-export types for convenience (imports are at top of file)
export type {
  LlmConnection,
  LlmProviderType,
  LlmAuthType,
  LlmConnectionWithStatus,
} from './llm-connections.ts';

/**
 * Migrate Codex (OpenAI) and Copilot connections to Pi backend.
 * Runs on startup — transparently routes existing users through PiAgent.
 *
 * No re-auth needed: credentials are keyed by connection slug (not provider),
 * and PiAgent reads the same OAuth tokens via piAuthProvider.
 *
 * Migration rules:
 * - openai + oauth       → pi + openai-codex
 * - openai + api_key     → pi + openai
 * - openai_compat        → pi + openai  (keep baseUrl)
 * - copilot              → pi + github-copilot
 * - defaultModel reset to Pi's default (stale Codex/Copilot model IDs dropped)
 * - codexPath removed (no longer needed)
 */
function migrateCodexCopilotToPi(config: StoredConfig): boolean {
  if (!config.llmConnections) return false;
  let changed = false;

  for (const connection of config.llmConnections) {
    // Cast to string for legacy providerType values that were removed from LlmProviderType
    // but may still exist on disk in old configs. Cast to any for legacy codexPath field.
    const providerStr = connection.providerType as string;
    const connAny = connection as any;
    if (providerStr === 'openai' && connection.authType === 'oauth') {
      connection.providerType = 'pi';
      connection.piAuthProvider = 'openai-codex';
      connection.name = 'ChatGPT Plus (via Pi)';
      delete connAny.codexPath;
      connection.defaultModel = undefined; // reset — backfill picks Pi default
      connection.models = undefined;
      changed = true;
    } else if (providerStr === 'openai' && (connection.authType === 'api_key' || connection.authType === 'api_key_with_endpoint')) {
      connection.providerType = 'pi';
      connection.piAuthProvider = 'openai';
      connection.name = 'OpenAI API (via Pi)';
      delete connAny.codexPath;
      connection.defaultModel = undefined;
      connection.models = undefined;
      changed = true;
    } else if (providerStr === 'openai_compat') {
      connection.providerType = 'pi';
      connection.piAuthProvider = 'openai';
      // keep baseUrl for custom endpoints
      delete connAny.codexPath;
      connection.defaultModel = undefined;
      connection.models = undefined;
      changed = true;
    } else if (providerStr === 'copilot') {
      connection.providerType = 'pi';
      connection.piAuthProvider = 'github-copilot';
      connection.name = 'GitHub Copilot (via Pi)';
      delete connAny.codexPath;
      connection.defaultModel = undefined;
      connection.models = undefined;
      changed = true;
    }
  }

  // Clean up openaiVariant config field (Codex-specific A/B testing, no longer relevant)
  const configAny = config as any;
  if (configAny.openaiVariant) {
    delete configAny.openaiVariant;
    changed = true;
  }

  return changed;
}

/**
 * Backfill models and defaultModel on ALL connections.
 * Ensures built-in connections (anthropic, openai) always have models populated,
 * not just compat connections.
 */
export function shouldMigratePiOpenAiProvider(connection: Pick<LlmConnection, 'providerType' | 'piAuthProvider' | 'authType' | 'baseUrl'>): boolean {
  // Legacy cleanup: old ChatGPT Plus OAuth connections may still be tagged as `openai`.
  // Only migrate those to `openai-codex`.
  //
  // IMPORTANT: Do NOT migrate API-key or custom-endpoint connections:
  // - `api_key` / `api_key_with_endpoint` with `openai` must remain regular OpenAI API auth.
  // - forcing them to `openai-codex` routes requests to ChatGPT backend auth and breaks on restart.
  if (!isPiProvider(connection.providerType)) return false;
  if (connection.piAuthProvider !== 'openai') return false;
  if (connection.authType !== 'oauth') return false;
  if (typeof connection.baseUrl === 'string' && connection.baseUrl.trim().length > 0) return false;
  return true;
}

export function shouldRepairPiApiKeyCodexProvider(connection: Pick<LlmConnection, 'providerType' | 'piAuthProvider' | 'authType'>): boolean {
  // Repair broken state from previous startup migrations:
  // API-key connections tagged as `openai-codex` try ChatGPT backend JWT auth and fail.
  if (!isPiProvider(connection.providerType)) return false;
  if (connection.piAuthProvider !== 'openai-codex') return false;
  return connection.authType === 'api_key' || connection.authType === 'api_key_with_endpoint';
}

function normalizeModelIds(models?: Array<{ id: string } | string>): string[] {
  if (!models) return [];
  return models
    .map(m => typeof m === 'string' ? m : m.id)
    .filter((id): id is string => !!id && id.trim().length > 0);
}

function modelSetEquals(a: string[], b: string[]): boolean {
  const as = new Set(a);
  const bs = new Set(b);
  if (as.size !== bs.size) return false;
  for (const id of as) {
    if (!bs.has(id)) return false;
  }
  return true;
}

export function inferModelSelectionMode(
  connection: Pick<LlmConnection, 'models'>,
  providerDefaultModelIds: string[],
): 'automaticallySyncedFromProvider' | 'userDefined3Tier' {
  const currentIds = normalizeModelIds(connection.models);
  if (currentIds.length === 0) return 'automaticallySyncedFromProvider';
  return modelSetEquals(currentIds, providerDefaultModelIds)
    ? 'automaticallySyncedFromProvider'
    : 'userDefined3Tier';
}

function backfillAllConnectionModels(config: StoredConfig): boolean {
  if (!config.llmConnections) return false;
  let changed = false;
  for (const connection of config.llmConnections) {
    // Repair previously broken API-key migration first.
    if (shouldRepairPiApiKeyCodexProvider(connection)) {
      connection.piAuthProvider = 'openai';
      changed = true;
    }

    // Migrate only legacy OAuth-backed Pi OpenAI connections to ChatGPT backend provider key.
    if (shouldMigratePiOpenAiProvider(connection)) {
      connection.piAuthProvider = 'openai-codex';
      changed = true;
    }

    const defaultModels = getDefaultModelsForConnection(connection.providerType, connection.piAuthProvider);
    const defaultModel = getDefaultModelForConnection(connection.providerType, connection.piAuthProvider);
    const providerDefaultModelIds = normalizeModelIds(defaultModels as Array<{ id: string } | string>);

    // Note: bedrock connections are migrated to pi + amazon-bedrock by migrateLegacyProviderTypes()
    // before this function runs, so no bedrock-specific normalization needed here.

    if (isPiProvider(connection.providerType) && connection.piAuthProvider) {
      // Copilot models are always server-managed (GitHub policy controls which
      // models are enabled), so force automaticallySyncedFromProvider regardless
      // of what inferModelSelectionMode would compute from stale static SDK data.
      const isCopilot = connection.piAuthProvider === 'github-copilot';
      const mode = isCopilot
        ? 'automaticallySyncedFromProvider' as const
        : (connection.modelSelectionMode ?? inferModelSelectionMode(connection, providerDefaultModelIds));
      if (connection.modelSelectionMode !== mode) {
        debug('[storage] backfill mode inferred', {
          slug: connection.slug,
          piAuthProvider: connection.piAuthProvider,
          from: connection.modelSelectionMode,
          to: mode,
          currentModelCount: normalizeModelIds(connection.models).length,
        });
        connection.modelSelectionMode = mode;
        changed = true;
      }

      if (mode === 'automaticallySyncedFromProvider') {
        const currentIds = normalizeModelIds(connection.models);
        if (providerDefaultModelIds.length > 0 && !modelSetEquals(currentIds, providerDefaultModelIds)) {
          connection.models = defaultModels;
          changed = true;
        }
      } else {
        const currentIds = normalizeModelIds(connection.models);
        if (providerDefaultModelIds.length > 0) {
          const allowedIds = new Set(providerDefaultModelIds);
          const canonicalCurrentIds = currentIds.map((id) => {
            if (allowedIds.has(id)) return id;
            if (!id.startsWith('pi/')) {
              const prefixed = `pi/${id}`;
              if (allowedIds.has(prefixed)) return prefixed;
            }
            return id;
          });
          const filtered = canonicalCurrentIds.filter(id => allowedIds.has(id));

          if (!modelSetEquals(canonicalCurrentIds, currentIds) || filtered.length !== currentIds.length) {
            debug('[storage] backfill userDefined filtered', {
              slug: connection.slug,
              piAuthProvider: connection.piAuthProvider,
              beforeCount: currentIds.length,
              canonicalCount: canonicalCurrentIds.length,
              afterCount: filtered.length,
              beforeFirst5: currentIds.slice(0, 5),
              afterFirst5: filtered.slice(0, 5),
            });
            connection.models = filtered;
            changed = true;
          }

          if (filtered.length === 0) {
            debug('[storage] backfill userDefined fallback-to-defaults', {
              slug: connection.slug,
              piAuthProvider: connection.piAuthProvider,
              defaultCount: providerDefaultModelIds.length,
            });
            connection.models = defaultModels;
            changed = true;
          }
        }
      }
    }

    if (defaultModels.length > 0 && (!connection.models || (Array.isArray(connection.models) && connection.models.length === 0))) {
      connection.models = defaultModels;
      changed = true;
    }

    if (!connection.defaultModel && defaultModel) {
      connection.defaultModel = defaultModel;
      changed = true;
    }

    // Validate that existing defaultModel is in the models list
    if (connection.defaultModel && connection.models && Array.isArray(connection.models) && connection.models.length > 0) {
      const modelIds = connection.models.map(m => typeof m === 'string' ? m : m.id);
      if (!modelIds.includes(connection.defaultModel)) {
        // Reset to first available model in the list
        const firstModelId = modelIds[0];
        if (firstModelId) {
          connection.defaultModel = firstModelId;
        }
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Migrate Opus 4.5 to Opus 4.6 for direct Anthropic connections (API key or OAuth).
 * Only applies to anthropic provider type (not compat), as third-party providers
 * like OpenRouter may not support the new model ID yet.
 */
function migrateOpus45ToOpus46(config: StoredConfig): boolean {
  if (!config.llmConnections) return false;

  const OPUS_45_ID = 'claude-opus-4-5-20251101';
  const OPUS_46_ID = 'claude-opus-4-6';

  let changed = false;

  for (const connection of config.llmConnections) {
    // Only migrate direct Anthropic connections (not compat/third-party)
    if (connection.providerType !== 'anthropic') continue;

    // Migrate defaultModel
    if (connection.defaultModel === OPUS_45_ID) {
      connection.defaultModel = OPUS_46_ID;
      changed = true;
    }

    // Migrate models array
    if (connection.models && Array.isArray(connection.models)) {
      const hasNew = connection.models.some(m =>
        (typeof m === 'string' ? m : m.id) === OPUS_46_ID
      );

      if (hasNew) {
        // New model already exists — just remove the old entry to avoid duplicates
        const before = connection.models.length;
        connection.models = connection.models.filter(m =>
          (typeof m === 'string' ? m : m.id) !== OPUS_45_ID
        );
        if (connection.models.length !== before) changed = true;
      } else {
        // New model doesn't exist — rename the old entry in place
        for (let i = 0; i < connection.models.length; i++) {
          const model = connection.models[i];
          if (typeof model === 'string' && model === OPUS_45_ID) {
            connection.models[i] = OPUS_46_ID;
            changed = true;
          } else if (typeof model === 'object' && model.id === OPUS_45_ID) {
            model.id = OPUS_46_ID;
            if (model.name?.includes('4.5')) {
              model.name = model.name.replace('4.5', '4.6');
            }
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

// TODO(opus-4.6-sunset): delete this migration, its call site, its one-shot
// marker ('opus-4-6-restored'), and the associated test when Opus 4.6 is
// deprecated. This reverses the earlier forward migration Opus 4.6 → 4.7
// that was removed in the same commit — users who were auto-migrated no
// longer had 4.6 in their connection.models, so the picker wouldn't show it.
/**
 * Restore claude-opus-4-6 to direct Anthropic connections that were previously
 * force-migrated to 4.7 and no longer list 4.6. Runs once per user (tracked via
 * config.migrationsApplied). Never touches `defaultModel` — users keep whatever
 * default they had, and can switch models themselves.
 */
function restoreOpus46ToAnthropicConnections(config: StoredConfig): boolean {
  const OPUS_46_ID = 'claude-opus-4-6';
  const OPUS_47_ID = 'claude-opus-4-7';
  const MARKER = 'opus-4-6-restored';
  const alreadyRan = config.migrationsApplied?.includes(MARKER) ?? false;

  // Anthropic connection.models entries are stored as full ModelDefinition
  // objects (via backfillAllConnectionModels). The model picker reads
  // model.name and falls back to the raw ID for bare strings, so we must
  // push the object form to render as "Opus 4.6".
  const opus46Model = getModelById(OPUS_46_ID);
  if (!opus46Model) {
    // Defensive — 4.6 is registered in this same PR, should never happen.
    if (!alreadyRan) {
      config.migrationsApplied = [...(config.migrationsApplied ?? []), MARKER];
      return true;
    }
    return false;
  }

  let changed = false;

  for (const connection of config.llmConnections ?? []) {
    if (connection.providerType !== 'anthropic') continue;
    if (!Array.isArray(connection.models) || connection.models.length === 0) continue;

    // Idempotent shape repair: normalize any bare-string 'claude-opus-4-6'
    // entry to the ModelDefinition object form. Runs regardless of the
    // one-shot marker because it's a display-shape fix, not a new entry.
    for (let i = 0; i < connection.models.length; i++) {
      const m = connection.models[i];
      if (typeof m === 'string' && m === OPUS_46_ID) {
        connection.models[i] = { ...opus46Model };
        changed = true;
      }
    }

    // One-shot restore: only append 4.6 on the first run for a given user.
    // A deliberate removal after the marker is set should stick.
    if (alreadyRan) continue;

    const ids = connection.models.map(m => typeof m === 'string' ? m : m.id);
    if (ids.includes(OPUS_47_ID) && !ids.includes(OPUS_46_ID)) {
      connection.models.push({ ...opus46Model });
      changed = true;
    }
  }

  // Mark the migration as seen on the first run — even when no connection
  // was eligible — so subsequent runs don't keep re-checking.
  if (!alreadyRan) {
    config.migrationsApplied = [...(config.migrationsApplied ?? []), MARKER];
    return true;
  }
  return changed;
}

/**
 * Migrate Sonnet 4.5 to Sonnet 4.6 for direct Anthropic connections.
 * Same pattern as migrateOpus45ToOpus46 — updates stored model IDs and names.
 */
function migrateSonnet45ToSonnet46(config: StoredConfig): boolean {
  if (!config.llmConnections) return false;

  const SONNET_45_ID = 'claude-sonnet-4-5-20250929';
  const SONNET_46_ID = 'claude-sonnet-4-6';

  let changed = false;

  for (const connection of config.llmConnections) {
    // Only migrate direct Anthropic connections (not compat/third-party)
    if (connection.providerType !== 'anthropic') continue;

    // Migrate defaultModel
    if (connection.defaultModel === SONNET_45_ID) {
      connection.defaultModel = SONNET_46_ID;
      changed = true;
    }

    // Migrate models array
    if (connection.models && Array.isArray(connection.models)) {
      const hasNew = connection.models.some(m =>
        (typeof m === 'string' ? m : m.id) === SONNET_46_ID
      );

      if (hasNew) {
        // New model already exists — just remove the old entry to avoid duplicates
        const before = connection.models.length;
        connection.models = connection.models.filter(m =>
          (typeof m === 'string' ? m : m.id) !== SONNET_45_ID
        );
        if (connection.models.length !== before) changed = true;
      } else {
        // New model doesn't exist — rename the old entry in place
        for (let i = 0; i < connection.models.length; i++) {
          const model = connection.models[i];
          if (typeof model === 'string' && model === SONNET_45_ID) {
            connection.models[i] = SONNET_46_ID;
            changed = true;
          } else if (typeof model === 'object' && model.id === SONNET_45_ID) {
            model.id = SONNET_46_ID;
            if (model.name?.includes('4.5')) {
              model.name = model.name.replace('4.5', '4.6');
            }
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

/**
 * Migrate Sonnet 4.5 to Sonnet 4.6 in workspace default models.
 */
function migrateWorkspaceSonnet45ToSonnet46(config: StoredConfig): void {
  if (!config.workspaces) return;

  const SONNET_45_ID = 'claude-sonnet-4-5-20250929';
  const SONNET_46_ID = 'claude-sonnet-4-6';

  for (const workspace of config.workspaces) {
    const wsConfig = loadWorkspaceConfig(workspace.rootPath);
    if (!wsConfig?.defaults?.model) continue;

    if (wsConfig.defaults.model === SONNET_45_ID) {
      wsConfig.defaults.model = SONNET_46_ID;
      saveWorkspaceConfig(workspace.rootPath, wsConfig);
    }
  }
}

/**
 * Migrate Opus 4.5 to Opus 4.6 in workspace default models.
 * Iterates over all workspaces and updates defaults.model if it's Opus 4.5.
 */
function migrateWorkspaceOpus45ToOpus46(config: StoredConfig): void {
  if (!config.workspaces) return;

  const OPUS_45_ID = 'claude-opus-4-5-20251101';
  const OPUS_46_ID = 'claude-opus-4-6';

  for (const workspace of config.workspaces) {
    const wsConfig = loadWorkspaceConfig(workspace.rootPath);
    if (!wsConfig?.defaults?.model) continue;

    if (wsConfig.defaults.model === OPUS_45_ID) {
      wsConfig.defaults.model = OPUS_46_ID;
      saveWorkspaceConfig(workspace.rootPath, wsConfig);
    }
  }
}

/**
 * Migrate legacy provider types to the active set (anthropic, pi, pi_compat).
 *
 * 1. providerType==='bedrock' → 'pi' with piAuthProvider='amazon-bedrock'.
 *    Model IDs are normalized to Bedrock-native (pi-prefixed) for Pi SDK resolution.
 *
 * 2. providerType==='vertex' → 'pi' with piAuthProvider='google-vertex'.
 *
 * 3. providerType==='anthropic_compat' → 'pi_compat' with customEndpoint.api='anthropic-messages'.
 *    Preserves baseUrl and models; authType 'api_key_with_endpoint' stays the same.
 *
 * Also normalizes Pi+Bedrock connections that already have correct providerType.
 */
function migrateLegacyProviderTypes(config: StoredConfig): boolean {
  if (!config.llmConnections) return false;

  let changed = false;

  for (const connection of config.llmConnections) {
    // Cast to string for legacy values removed from LlmProviderType
    const providerStr = connection.providerType as string;

    // --- bedrock → pi + amazon-bedrock ---
    if (providerStr === 'bedrock') {
      (connection as { providerType: LlmProviderType }).providerType = 'pi';
      connection.piAuthProvider = connection.piAuthProvider || 'amazon-bedrock';
      // Normalize model IDs to Bedrock-native (pi-prefixed) for Pi SDK
      if (connection.defaultModel) {
        connection.defaultModel = normalizePiBedrockId(connection.defaultModel);
      }
      if (connection.models && Array.isArray(connection.models)) {
        for (let i = 0; i < connection.models.length; i++) {
          const model = connection.models[i];
          if (typeof model === 'string') {
            connection.models[i] = normalizePiBedrockId(model);
          } else if (model && typeof model === 'object') {
            model.id = normalizePiBedrockId(model.id);
          }
        }
      }
      changed = true;
      continue;
    }

    // --- vertex → pi + google-vertex ---
    if (providerStr === 'vertex') {
      (connection as { providerType: LlmProviderType }).providerType = 'pi';
      connection.piAuthProvider = 'google-vertex';
      changed = true;
      continue;
    }

    // --- anthropic_compat → pi_compat + customEndpoint ---
    if (providerStr === 'anthropic_compat') {
      (connection as { providerType: LlmProviderType }).providerType = 'pi_compat';
      connection.customEndpoint = { api: 'anthropic-messages' };
      // authType 'api_key_with_endpoint' stays; baseUrl and models are preserved
      changed = true;
      continue;
    }

    // Forward: Pi+Bedrock connections need Bedrock-native IDs (pi-prefixed) for Pi SDK resolution
    if (connection.providerType === 'pi' && connection.piAuthProvider === 'amazon-bedrock') {
      if (connection.defaultModel) {
        const normalized = normalizePiBedrockId(connection.defaultModel);
        if (normalized !== connection.defaultModel) {
          connection.defaultModel = normalized;
          changed = true;
        }
      }
      if (connection.models && Array.isArray(connection.models)) {
        for (let i = 0; i < connection.models.length; i++) {
          const model = connection.models[i];
          if (typeof model === 'string') {
            const normalized = normalizePiBedrockId(model);
            if (normalized !== model) { connection.models[i] = normalized; changed = true; }
          } else if (model && typeof model === 'object') {
            const normalized = normalizePiBedrockId(model.id);
            if (normalized !== model.id) { model.id = normalized; changed = true; }
          }
        }
      }
    }
  }

  return changed;
}

/** Normalize a pi/-prefixed model ID for Bedrock: pi/claude-opus-4-7 → pi/anthropic.claude-opus-4-7-v1 */
function normalizePiBedrockId(id: string): string {
  if (id.startsWith('pi/')) {
    const bare = id.slice(3);
    const native = toBedrockNativeId(bare);
    return native !== bare ? `pi/${native}` : id;
  }
  return id;
}

/**
 * Migrate modelDefaults onto connection.defaultModel, then delete modelDefaults.
 * If user had set modelDefaults.anthropic, apply it to the default anthropic connection.
 * Same for openai. Then remove modelDefaults from config.
 */
function migrateModelDefaultsToConnections(config: StoredConfig): boolean {
  const configAny = config as any;
  if (!configAny.modelDefaults || !config.llmConnections) return false;
  let changed = false;

  // Apply anthropic model default to the default anthropic connection
  if (configAny.modelDefaults.anthropic) {
    const defaultSlug = config.defaultLlmConnection;
    const anthropicConn = config.llmConnections.find(c =>
      c.slug === defaultSlug && c.providerType === 'anthropic'
    ) || config.llmConnections.find(c =>
      c.providerType === 'anthropic'
    );
    if (anthropicConn) {
      anthropicConn.defaultModel = configAny.modelDefaults.anthropic;
      changed = true;
    }
  }

  // Apply openai model default to the default openai connection
  // Cast providerType to string for legacy values removed from LlmProviderType
  if (configAny.modelDefaults.openai) {
    const openaiConn = config.llmConnections.find(c =>
      (c.providerType as string) === 'openai' || (c.providerType as string) === 'openai_compat'
    );
    if (openaiConn) {
      openaiConn.defaultModel = configAny.modelDefaults.openai;
      changed = true;
    }
  }

  // Delete modelDefaults
  delete configAny.modelDefaults;
  changed = true;

  return changed;
}

/**
 * Migrate legacy auth config to LLM connections.
 * Call this on app startup before any getLlmConnections() calls.
 *
 * This is a one-time migration that converts:
 * - Legacy authType field → LlmConnection in llmConnections array
 * - Legacy anthropicBaseUrl → LlmConnection.baseUrl
 * - Legacy customModel → LlmConnection.defaultModel
 * - Legacy model → modelDefaults (per provider)
 *
 * After migration, the legacy fields are deleted since they are no longer used.
 */
export function migrateLegacyLlmConnectionsConfig(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const config = loadStoredConfig();
  if (!config) return;

  const normalizeModelList = (models?: Array<{ id: string } | string>): string[] => {
    if (!models) return [];
    return models
      .map(model => (typeof model === 'string' ? model : model.id))
      .filter(Boolean);
  };

  const applyCompatDefaults = (target: StoredConfig): boolean => {
    if (!target.llmConnections) return false;
    let changed = false;
    for (const connection of target.llmConnections) {
      // Cast to string for legacy 'openai_compat' values that may still exist on disk
      const providerStr = connection.providerType as string;
      if (providerStr !== 'openai_compat') {
        continue;
      }
      const compatDefaults = getDefaultModelsForConnection(connection.providerType).map(
        m => typeof m === 'string' ? m : m.id
      );
      const normalizedModels = normalizeModelList(connection.models);
      if (normalizedModels.length === 0) {
        connection.models = [...compatDefaults];
        changed = true;
      } else if (normalizedModels.length !== (connection.models?.length ?? 0)) {
        connection.models = [...normalizedModels];
        changed = true;
      }
      // Backfill any new default models that are missing from existing connections
      // (e.g., Sonnet added to compat defaults after user already created connection)
      let currentModels = normalizeModelList(connection.models);
      for (const defaultModel of compatDefaults) {
        if (!currentModels.includes(defaultModel)) {
          currentModels = [...currentModels, defaultModel];
          changed = true;
        }
      }
      if (changed) {
        connection.models = currentModels;
      }
      const currentDefault = connection.defaultModel?.trim();
      if (!currentDefault) {
        connection.defaultModel = (normalizeModelList(connection.models)[0] ?? compatDefaults[0]);
        changed = true;
      } else if (!normalizeModelList(connection.models).includes(currentDefault)) {
        connection.models = [currentDefault, ...normalizeModelList(connection.models).filter(m => m !== currentDefault)];
        changed = true;
      }
    }
    return changed;
  };

  // Already migrated - llmConnections array exists
  if (config.llmConnections !== undefined) {
    // Clean up any remaining legacy fields from previous runs
    let needsSave = false;
    const configAny = config as any;
    if ('authType' in config) {
      delete configAny.authType;
      needsSave = true;
    }
    if ('anthropicBaseUrl' in config) {
      delete configAny.anthropicBaseUrl;
      needsSave = true;
    }
    if ('customModel' in config) {
      delete configAny.customModel;
      needsSave = true;
    }
    if ('model' in config) {
      const legacyModel = configAny.model as string | undefined;
      if (legacyModel) {
        const provider = getModelProvider(legacyModel) ?? 'anthropic';
        configAny.modelDefaults = { ...(configAny.modelDefaults ?? {}), [provider]: legacyModel };
      }
      delete configAny.model;
      needsSave = true;
    }
    // Note: applyCompatDefaults() is NOT called here for already-migrated configs.
    // Compat connections are user-owned after creation — the app should not
    // silently extend or override the user's model list on every startup.
    // Compat defaults are only applied during fresh connection creation or
    // first-time legacy migration (the config.llmConnections === undefined path below).

    // Phase 1a-bis: Migrate Codex/Copilot connections to Pi backend
    if (migrateCodexCopilotToPi(config)) {
      needsSave = true;
    }

    // Phase 1b: Backfill models/defaultModel on ALL connections (not just compat)
    // This ensures built-in connections (anthropic, openai) always have models populated
    if (backfillAllConnectionModels(config)) {
      needsSave = true;
    }
    // Phase 1c: Migrate modelDefaults onto connection.defaultModel, then delete modelDefaults
    if (migrateModelDefaultsToConnections(config)) {
      needsSave = true;
    }
    // Phase 1d: Migrate Opus 4.5 → Opus 4.6 for direct Anthropic connections
    if (migrateOpus45ToOpus46(config)) {
      needsSave = true;
    }
    // Phase 1e: Migrate Opus 4.5 → Opus 4.6 in workspace default models
    migrateWorkspaceOpus45ToOpus46(config);
    // Phase 1f: Migrate Sonnet 4.5 → Sonnet 4.6 for direct Anthropic connections
    if (migrateSonnet45ToSonnet46(config)) {
      needsSave = true;
    }
    // Phase 1g: Migrate Sonnet 4.5 → Sonnet 4.6 in workspace default models
    migrateWorkspaceSonnet45ToSonnet46(config);
    // Phase 1h: Restore Opus 4.6 to direct Anthropic connections that were
    // previously force-migrated away from it (one-shot, guarded by marker).
    // TODO(opus-4.6-sunset): drop this call and the function when 4.6 is deprecated.
    if (restoreOpus46ToAnthropicConnections(config)) {
      needsSave = true;
    }
    // Phase 1j: Migrate legacy provider types (bedrock/vertex/anthropic_compat → pi/pi_compat)
    if (migrateLegacyProviderTypes(config)) {
      needsSave = true;
    }

    if (needsSave) {
      saveConfig(config);
    }
    return;
  }

  // Initialize empty array
  config.llmConnections = [];

  // Legacy migration: if user had authType set, create a connection for them
  const configAny = config as any;
  const legacyAuthType = configAny.authType as AuthType | undefined;
  const legacyBaseUrl = configAny.anthropicBaseUrl as string | undefined;
  const legacyCustomModel = configAny.customModel as string | undefined;
  const legacyModel = configAny.model as string | undefined;

  if (legacyAuthType) {
    let migrated: LlmConnection | null = null;

    if (legacyAuthType === 'oauth_token') {
      // Claude Max OAuth
      migrated = {
        slug: 'claude-max',
        name: 'Claude Max',
        providerType: 'anthropic',
        authType: 'oauth',
        models: getDefaultModelsForConnection('anthropic'),
        createdAt: Date.now(),
      };
    } else if (legacyAuthType === 'codex_oauth') {
      // ChatGPT Plus OAuth → Pi backend
      migrated = {
        slug: 'codex',
        name: 'ChatGPT Plus (via Pi)',
        providerType: 'pi',
        authType: 'oauth',
        piAuthProvider: 'openai-codex',
        modelSelectionMode: 'automaticallySyncedFromProvider',
        models: getDefaultModelsForConnection('pi', 'openai-codex'),
        createdAt: Date.now(),
      };
    } else if (legacyAuthType === 'codex_api_key') {
      // OpenAI API Key → Pi backend
      migrated = {
        slug: 'codex-api',
        name: 'OpenAI API (via Pi)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'openai',
        modelSelectionMode: 'automaticallySyncedFromProvider',
        models: getDefaultModelsForConnection('pi', 'openai'),
        createdAt: Date.now(),
      };
    } else if (legacyAuthType === 'api_key') {
      // Anthropic API Key - check if custom endpoint (compat mode → pi_compat)
      const hasCustomEndpoint = !!legacyBaseUrl;
      if (hasCustomEndpoint) {
        migrated = {
          slug: 'anthropic-api',
          name: 'Custom Anthropic-Compatible',
          providerType: 'pi_compat',
          authType: 'api_key_with_endpoint',
          customEndpoint: { api: 'anthropic-messages' },
          models: getDefaultModelsForConnection('pi_compat'),
          createdAt: Date.now(),
        };
      } else {
        migrated = {
          slug: 'anthropic-api',
          name: 'Anthropic (API Key)',
          providerType: 'anthropic',
          authType: 'api_key',
          models: getDefaultModelsForConnection('anthropic'),
          createdAt: Date.now(),
        };
      }
    }

    if (migrated) {
      // Validate the migrated connection has a valid provider/auth combination
      if (!isValidProviderAuthCombination(migrated.providerType, migrated.authType)) {
        console.warn(
          `[config] Legacy migration created invalid provider/auth combination: ` +
          `providerType=${migrated.providerType}, authType=${migrated.authType} ` +
          `(slug: ${migrated.slug}). Skipping migration for this connection.`
        );
      } else {
        // Apply legacy baseUrl if set
        if (legacyBaseUrl) {
          migrated.baseUrl = legacyBaseUrl;
        }

        // Apply legacy customModel if set
        if (legacyCustomModel) {
          migrated.defaultModel = legacyCustomModel;
        }

        config.llmConnections.push(migrated);
        config.defaultLlmConnection = migrated.slug;
      }
    }
  }

  // Delete legacy fields after migration
  delete configAny.authType;
  delete configAny.anthropicBaseUrl;
  delete configAny.customModel;
  delete configAny.model;

  if (legacyModel) {
    const provider = getModelProvider(legacyModel) ?? 'anthropic';
    configAny.modelDefaults = { ...(configAny.modelDefaults ?? {}), [provider]: legacyModel };
  }

  // Run the same backfill and migration on newly created connections
  migrateCodexCopilotToPi(config);
  backfillAllConnectionModels(config);
  migrateModelDefaultsToConnections(config);

  saveConfig(config);
}

/**
 * Fix defaultLlmConnection references that point to non-existent connections.
 * This can happen when a connection is removed or was never created
 * (e.g. "anthropic-api" is set as default but only "claude-max" exists).
 *
 * Fixes both the global defaultLlmConnection and per-workspace defaults.
 * Called on app startup alongside other migrations.
 */
export function migrateOrphanedDefaultConnections(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const config = loadStoredConfig();
  if (!config) return;
  if (!config.llmConnections || config.llmConnections.length === 0) return;

  let changed = false;

  // Fix global default if it points to a non-existent connection
  if (ensureDefaultLlmConnection(config)) {
    changed = true;
  }

  // Fix workspace defaults that point to non-existent connections
  try {
    const workspaces = getWorkspaces();
    for (const ws of workspaces) {
      const wsConfig = loadWorkspaceConfig(ws.rootPath);
      if (wsConfig?.defaults?.defaultLlmConnection) {
        const exists = config.llmConnections.some(
          c => c.slug === wsConfig.defaults!.defaultLlmConnection
        );
        if (!exists) {
          delete wsConfig.defaults.defaultLlmConnection;
          saveWorkspaceConfig(ws.rootPath, wsConfig);
        }
      }
    }
  } catch (error) {
    console.error('Failed to clean up workspace default connection references:', error);
  }

  if (changed) {
    saveConfig(config);
  }
}

/**
 * Ensure default LLM connection is set correctly.
 * Called internally by write operations to fix inconsistent state.
 * This is NOT called on read - reads never modify config.
 */
function ensureDefaultLlmConnection(config: StoredConfig): boolean {
  if (!config.llmConnections || config.llmConnections.length === 0) {
    return false;
  }

  const defaultExists = config.llmConnections.some(c => c.slug === config.defaultLlmConnection);
  if (!config.defaultLlmConnection || !defaultExists) {
    config.defaultLlmConnection = config.llmConnections[0]!.slug;
    return true;
  }

  return false;
}

/**
 * Migrate legacy global credentials to LLM connection-scoped credentials.
 * This ensures that credentials saved before the LLM connections system
 * are available through the new connection-based auth.
 *
 * Called on app startup (async operation, credentials use encrypted storage).
 *
 * Migration mapping:
 * - claude_oauth::global → llm_oauth::claude-max
 * - anthropic_api_key::global → llm_api_key::anthropic-api
 *
 * After successful migration, legacy credentials are deleted to prevent
 * stale data and reduce credential store clutter.
 */
export async function migrateLegacyCredentials(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): Promise<void> {
  const manager = getCredentialManager();
  const debug = (await import('../utils/debug.ts')).debug;

  // Migrate Claude OAuth: claude_oauth::global → llm_oauth::claude-max
  const legacyClaudeOAuth = await manager.getClaudeOAuthCredentials();
  if (legacyClaudeOAuth?.accessToken) {
    // Only migrate if llm_oauth::claude-max doesn't exist yet
    const existingLlmOAuth = await manager.getLlmOAuth('claude-max');
    if (!existingLlmOAuth) {
      await manager.setLlmOAuth('claude-max', {
        accessToken: legacyClaudeOAuth.accessToken,
        refreshToken: legacyClaudeOAuth.refreshToken,
        expiresAt: legacyClaudeOAuth.expiresAt,
      });
      debug('[storage] Migrated legacy Claude OAuth to llm_oauth::claude-max');

      // Delete legacy credential after successful migration
      // Global credentials use just the type - the key format is {type}::global
      try {
        await manager.delete({ type: 'claude_oauth' });
        debug('[storage] Deleted legacy claude_oauth::global credential');
      } catch (error) {
        debug('[storage] Failed to delete legacy claude_oauth::global:', error);
      }
    }
  }

  // Migrate Anthropic API key: anthropic_api_key::global → llm_api_key::anthropic-api
  const legacyApiKey = await manager.getApiKey();
  if (legacyApiKey) {
    // Only migrate if llm_api_key::anthropic-api doesn't exist yet
    const existingLlmApiKey = await manager.getLlmApiKey('anthropic-api');
    if (!existingLlmApiKey) {
      await manager.setLlmApiKey('anthropic-api', legacyApiKey);
      debug('[storage] Migrated legacy Anthropic API key to llm_api_key::anthropic-api');

      // Delete legacy credential after successful migration
      // Global credentials use just the type - the key format is {type}::global
      try {
        await manager.delete({ type: 'anthropic_api_key' });
        debug('[storage] Deleted legacy anthropic_api_key::global credential');
      } catch (error) {
        debug('[storage] Failed to delete legacy anthropic_api_key::global:', error);
      }
    }
  }
}

/**
 * Get all LLM connections.
 * Returns only user-added connections (no auto-populated built-ins).
 *
 * Note: This function is read-only and never modifies config.
 * Call migrateLegacyLlmConnectionsConfig() on app startup to handle migration.
 */
export function getLlmConnections(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): LlmConnection[] {
  const config = loadStoredConfig();
  if (!config) return [];

  // Return empty array if not migrated yet - caller should call migration on startup
  return config.llmConnections || [];
}

/**
 * Get a specific LLM connection by slug.
 * @param slug - Connection slug
 * @returns Connection or null if not found
 */
export function getLlmConnection(slug: string, _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): LlmConnection | null {
  const connections = getLlmConnections();
  return connections.find(c => c.slug === slug) || null;
}

/**
 * Add a new LLM connection.
 * @param connection - Connection to add (slug must be unique)
 * @returns true if added, false if slug already exists
 */
export function addLlmConnection(connection: LlmConnection, _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): boolean {
  const config = loadStoredConfig();
  if (!config) return false;

  // Initialize array if not yet migrated (safe default for write operations)
  if (!config.llmConnections) {
    config.llmConnections = [];
  }

  // Check for duplicate slug
  if (config.llmConnections.some(c => c.slug === connection.slug)) {
    return false;
  }

  // Add connection with timestamp
  config.llmConnections.push({
    ...connection,
    createdAt: connection.createdAt || Date.now(),
  });

  // Ensure default is set after adding first connection
  ensureDefaultLlmConnection(config);

  saveConfig(config);
  return true;
}

/**
 * Update an existing LLM connection.
 * @param slug - Connection slug to update
 * @param updates - Partial updates to apply (slug is ignored)
 * @returns true if updated, false if not found
 */
export function updateLlmConnection(slug: string, updates: Partial<Omit<LlmConnection, 'slug'>>, _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): boolean {
  const config = loadStoredConfig();
  if (!config) return false;

  // No connections means nothing to update
  if (!config.llmConnections || config.llmConnections.length === 0) {
    return false;
  }

  const connections = config.llmConnections;
  const index = connections.findIndex(c => c.slug === slug);
  if (index === -1) return false;

  const existing = connections[index]!;
  const toModelIds = (models?: Array<{ id: string } | string>): string[] =>
    (models ?? []).map(m => typeof m === 'string' ? m : m.id);

  connections[index] = {
    // Preserve required fields from existing
    slug: existing.slug,
    name: updates.name ?? existing.name,
    providerType: updates.providerType ?? existing.providerType,
    type: updates.type ?? existing.type, // Legacy field
    authType: updates.authType ?? existing.authType,
    createdAt: updates.createdAt ?? existing.createdAt,
    // Optional fields from updates or existing
    baseUrl: updates.baseUrl !== undefined ? updates.baseUrl : existing.baseUrl,
    models: updates.models !== undefined ? updates.models : existing.models,
    defaultModel: updates.defaultModel !== undefined ? updates.defaultModel : existing.defaultModel,
    modelSelectionMode: updates.modelSelectionMode !== undefined ? updates.modelSelectionMode : existing.modelSelectionMode,
    // Pi auth provider
    piAuthProvider: updates.piAuthProvider !== undefined ? updates.piAuthProvider : existing.piAuthProvider,
    // Custom endpoint protocol (Anthropic/OpenAI compatible)
    customEndpoint: updates.customEndpoint !== undefined ? updates.customEndpoint : existing.customEndpoint,
    // Mid-stream send behavior (steer vs queue) — read via resolveMidStreamBehavior()
    midStreamBehavior: updates.midStreamBehavior !== undefined ? updates.midStreamBehavior : existing.midStreamBehavior,
    // Timestamps
    lastUsedAt: updates.lastUsedAt !== undefined ? updates.lastUsedAt : existing.lastUsedAt,
  };

  const updated = connections[index]!;
  if (updated.providerType === 'pi') {
    const beforeModelIds = toModelIds(existing.models);
    const afterModelIds = toModelIds(updated.models);
    const changed =
      existing.defaultModel !== updated.defaultModel ||
      existing.modelSelectionMode !== updated.modelSelectionMode ||
      !modelSetEquals(beforeModelIds, afterModelIds);

    if (changed) {
      const stack = (new Error().stack ?? '').split('\n').slice(2, 7).map(s => s.trim());
      debug('[storage] updateLlmConnection(pi) changed', {
        slug,
        before: {
          mode: existing.modelSelectionMode,
          defaultModel: existing.defaultModel,
          modelCount: beforeModelIds.length,
          modelsFirst5: beforeModelIds.slice(0, 5),
        },
        after: {
          mode: updated.modelSelectionMode,
          defaultModel: updated.defaultModel,
          modelCount: afterModelIds.length,
          modelsFirst5: afterModelIds.slice(0, 5),
        },
        updates: {
          keys: Object.keys(updates),
          defaultModel: updates.defaultModel,
          modelSelectionMode: updates.modelSelectionMode,
          modelsCount: Array.isArray(updates.models) ? updates.models.length : undefined,
        },
        stack,
      });
    }
  }

  saveConfig(config);
  return true;
}

/**
 * Delete an LLM connection.
 * @param slug - Connection slug to delete
 * @returns true if deleted, false if not found
 */
export function deleteLlmConnection(slug: string, _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): boolean {
  const config = loadStoredConfig();
  if (!config) return false;

  // No connections means nothing to delete
  if (!config.llmConnections || config.llmConnections.length === 0) {
    return false;
  }

  const connections = config.llmConnections;
  const index = connections.findIndex(c => c.slug === slug);
  if (index === -1) return false;

  connections.splice(index, 1);

  // If deleted connection was the default, reset to first remaining or clear
  if (config.defaultLlmConnection === slug) {
    config.defaultLlmConnection = connections.length > 0 ? connections[0]!.slug : undefined;
  }

  saveConfig(config);

  // Clean up workspace references to the deleted connection (non-blocking)
  try {
    const workspaces = getWorkspaces();
    for (const ws of workspaces) {
      const wsConfig = loadWorkspaceConfig(ws.rootPath);
      if (wsConfig?.defaults?.defaultLlmConnection === slug) {
        wsConfig.defaults.defaultLlmConnection = undefined;
        saveWorkspaceConfig(ws.rootPath, wsConfig);
      }
    }
  } catch (error) {
    console.error('Failed to clean up workspace references:', error);
  }

  // Clean up stored credentials for this connection (API keys, OAuth tokens)
  // This is fire-and-forget but we log errors for debugging
  const credentialManager = getCredentialManager();
  credentialManager.delete({ type: 'llm_api_key', connectionSlug: slug }).catch((error) => {
    console.error(`[storage] Failed to delete API key credential for connection '${slug}':`, error);
  });
  credentialManager.delete({ type: 'llm_oauth', connectionSlug: slug }).catch((error) => {
    console.error(`[storage] Failed to delete OAuth credential for connection '${slug}':`, error);
  });

  return true;
}

/**
 * Get the default LLM connection slug.
 * @returns Default connection slug, or null if no connections exist
 */
export function getDefaultLlmConnection(_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): string | null {
  const config = loadStoredConfig();
  if (!config) return null;

  // If no connections, return null
  if (!config.llmConnections || config.llmConnections.length === 0) {
    return null;
  }

  return config.defaultLlmConnection || config.llmConnections[0]?.slug || null;
}

/**
 * Set the default LLM connection.
 * @param slug - Connection slug to set as default
 * @returns true if set, false if connection not found
 */
export function setDefaultLlmConnection(slug: string, _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): boolean {
  const config = loadStoredConfig();
  if (!config) return false;

  // No connections means nothing to set as default
  if (!config.llmConnections || config.llmConnections.length === 0) {
    return false;
  }

  // Verify connection exists
  if (!config.llmConnections.some(c => c.slug === slug)) {
    return false;
  }

  config.defaultLlmConnection = slug;
  saveConfig(config);
  return true;
}

/**
 * Update the lastUsedAt timestamp for a connection.
 * @param slug - Connection slug
 */
export function touchLlmConnection(slug: string, _scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const config = loadStoredConfig();
  if (!config) return;

  // No connections means nothing to touch
  if (!config.llmConnections) return;

  const connection = config.llmConnections.find(c => c.slug === slug);
  if (connection) {
    connection.lastUsedAt = Date.now();
    saveConfig(config);
  }
}
