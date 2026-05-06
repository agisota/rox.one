import { describe, expect, it } from 'bun:test'
import {
  compileMissionModePrompt,
  getMissionModePromptContract,
} from '@rox-agent/shared/workbench'

import {
  createFakeProviderGateway,
  createProviderGateway,
  mapProviderErrorToUserState,
  ProviderGatewayError,
  type ProviderAdapter,
  type ProviderArtifact,
} from '../provider-gateway'

const NOW = '2026-05-06T00:00:00.000Z'

describe('ProviderGateway', () => {
  it('returns deterministic artifacts from the fake provider gateway', async () => {
    const gateway = createFakeProviderGateway({ now: () => NOW })

    const result = await gateway.execute({
      capability: 'llm',
      operation: 'rewrite_prompt',
      missionRunId: 'mission-1',
      workspaceId: 'workspace-1',
      visibility: 'private',
      input: { prompt: 'raw prompt' },
    })

    expect(result).toMatchObject({
      success: true,
      state: 'completed',
      retryable: false,
      evidenceRefs: ['provider:fake:llm:rewrite_prompt'],
    })
    expect(result.artifacts).toEqual([
      expect.objectContaining({
        artifactId: 'artifact:mission-1:llm:rewrite_prompt',
        artifactType: 'prompt',
        title: 'Fake llm rewrite_prompt',
        providerCapability: 'llm',
        visibility: 'private',
        createdAt: NOW,
        evidenceRefs: ['provider:fake:llm:rewrite_prompt'],
      }),
    ])
  })

  it('maps provider errors to user-visible states', async () => {
    const gateway = createProviderGateway({
      adapters: {
        llm: failingAdapter(new ProviderGatewayError({
          code: 'auth_required',
          message: 'Sign in to continue.',
          retryable: false,
        })),
      },
      now: () => NOW,
    })

    const result = await gateway.execute({
      capability: 'llm',
      operation: 'rewrite_prompt',
      input: { prompt: 'raw prompt' },
    })

    expect(mapProviderErrorToUserState({ code: 'auth_required', retryable: false })).toBe('auth_required')
    expect(result).toEqual({
      success: false,
      state: 'auth_required',
      error: expect.objectContaining({ code: 'auth_required', message: 'Sign in to continue.' }),
      artifacts: [],
      evidenceRefs: [],
      retryable: false,
    })
  })

  it('handles provider timeouts without mutating mission state input', async () => {
    const missionState = { status: 'running', checkpointIds: ['cp-6h'] }
    const gateway = createProviderGateway({
      adapters: {
        research: failingAdapter(new ProviderGatewayError({
          code: 'timeout',
          message: 'Provider timed out.',
          retryable: true,
        })),
      },
      now: () => NOW,
    })

    const result = await gateway.execute({
      capability: 'research',
      operation: 'checkpoint_research',
      missionRunId: 'mission-timeout',
      input: { missionState },
      timeoutMs: 50,
    })

    expect(result).toMatchObject({
      success: false,
      state: 'timed_out',
      retryable: true,
      artifacts: [],
      evidenceRefs: [],
    })
    expect(missionState).toEqual({ status: 'running', checkpointIds: ['cp-6h'] })
  })

  it('rejects invalid provider artifacts before they become evidence', async () => {
    const gateway = createProviderGateway({
      adapters: {
        llm: artifactAdapter({
          artifactId: 'artifact-invalid',
          artifactType: 'not-a-real-artifact-type' as ProviderArtifact['artifactType'],
          title: 'Invalid artifact',
          content: '',
          mimeType: 'text/markdown',
          visibility: 'private',
          evidenceRefs: ['provider:fake:llm:bad_output'],
          providerCapability: 'llm',
          createdAt: NOW,
          metadata: {},
        }),
      },
      now: () => NOW,
    })

    const result = await gateway.execute({
      capability: 'llm',
      operation: 'bad_output',
      input: { prompt: 'raw prompt' },
    })

    expect(result).toMatchObject({
      success: false,
      state: 'invalid_output',
      artifacts: [],
      evidenceRefs: [],
      retryable: false,
    })
  })

  it('redacts secret fields from public share artifacts', async () => {
    const gateway = createFakeProviderGateway({ now: () => NOW })

    const result = await gateway.execute({
      capability: 'shortlink',
      operation: 'share_session',
      missionRunId: 'mission-public',
      visibility: 'public_share',
      input: {
        title: 'public share',
        authorization: 'Bearer secret-token',
        nested: {
          rox_session: 'session-secret',
          apiKey: 'api-key-secret',
          safe: 'visible',
        },
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected fake provider success')

    const payload = JSON.stringify(result.artifacts)
    expect(payload).toContain('visible')
    expect(payload).not.toContain('secret-token')
    expect(payload).not.toContain('session-secret')
    expect(payload).not.toContain('api-key-secret')
    expect(payload).not.toContain('authorization')
    expect(payload).not.toContain('rox_session')
    expect(payload).not.toContain('apiKey')
  })

  it('does not invoke real adapter seams unless explicitly enabled', async () => {
    const calls: string[] = []
    const gateway = createProviderGateway({
      adapters: {
        email: {
          kind: 'real',
          async execute() {
            calls.push('real-email-called')
            return {
              artifacts: [],
              evidenceRefs: [],
            }
          },
        },
      },
      now: () => NOW,
    })

    const result = await gateway.execute({
      capability: 'email',
      operation: 'send_checkpoint_update',
      input: { to: 'user@example.com' },
    })

    expect(result).toMatchObject({
      success: false,
      state: 'blocked',
      retryable: false,
      artifacts: [],
      evidenceRefs: [],
      error: expect.objectContaining({ code: 'real_provider_disabled' }),
    })
    expect(calls).toEqual([])
  })

  it('executes compiled mission mode prompts through the deterministic fake provider', async () => {
    const gateway = createFakeProviderGateway({ now: () => NOW })
    const contract = getMissionModePromptContract('swarm_arena')
    const prompt = compileMissionModePrompt(contract, {
      missionRunId: 'mission-swarm',
      title: 'Arena branch',
      objective: 'Coordinate trusted agents with evidence.',
      rawInput: 'Select agents and produce a branch plan.',
    })

    const result = await gateway.execute({
      capability: contract.providerCapabilities[0],
      operation: `mission_mode:${contract.mode}`,
      missionRunId: 'mission-swarm',
      input: {
        prompt,
        requiredArtifacts: contract.requiredArtifacts,
        validationGates: contract.validationGates,
      },
    })

    expect(result).toMatchObject({
      success: true,
      state: 'completed',
      evidenceRefs: ['provider:fake:llm:mission_mode:swarm_arena'],
    })
    expect(result.artifacts[0]).toMatchObject({
      artifactId: 'artifact:mission-swarm:llm:mission_mode:swarm_arena',
      artifactType: 'prompt',
      providerCapability: 'llm',
    })
  })
})

function failingAdapter(error: ProviderGatewayError): ProviderAdapter {
  return {
    kind: 'fake',
    async execute() {
      throw error
    },
  }
}

function artifactAdapter(artifact: ProviderArtifact): ProviderAdapter {
  return {
    kind: 'fake',
    async execute() {
      return {
        artifacts: [artifact],
        evidenceRefs: artifact.evidenceRefs,
      }
    },
  }
}
