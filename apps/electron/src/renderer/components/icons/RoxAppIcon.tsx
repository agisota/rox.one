import { AGENT_WORKBENCH_BRAND_CONFIG, type BrandConfig } from "@rox-one/shared/branding"
import pzdrkIcon from "@/assets/pzdrk.png"
import { getBrandIconAltText } from "./brand-icon-copy"

interface RoxAppIconProps {
  className?: string
  size?: number
  brand?: BrandConfig
}

export function RoxAppIcon({ className, size = 64, brand = AGENT_WORKBENCH_BRAND_CONFIG }: RoxAppIconProps) {
  return (
    <img
      src={pzdrkIcon}
      alt={getBrandIconAltText(brand)}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}
