import { ArtifactTypeSchema, type ArtifactType } from '@rox-agent/shared/workbench'
import { sanitizePublicPayload } from '../security/public-payload-sanitizer'
import { createDeterministicFakeProviderAdapter } from './provider-gateway-adapters'

export const PROVIDER_CAPABILITIES = [
  'llm',
  'research',
  'object_storage',
  'email',
  'billing',
  'shortlink',
  'scheduler',
  'agent_registry',
] as const

export type ProviderCapability = typeof PROVIDER_CAPABILITIES[number]
export type ProviderArtifactVisibility = 'private' | 'public_share'
export type ProviderUserVisibleState =
  | 'completed'
  | 'auth_required'
  | 'retryable_failure'
  | 'permanent_failure'
  | 'timed_out'
  | 'invalid_output'
  | 'blocked'

export type ProviderGatewayErrorCode =
  | 'auth_required'
  | 'timeout'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'invalid_output'
  | 'secret_leak'
  | 'real_provider_disabled'
  | 'unknown'

export interface ProviderGatewayErrorInput {
  code: ProviderGatewayErrorCode
  message: string
  retryable: boolean
  status?: number
  cause?: unknown
}

export class ProviderGatewayError extends Error {
  readonly code: ProviderGatewayErrorCode
  readonly retryable: boolean
  readonly status?: number
  readonly cause?: unknown

  constructor(input: ProviderGatewayErrorInput) {
    super(input.message)
    this.name = 'ProviderGatewayError'
    this.code = input.code
    this.retryable = input.retryable
    this.status = input.status
    this.cause = input.cause
  }
}

export interface ProviderGatewayRequest {
  capability: ProviderCapability
  operation: string
  missionRunId?: string
  workspaceId?: string
  visibility?: ProviderArtifactVisibility
  input: Record<string, unknown>
  timeoutMs?: number
  retryAttempt?: number
}

export interface ProviderArtifact {
  artifactId: string
  artifactType: ArtifactType
  title: string
  content: string
  mimeType: string
  visibility: ProviderArtifactVisibility
  evidenceRefs: string[]
  providerCapability: ProviderCapability
  createdAt: string
  metadata: Record<string, unknown>
}

export interface ProviderAdapterResult {
  artifacts: ProviderArtifact[]
  evidenceRefs: string[]
}

export interface ProviderAdapter {
  kind: 'fake' | 'real'
  execute(input: ProviderGatewayRequest): Promise<ProviderAdapterResult>
}

export interface ProviderGatewaySuccess {
  success: true
  state: 'completed'
  artifacts: ProviderArtifact[]
  evidenceRefs: string[]
  retryable: false
}

export interface ProviderGatewayFailure {
  success: false
  state: Exclude<ProviderUserVisibleState, 'completed'>
  error: ProviderGatewayError
  artifacts: []
  evidenceRefs: []
  retryable: boolean
}

export type ProviderGatewayResult = ProviderGatewaySuccess | ProviderGatewayFailure

export interface ProviderGateway {
  execute(input: ProviderGatewayRequest): Promise<ProviderGatewayResult>
}

export interface ProviderGatewayOptions {
  adapters: Partial<Record<ProviderCapability, ProviderAdapter>>
  allowRealProviders?: boolean
  now?: () => string
}

export interface FakeProviderGatewayOptions {
  now?: () => string
}

export function mapProviderErrorToUserState(input: {
  code: ProviderGatewayErrorCode
  retryable: boolean
}): Exclude<ProviderUserVisibleState, 'completed'> {
  switch (input.code) {
    case 'auth_required':
      return 'auth_required'
    case 'timeout':
      return 'timed_out'
    case 'rate_limited':
    case 'provider_unavailable':
      return input.retryable ? 'retryable_failure' : 'permanent_failure'
    case 'invalid_output':
      return 'invalid_output'
    case 'secret_leak':
    case 'real_provider_disabled':
      return 'blocked'
    case 'unknown':
      return input.retryable ? 'retryable_failure' : 'permanent_failure'
  }
}

export function createProviderGateway(options: ProviderGatewayOptions): ProviderGateway {
  return new DefaultProviderGateway(options)
}

export function createFakeProviderGateway(options: FakeProviderGatewayOptions = {}): ProviderGateway {
  const adapters = Object.fromEntries(
    PROVIDER_CAPABILITIES.map(capability => [capability, createDeterministicFakeProviderAdapter(options)]),
  ) as Record<ProviderCapability, ProviderAdapter>

  return createProviderGateway({
    adapters,
    now: options.now,
  })
}

class DefaultProviderGateway implements ProviderGateway {
  private readonly adapters: Partial<Record<ProviderCapability, ProviderAdapter>>
  private readonly allowRealProviders: boolean
  private readonly now: () => string

