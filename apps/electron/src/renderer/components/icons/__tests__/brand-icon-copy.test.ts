import { describe, expect, it } from 'bun:test'
import { AGENT_WORKBENCH_BRAND_CONFIG } from '@rox-agent/shared/branding'
import {
  getBrandIconAltText,
  getBrandLogoText,
  getBrandSymbolAriaLabel,
} from '../brand-icon-copy'

describe('brand icon copy helpers', () => {
  it('uses the configured product name in logo text', () => {
    expect(getBrandLogoText(AGENT_WORKBENCH_BRAND_CONFIG)).toBe('Agent Workbench Suite')
  })

  it('uses the configured product name for symbol accessibility', () => {
    expect(getBrandSymbolAriaLabel(AGENT_WORKBENCH_BRAND_CONFIG)).toBe('Agent Workbench Suite')
  })

  it('uses the configured product name for app icon alt text', () => {
    expect(getBrandIconAltText(AGENT_WORKBENCH_BRAND_CONFIG)).toBe('Agent Workbench Suite')
  })
})
