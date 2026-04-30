/**
 * Centralized branding assets and white-label configuration.
 * Keep this module dependency-light: it is used by shared code, Electron, and HTML templates.
 */

export interface BrandConfig {
  appName: string
  productName: string
  tagline: string
  supportEmail: string
  docsUrl: string
  legalName: string
  defaultThemeId: string
  logoAssetPath: string
  iconAssetPath: string
}

export type BrandConfigInput = Partial<BrandConfig>

export interface BrandValidationResult {
  ok: boolean
  errors: string[]
}

export const FALLBACK_BRAND_CONFIG: BrandConfig = {
  appName: 'ROX',
  productName: 'ROX ONE',
  tagline: 'Agent workspace for local and remote sessions',
  supportEmail: 'support@rox.one',
  docsUrl: 'https://rox.one/docs',
  legalName: 'ROX ONE',
  defaultThemeId: 'default',
  logoAssetPath: 'assets/pzdrk.png',
  iconAssetPath: 'assets/pzdrk.png',
}

export const AGENT_WORKBENCH_BRAND_CONFIG: BrandConfig = {
  appName: 'Agent Workbench',
  productName: 'Agent Workbench Suite',
  tagline: 'A local and cloud workbench for agentic workflows',
  supportEmail: 'support@rox.one',
  docsUrl: 'https://rox.one/docs',
  legalName: 'ROX ONE',
  defaultThemeId: 'default',
  logoAssetPath: 'assets/pzdrk.png',
  iconAssetPath: 'assets/pzdrk.png',
}

const STRING_FIELDS: Array<keyof BrandConfig> = [
  'appName',
  'productName',
  'tagline',
  'supportEmail',
  'docsUrl',
  'legalName',
  'defaultThemeId',
  'logoAssetPath',
  'iconAssetPath',
]

const ASSET_PATH_FIELDS: Array<keyof Pick<BrandConfig, 'logoAssetPath' | 'iconAssetPath'>> = [
  'logoAssetPath',
  'iconAssetPath',
]

function isSafeAssetPath(value: string): boolean {
  if (!value.trim()) return false
  if (value.startsWith('/')) return false
  if (value.includes('..')) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false
  return true
}

export function validateBrandConfig(input: BrandConfigInput): BrandValidationResult {
  const errors: string[] = []

  for (const field of STRING_FIELDS) {
    const value = input[field]
    if (value !== undefined && value.trim().length === 0) {
      errors.push(`${field} must not be empty`)
    }
  }

  for (const field of ASSET_PATH_FIELDS) {
    const value = input[field]
    if (value !== undefined && !isSafeAssetPath(value)) {
      errors.push(`${field} must be a safe relative asset path`)
    }
  }

  if (input.docsUrl !== undefined) {
    try {
      const url = new URL(input.docsUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('docsUrl must use http or https')
      }
    } catch {
      errors.push('docsUrl must be a valid URL')
    }
  }

  return { ok: errors.length === 0, errors }
}

export function resolveBrandConfig(input?: BrandConfigInput, fallback: BrandConfig = FALLBACK_BRAND_CONFIG): BrandConfig {
  if (!input) return fallback

  const validation = validateBrandConfig(input)
  if (!validation.ok) {
    throw new Error(`Invalid brand config: ${validation.errors.join('; ')}`)
  }

  return {
    ...fallback,
    ...input,
  }
}

export function getBrandDocsUrl(path?: string, brand: BrandConfigInput = AGENT_WORKBENCH_BRAND_CONFIG): string {
  const resolvedBrand = resolveBrandConfig(brand, AGENT_WORKBENCH_BRAND_CONFIG)
  const base = resolvedBrand.docsUrl.replace(/\/+$/, '')
  const suffix = path?.replace(/^\/+/, '')
  return suffix ? `${base}/${suffix}` : base
}

export const ROX_LOGO = [
  '  ██████   ██████   ██  ██       ██████   ███ ██  ██████',
  '  ██   ██  ██  ██    ████        ██  ██   █████  ██     ',
  '  ██████   ██  ██     ██        ██   ██   ██ ██  ██████ ',
  '  ██  ██   ██  ██   ████        ██   ██   ██ ███  ██    ',
  '  ██   ██  ██████  ██  ██  █     ██████   ██  ██  ██████',
] as const

/** Logo as a single string for HTML templates */
export const ROX_LOGO_HTML = ROX_LOGO.map((line) => line.trimEnd()).join('\n')

/** Session viewer base URL */
export const VIEWER_URL = 'https://app.rox.one'
