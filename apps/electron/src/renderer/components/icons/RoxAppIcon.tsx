import roxLogo from "@/assets/rox_logo_c.svg"

interface RoxAppIconProps {
  className?: string
  size?: number
}

/**
 * RoxAppIcon - Displays the Rox logo (colorful "C" icon)
 */
export function RoxAppIcon({ className, size = 64 }: RoxAppIconProps) {
  return (
    <img
      src={roxLogo}
      alt="Rox"
      width={size}
      height={size}
      className={className}
    />
  )
}
