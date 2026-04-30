import { describe, expect, it } from 'bun:test'
import { AGENT_WORKBENCH_BRAND_CONFIG } from '@rox-agent/shared/branding'
import { getAccountBrandSummaryRows } from '../account-brand-summary'

describe('account brand summary', () => {
  it('exposes product, legal, support, and docs fields for settings UI', () => {
    const rows = getAccountBrandSummaryRows(AGENT_WORKBENCH_BRAND_CONFIG)

    expect(rows.map((row) => row.label)).toEqual(['Продукт', 'Юридическое лицо', 'Поддержка', 'Документация'])
    expect(rows[0]?.description).toContain('Agent Workbench Suite')
    expect(rows[1]?.description).toBe('ROX ONE')
    expect(rows[2]?.description).toBe('support@rox.one')
    expect(rows[3]?.description).toBe('https://rox.one/docs')
  })
})
