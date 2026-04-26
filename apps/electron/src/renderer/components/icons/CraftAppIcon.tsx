import craftLogo from "@/assets/craft_logo_c.svg"

interface CraftAppIconProps {
  className?: string
  size?: number
}

/**
 * CraftAppIcon - Displays the ROX ONE gemstone logo
 */
export function CraftAppIcon({ className, size = 64 }: CraftAppIconProps) {
  return (
    <img
      src={craftLogo}
      alt="ROX ONE"
      width={size}
      height={size}
      className={className}
    />
  )
}
