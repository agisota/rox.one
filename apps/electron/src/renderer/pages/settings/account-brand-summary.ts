import { AGENT_WORKBENCH_BRAND_CONFIG, getBrandDocsUrl, type BrandConfig } from '@craft-agent/shared/branding'

export interface AccountBrandSummaryRow {
  label: string
  description: string
}

export type AccountBrandSummaryTranslator = (
  key: string,
  values?: Record<string, string>,
) => string

export const ACCOUNT_BRAND_SUMMARY_KEYS = {
  product: 'workbench.brand.product',
  productDescription: 'workbench.brand.productDescription',
  legalName: 'workbench.brand.legalName',
  support: 'workbench.brand.support',
  documentation: 'workbench.brand.documentation',
} as const

function defaultBrandSummaryTranslator(
  key: string,
  values: Record<string, string> = {},
): string {
  switch (key) {
    case ACCOUNT_BRAND_SUMMARY_KEYS.product:
      return 'Product'
    case ACCOUNT_BRAND_SUMMARY_KEYS.productDescription:
      return `${values.productName ?? ''} / ${values.tagline ?? ''}`.trim()
    case ACCOUNT_BRAND_SUMMARY_KEYS.legalName:
      return 'Legal entity'
    case ACCOUNT_BRAND_SUMMARY_KEYS.support:
      return 'Support'
    case ACCOUNT_BRAND_SUMMARY_KEYS.documentation:
      return 'Documentation'
    default:
      return key
  }
}

export function getAccountBrandSummaryRows(
  brand: BrandConfig = AGENT_WORKBENCH_BRAND_CONFIG,
  t: AccountBrandSummaryTranslator = defaultBrandSummaryTranslator,
): AccountBrandSummaryRow[] {
  return [
    {
      label: t(ACCOUNT_BRAND_SUMMARY_KEYS.product),
      description: t(ACCOUNT_BRAND_SUMMARY_KEYS.productDescription, {
        productName: brand.productName,
        tagline: brand.tagline,
      }),
    },
    { label: t(ACCOUNT_BRAND_SUMMARY_KEYS.legalName), description: brand.legalName },
    { label: t(ACCOUNT_BRAND_SUMMARY_KEYS.support), description: brand.supportEmail },
    { label: t(ACCOUNT_BRAND_SUMMARY_KEYS.documentation), description: getBrandDocsUrl(undefined, brand) },
  ]
}
