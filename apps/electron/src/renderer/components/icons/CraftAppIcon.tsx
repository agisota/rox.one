import pzdrkIcon from "@/assets/pzdrk.png"

interface CraftAppIconProps {
  className?: string
  size?: number
}

export function CraftAppIcon({ className, size = 64 }: CraftAppIconProps) {
  return (
    <img
      src={pzdrkIcon}
      alt="ROX ONE"
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}
