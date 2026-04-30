import { AGENT_WORKBENCH_BRAND_CONFIG, type BrandConfig } from "@rox-agent/shared/branding"
import pzdrkIcon from "@/assets/pzdrk.png"
import { getBrandSymbolAriaLabel } from "./brand-icon-copy"

interface RoxAgentsSymbolProps {
  className?: string
  brand?: BrandConfig
}

export function RoxAgentsSymbol({ className, brand = AGENT_WORKBENCH_BRAND_CONFIG }: RoxAgentsSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={getBrandSymbolAriaLabel(brand)}
    >
      <image
        href={pzdrkIcon}
        x="0"
        y="0"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  )
}
