export type PresetKey = string

import type { CustomEndpointApi, CustomEndpointConfig } from '@config/llm-connections'

export const ZED_MD_MODELS = [
  'cx/gpt-5.5',
  'cx/gpt-5.5-xhigh',
  'cx/gpt-5.5-medium',
  'glm/glm-5.1',
  'glm/glm-5-turbo',
  'kmc/kimi-latest',
  'kimi',
  'deepseek',
  'dugin400',
  'cheap',
  'fast200',
  'cx/gpt-5.3-codex-spark',
  'cx/gpt-5.3-codex-spark-xhigh',
  'xai/grok-4.3',
  'xai/grok-4.3-reasoning',
].join(',')

/**
 * Preset keys that are regional variants of a canonical Pi auth provider.
 * The Pi SDK recognizes both 'minimax' and 'minimax-cn' as separate providers
 * with distinct base URLs (api.minimax.io vs api.minimaxi.com), so only
 * 'minimax-global' needs aliasing — 'minimax-cn' maps 1:1 to the Pi SDK provider.
 */
const PI_AUTH_PROVIDER_ALIASES: Record<string, string> = {
  'minimax-global': 'minimax',
}

export function resolvePiAuthProviderForSubmit(
  activePreset: PresetKey,
  lastNonCustomPreset: PresetKey | null
): string | undefined {
  if (activePreset === 'custom') {
    // Pi SDK needs a provider hint for auth header formatting even when
    // the URL is user-provided — default to anthropic as the safest baseline.
    const resolved = lastNonCustomPreset && lastNonCustomPreset !== 'custom'
      ? lastNonCustomPreset
      : 'anthropic'
    return PI_AUTH_PROVIDER_ALIASES[resolved] ?? resolved
  }

  return PI_AUTH_PROVIDER_ALIASES[activePreset] ?? activePreset
}

export function resolvePresetStateForBaseUrlChange(params: {
  matchedPreset: PresetKey
  activePreset: PresetKey
  activePresetHasEmptyUrl: boolean
  lastNonCustomPreset: PresetKey | null
}): { activePreset: PresetKey; lastNonCustomPreset: PresetKey | null } {
  const { matchedPreset, activePreset, activePresetHasEmptyUrl, lastNonCustomPreset } = params

  if (matchedPreset !== 'custom') {
    return {
      activePreset: matchedPreset,
      lastNonCustomPreset: matchedPreset,
    }
  }

  if (activePresetHasEmptyUrl) {
    return {
      activePreset,
      lastNonCustomPreset,
    }
  }

  return {
    activePreset: 'custom',
    lastNonCustomPreset,
  }
}

export function resolveEndpointSubmitMetadata(params: {
  activePreset: PresetKey
  effectiveBaseUrl: string
  customApi: CustomEndpointApi
  presetCustomApi?: CustomEndpointApi
  effectivePiAuthProvider?: string
}): {
  customEndpoint?: CustomEndpointConfig
  piAuthProvider?: string
} {
  const endpointApi = params.presetCustomApi
    ?? (params.activePreset === 'custom' ? params.customApi : undefined)

  if (!endpointApi || !params.effectiveBaseUrl.trim()) {
    return {
      customEndpoint: undefined,
      piAuthProvider: params.effectivePiAuthProvider,
    }
  }

  return {
    customEndpoint: { api: endpointApi },
    piAuthProvider: endpointApi === 'anthropic-messages' ? 'anthropic' : 'openai',
  }
}
