import { AGENT_WORKBENCH_BRAND_CONFIG, type BrandConfig } from "@craft-agent/shared/branding"
import pzdrkIcon from "@/assets/pzdrk.png"
import { getBrandIconAltText } from "./brand-icon-copy"

interface CraftAppIconProps {
  className?: string
  size?: number
  brand?: BrandConfig
}

export function CraftAppIcon({ className, size = 64, brand = AGENT_WORKBENCH_BRAND_CONFIG }: CraftAppIconProps) {
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
