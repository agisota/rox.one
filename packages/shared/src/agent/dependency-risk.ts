export type ProviderDependencyRiskMode =
  | 'private-local'
  | 'public-untrusted'
  | 'accepted-risk'
  | 'isolated-worker'

export const PI_PROVIDER_DEPENDENCY_RISK_ENV = 'ROX_PI_PROVIDER_DEPENDENCY_RISK_MODE'
export const PROVIDER_DEPENDENCY_RISK_ENV = 'ROX_PROVIDER_DEPENDENCY_RISK_MODE'
export const PUBLIC_APP_URL_ENV = 'ROX_PUBLIC_APP_URL'

const VALID_PROVIDER_DEPENDENCY_RISK_MODES: ReadonlySet<string> = new Set([
  'private-local',
  'public-untrusted',
  'accepted-risk',
  'isolated-worker',
])

export function parseProviderDependencyRiskMode(
  value: string | undefined,
  source: string,
): ProviderDependencyRiskMode | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined
  if (VALID_PROVIDER_DEPENDENCY_RISK_MODES.has(normalized)) {
    return normalized as ProviderDependencyRiskMode
  }
  throw new Error(
    `Invalid ${source}: expected private-local, public-untrusted, accepted-risk, or isolated-worker.`,
  )
}

export function resolvePiProviderDependencyRiskMode(
  env: Record<string, string | undefined> = process.env,
  overrides: Record<string, string | undefined> = {},
): ProviderDependencyRiskMode {
  const piSpecific = parseProviderDependencyRiskMode(
    overrides[PI_PROVIDER_DEPENDENCY_RISK_ENV] ?? env[PI_PROVIDER_DEPENDENCY_RISK_ENV],
    PI_PROVIDER_DEPENDENCY_RISK_ENV,
  )
  if (piSpecific) return piSpecific

  const generic = parseProviderDependencyRiskMode(
    overrides[PROVIDER_DEPENDENCY_RISK_ENV] ?? env[PROVIDER_DEPENDENCY_RISK_ENV],
    PROVIDER_DEPENDENCY_RISK_ENV,
  )
  if (generic) return generic

  const publicAppUrl = overrides[PUBLIC_APP_URL_ENV] ?? env[PUBLIC_APP_URL_ENV]
  return publicAppUrl?.trim() ? 'public-untrusted' : 'private-local'
}

export function assertPiProviderDependencyRiskAllowed(mode: ProviderDependencyRiskMode): void {
  if (mode !== 'public-untrusted') return
  throw new Error(
    'PI provider runtime is disabled for public untrusted exposure until dependency risks are remediated, isolated, or explicitly accepted.',
  )
}
