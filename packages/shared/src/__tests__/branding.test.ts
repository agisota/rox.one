import { describe, expect, it } from 'bun:test'
import {
  AGENT_WORKBENCH_BRAND_CONFIG,
  FALLBACK_BRAND_CONFIG,
  getBrandDocsUrl,
  resolveBrandConfig,
  validateBrandConfig,
} from '../branding'

describe('brand config', () => {
  it('defines the Agent Workbench Suite default brand', () => {
    expect(AGENT_WORKBENCH_BRAND_CONFIG).toMatchObject({
      appName: 'Agent Workbench',
      productName: 'Agent Workbench Suite',
      supportEmail: 'support@rox.one',
      docsUrl: 'https://rox.one/docs',
      legalName: 'ROX.ONE',
      defaultThemeId: 'default',
    })
  })

  it('falls back to original ROX naming when no brand config is provided', () => {
    expect(resolveBrandConfig(undefined)).toEqual(FALLBACK_BRAND_CONFIG)
  })

  it('merges partial brand config with original fallback fields', () => {
    expect(resolveBrandConfig({ productName: 'Acme Agents' })).toMatchObject({
      ...FALLBACK_BRAND_CONFIG,
      productName: 'Acme Agents',
    })
  })

  it('rejects invalid brand config values', () => {
    expect(validateBrandConfig({ appName: '' }).ok).toBe(false)
    expect(validateBrandConfig({ logoAssetPath: '../secret.png' }).ok).toBe(false)
    expect(validateBrandConfig({ iconAssetPath: 'assets/icon.png' }).ok).toBe(true)
  })

  it('builds documentation URLs from the configured docs root', () => {
    expect(getBrandDocsUrl('skills', { docsUrl: 'https://docs.example.test/base/' })).toBe('https://docs.example.test/base/skills')
  })
})
