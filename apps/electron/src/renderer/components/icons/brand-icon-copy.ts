import { AGENT_WORKBENCH_BRAND_CONFIG, type BrandConfig } from '@craft-agent/shared/branding'

export function getBrandLogoText(brand: BrandConfig = AGENT_WORKBENCH_BRAND_CONFIG): string {
  return brand.productName
}

export function getBrandSymbolAriaLabel(brand: BrandConfig = AGENT_WORKBENCH_BRAND_CONFIG): string {
  return brand.productName
}

export function getBrandIconAltText(brand: BrandConfig = AGENT_WORKBENCH_BRAND_CONFIG): string {
  return brand.productName
}
