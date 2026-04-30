import { AGENT_WORKBENCH_BRAND_CONFIG, getBrandDocsUrl, type BrandConfig } from '@rox-agent/shared/branding'

export interface AccountBrandSummaryRow {
  label: string
  description: string
}

export function getAccountBrandSummaryRows(brand: BrandConfig = AGENT_WORKBENCH_BRAND_CONFIG): AccountBrandSummaryRow[] {
  return [
    { label: 'Продукт', description: `${brand.productName} / ${brand.tagline}` },
    { label: 'Юридическое лицо', description: brand.legalName },
    { label: 'Поддержка', description: brand.supportEmail },
    { label: 'Документация', description: getBrandDocsUrl(undefined, brand) },
  ]
}
