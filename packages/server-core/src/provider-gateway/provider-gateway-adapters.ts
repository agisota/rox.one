import { sanitizePublicPayload } from '../security/public-payload-sanitizer'
import type { ArtifactType } from '@craft-agent/shared/workbench'
import type {
  FakeProviderGatewayOptions,
  ProviderAdapter,
  ProviderCapability,
} from './provider-gateway'

export function createDeterministicFakeProviderAdapter(options: FakeProviderGatewayOptions): ProviderAdapter {
  return {
    kind: 'fake',
    async execute(input) {
      const createdAt = options.now?.() ?? new Date().toISOString()
      const visibility = input.visibility ?? 'private'
      const evidenceRef = `provider:fake:${input.capability}:${input.operation}`
      const artifactType = defaultArtifactTypeForCapability(input.capability)
      const missionKey = input.missionRunId ?? input.workspaceId ?? 'standalone'
      const safeInput = visibility === 'public_share'
        ? sanitizeProviderPublicPayload(input.input)
        : input.input

      return {
        artifacts: [{
          artifactId: `artifact:${missionKey}:${input.capability}:${input.operation}`,
          artifactType,
          title: `Fake ${input.capability} ${input.operation}`,
          content: `Deterministic fake ${input.capability} artifact for ${input.operation}.`,
          mimeType: 'text/markdown',
          visibility,
          evidenceRefs: [evidenceRef],
          providerCapability: input.capability,
          createdAt,
          metadata: {
            capability: input.capability,
            operation: input.operation,
            input: safeInput,
          },
        }],
        evidenceRefs: [evidenceRef],
      }
    },
  }
}

function defaultArtifactTypeForCapability(capability: ProviderCapability): ArtifactType {
  switch (capability) {
    case 'llm':
      return 'prompt'
    case 'research':
      return 'report'
    case 'object_storage':
      return 'file'
    case 'email':
      return 'report'
    case 'billing':
      return 'report'
    case 'shortlink':
      return 'file'
    case 'scheduler':
      return 'tasks'
    case 'agent_registry':
      return 'spec'
  }
}

function sanitizeProviderPublicPayload<T>(value: T): T {
  return sanitizePublicPayload(value, { dropSensitiveKeys: true })
}
