import { describe, expect, it } from 'bun:test'
import { AGENT_WORKBENCH_BRAND_CONFIG } from '@rox-one/shared/branding'
import { getAccountBrandSummaryRows } from '../account-brand-summary'

function makeTranslator(messages: Record<string, string>) {
  return (key: string, values?: Record<string, string>) => {
    let message = messages[key] ?? key
    for (const [name, value] of Object.entries(values ?? {})) {
      message = message.replaceAll(`{{${name}}}`, value)
    }
    return message
  }
}

describe('account brand summary localization', () => {
  it('renders brand rows with English labels', () => {
    const rows = getAccountBrandSummaryRows(
      AGENT_WORKBENCH_BRAND_CONFIG,
      makeTranslator({
        'workbench.brand.product': 'Product',
        'workbench.brand.productDescription': '{{productName}} / {{tagline}}',
        'workbench.brand.legalName': 'Legal entity',
        'workbench.brand.support': 'Support',
        'workbench.brand.documentation': 'Documentation',
      }),
    )

    expect(rows).toEqual([
      {
        label: 'Product',
        description: 'Agent Workbench Suite / A local and cloud workbench for agentic workflows',
      },
      { label: 'Legal entity', description: 'ROX.ONE' },
      { label: 'Support', description: 'support@rox.one' },
      { label: 'Documentation', description: 'https://rox.one/docs' },
    ])
  })

  it('renders brand rows with Russian labels', () => {
    const rows = getAccountBrandSummaryRows(
      AGENT_WORKBENCH_BRAND_CONFIG,
      makeTranslator({
        'workbench.brand.product': 'Продукт',
        'workbench.brand.productDescription': '{{productName}} / {{tagline}}',
        'workbench.brand.legalName': 'Юридическое лицо',
        'workbench.brand.support': 'Поддержка',
        'workbench.brand.documentation': 'Документация',
      }),
    )

    expect(rows.map((row) => row.label)).toEqual([
      'Продукт',
      'Юридическое лицо',
      'Поддержка',
      'Документация',
    ])
  })
})
