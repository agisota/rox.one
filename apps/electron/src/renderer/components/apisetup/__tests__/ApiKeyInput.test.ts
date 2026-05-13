import { describe, expect, it } from 'bun:test'
import {
  resolveEndpointSubmitMetadata,
  resolvePiAuthProviderForSubmit,
  resolvePresetStateForBaseUrlChange,
  ZED_MD_MODELS,
} from '../submit-helpers'
import { pickTierDefaults, resolveTierModels } from '../tier-models'

const MODELS = [
  { id: 'pi/zai-best', name: 'Best', costInput: 10, costOutput: 20, contextWindow: 200000, reasoning: true },
  { id: 'pi/zai-balanced', name: 'Balanced', costInput: 5, costOutput: 10, contextWindow: 200000, reasoning: true },
  { id: 'pi/zai-fast', name: 'Fast', costInput: 1, costOutput: 2, contextWindow: 128000, reasoning: false },
]

describe('ApiKeyInput tier hydration helpers', () => {
  it('resolveTierModels keeps saved tier selections when all are valid', () => {
    const saved = ['pi/zai-fast', 'pi/zai-balanced', 'pi/zai-best']
    const resolved = resolveTierModels(MODELS, saved)

    expect(resolved).toEqual({
      best: 'pi/zai-fast',
      default_: 'pi/zai-balanced',
      cheap: 'pi/zai-best',
    })
  })

  it('resolveTierModels preserves duplicate tiers when saved models are valid', () => {
    const saved = ['pi/zai-best', 'pi/zai-best', 'pi/zai-fast']
    const resolved = resolveTierModels(MODELS, saved)

    expect(resolved).toEqual({
      best: 'pi/zai-best',
      default_: 'pi/zai-best',
      cheap: 'pi/zai-fast',
    })
  })

  it('resolveTierModels falls back per-slot for invalid/missing saved values', () => {
    const resolved = resolveTierModels(MODELS, ['pi/zai-best', 'pi/not-real'])
    const defaults = pickTierDefaults(MODELS)

    expect(resolved).toEqual({
      best: 'pi/zai-best',
      default_: defaults.default_,
      cheap: defaults.cheap,
    })
  })
})

describe('resolvePiAuthProviderForSubmit', () => {
  it('preserves the last non-custom provider when custom endpoint mode is selected', () => {
    expect(resolvePiAuthProviderForSubmit('custom', 'openai')).toBe('openai')
  })

  it('defaults custom endpoint mode to anthropic routing when none was selected yet', () => {
    expect(resolvePiAuthProviderForSubmit('custom', null)).toBe('anthropic')
  })

  it('passes through non-custom presets unchanged', () => {
    expect(resolvePiAuthProviderForSubmit('google', 'anthropic')).toBe('google')
  })
})

describe('resolveEndpointSubmitMetadata', () => {
  it('keeps the ZED.MD preset model list exactly aligned with the ROX operator contract', () => {
    expect(ZED_MD_MODELS).toBe('cx/gpt-5.5,cx/gpt-5.5-xhigh,cx/gpt-5.5-medium,glm/glm-5.1,glm/glm-5-turbo,kmc/kimi-latest,kimi,deepseek,dugin400,cheap,fast200,cx/gpt-5.3-codex-spark,cx/gpt-5.3-codex-spark-xhigh,xai/grok-4.3,xai/grok-4.3-reasoning')
  })

  it('routes the ZED.MD preset as an OpenAI-compatible custom endpoint', () => {
    expect(resolveEndpointSubmitMetadata({
      activePreset: 'zed-md',
      effectiveBaseUrl: 'https://api.zed.md/v1',
      customApi: 'anthropic-messages',
      presetCustomApi: 'openai-completions',
      effectivePiAuthProvider: undefined,
    })).toEqual({
      customEndpoint: { api: 'openai-completions' },
      piAuthProvider: 'openai',
    })
  })

  it('preserves Pi provider routing for non-custom preset submissions', () => {
    expect(resolveEndpointSubmitMetadata({
      activePreset: 'openrouter',
      effectiveBaseUrl: 'https://openrouter.ai/api/v1',
      customApi: 'openai-completions',
      effectivePiAuthProvider: 'openrouter',
    })).toEqual({
      customEndpoint: undefined,
      piAuthProvider: 'openrouter',
    })
  })

  it('uses the selected protocol for arbitrary custom endpoint submissions', () => {
    expect(resolveEndpointSubmitMetadata({
      activePreset: 'custom',
      effectiveBaseUrl: 'https://my-anthropic-proxy.internal/v1',
      customApi: 'anthropic-messages',
      effectivePiAuthProvider: undefined,
    })).toEqual({
      customEndpoint: { api: 'anthropic-messages' },
      piAuthProvider: 'anthropic',
    })
  })
})

describe('resolvePresetStateForBaseUrlChange', () => {
  it('updates the remembered provider when the typed URL matches a known preset', () => {
    expect(resolvePresetStateForBaseUrlChange({
      matchedPreset: 'openrouter',
      activePreset: 'custom',
      activePresetHasEmptyUrl: true,
      lastNonCustomPreset: 'anthropic',
    })).toEqual({
      activePreset: 'openrouter',
      lastNonCustomPreset: 'openrouter',
    })
  })

  it('preserves provider routing when editing a provider with an empty default URL', () => {
    expect(resolvePresetStateForBaseUrlChange({
      matchedPreset: 'custom',
      activePreset: 'azure-openai-responses',
      activePresetHasEmptyUrl: true,
      lastNonCustomPreset: 'azure-openai-responses',
    })).toEqual({
      activePreset: 'azure-openai-responses',
      lastNonCustomPreset: 'azure-openai-responses',
    })
  })

  it('falls back to custom while keeping the most recent matched provider', () => {
    expect(resolvePresetStateForBaseUrlChange({
      matchedPreset: 'custom',
      activePreset: 'openrouter',
      activePresetHasEmptyUrl: false,
      lastNonCustomPreset: 'openrouter',
    })).toEqual({
      activePreset: 'custom',
      lastNonCustomPreset: 'openrouter',
    })
  })
})
