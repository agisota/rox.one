import { AGENT_WORKBENCH_BRAND_CONFIG, type BrandConfig } from "@craft-agent/shared/branding"
import pzdrkIcon from "@/assets/pzdrk.png"
import { getBrandLogoText } from "./brand-icon-copy"

interface CraftAgentsLogoProps {
  className?: string
  brand?: BrandConfig
}

export function CraftAgentsLogo({ className, brand = AGENT_WORKBENCH_BRAND_CONFIG }: CraftAgentsLogoProps) {
  return (
    <svg
      viewBox="0 0 220 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image
        href={pzdrkIcon}
        x="0"
        y="0"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
      />
      <text
        x="28"
        y="17"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="13"
        fontWeight="600"
        letterSpacing="0.5"
        fill="currentColor"
      >
        {getBrandLogoText(brand)}
      </text>
    </svg>
  )
}