  constructor(options: ProviderGatewayOptions) {
    this.adapters = options.adapters
    this.allowRealProviders = options.allowRealProviders ?? false
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async execute(input: ProviderGatewayRequest): Promise<ProviderGatewayResult> {
    const adapter = this.adapters[input.capability]
    if (!adapter) {
      return providerFailure(new ProviderGatewayError({
        code: 'provider_unavailable',
        message: `Provider adapter is not configured for ${input.capability}.`,
        retryable: true,
      }))
    }

    if (adapter.kind === 'real' && !this.allowRealProviders) {
      return providerFailure(new ProviderGatewayError({
        code: 'real_provider_disabled',
        message: `Real provider adapter ${input.capability} is disabled for deterministic runs.`,
        retryable: false,
      }))
    }

    try {
      const result = await adapter.execute({
        ...input,
        visibility: input.visibility ?? 'private',
      })
      const artifacts = normalizeArtifacts(result.artifacts, {
        capability: input.capability,
        visibility: input.visibility ?? 'private',
        now: this.now,
      })
      const evidenceRefs = uniqueStrings([
        ...result.evidenceRefs,
        ...artifacts.flatMap(artifact => artifact.evidenceRefs),
      ])

      return {
        success: true,
        state: 'completed',
        artifacts,
        evidenceRefs,
        retryable: false,
      }
    } catch (error) {
      return providerFailure(toProviderGatewayError(error))
    }
  }
}

function normalizeArtifacts(
  artifacts: ProviderArtifact[],
  context: { capability: ProviderCapability; visibility: ProviderArtifactVisibility; now: () => string },
): ProviderArtifact[] {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new ProviderGatewayError({
      code: 'invalid_output',
      message: 'Provider returned no artifacts.',
      retryable: false,
    })
  }

  return artifacts.map(artifact => validateAndNormalizeArtifact(artifact, context))
}

function validateAndNormalizeArtifact(
  artifact: ProviderArtifact,
  context: { capability: ProviderCapability; visibility: ProviderArtifactVisibility; now: () => string },
): ProviderArtifact {
  if (!artifact || typeof artifact !== 'object') {
    throw invalidArtifact('Provider artifact must be an object.')
  }
  if (!artifact.artifactId?.trim()) throw invalidArtifact('Provider artifact requires an artifactId.')
  if (!artifact.title?.trim()) throw invalidArtifact('Provider artifact requires a title.')
  if (!artifact.content?.trim()) throw invalidArtifact('Provider artifact requires non-empty content.')
  if (!artifact.mimeType?.trim()) throw invalidArtifact('Provider artifact requires a mimeType.')
  if (!Array.isArray(artifact.evidenceRefs) || artifact.evidenceRefs.length === 0) {
    throw invalidArtifact('Provider artifact requires evidence references.')
  }
  if (!ArtifactTypeSchema.safeParse(artifact.artifactType).success) {
    throw invalidArtifact('Provider artifact type is invalid.')
  }
  if (!PROVIDER_CAPABILITIES.includes(artifact.providerCapability)) {
    throw invalidArtifact('Provider artifact capability is invalid.')
  }

  const visibility = artifact.visibility ?? context.visibility
  const metadata = visibility === 'public_share'
    ? sanitizeProviderPublicPayload(artifact.metadata)
    : { ...(artifact.metadata ?? {}) }
  const content = visibility === 'public_share'
    ? sanitizeProviderPublicPayload(artifact.content)
    : artifact.content

  return {
    ...artifact,
    content,
    visibility,
    providerCapability: artifact.providerCapability ?? context.capability,
    createdAt: artifact.createdAt || context.now(),
    evidenceRefs: uniqueStrings(artifact.evidenceRefs),
    metadata,
  }
}

function invalidArtifact(message: string): ProviderGatewayError {
  return new ProviderGatewayError({
    code: 'invalid_output',
    message,
    retryable: false,
  })
}

function providerFailure(error: ProviderGatewayError): ProviderGatewayFailure {
  return {
    success: false,
    state: mapProviderErrorToUserState(error),
    error,
    artifacts: [],
    evidenceRefs: [],
    retryable: error.retryable,
  }
}

function toProviderGatewayError(error: unknown): ProviderGatewayError {
  if (error instanceof ProviderGatewayError) return error

  if (error instanceof Error) {
    const isTimeout = error.name === 'TimeoutError' || /timeout|timed out/i.test(error.message)
    return new ProviderGatewayError({
      code: isTimeout ? 'timeout' : 'unknown',
      message: error.message || 'Provider failed.',
      retryable: isTimeout,
      cause: error,
    })
  }

  return new ProviderGatewayError({
    code: 'unknown',
    message: 'Provider failed.',
    retryable: false,
    cause: error,
  })
}

export function sanitizeProviderPublicPayload<T>(value: T): T {
  return sanitizePublicPayload(value, { dropSensitiveKeys: true })
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim().length > 0))]
}
