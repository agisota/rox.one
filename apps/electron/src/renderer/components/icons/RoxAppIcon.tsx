import roxLogo from "@/assets/rox_logo_c.svg"

interface RoxAppIconProps {
  className?: string
  size?: number
}

/**
 * RoxAppIcon - Displays the ROX ONE gemstone logo
 */
export function RoxAppIcon({ className, size = 64 }: RoxAppIconProps) {
  return (
    <img
      src={roxLogo}
      alt="ROX ONE"
      width={size}
      height={size}
      className={className}
    />
  )
}
