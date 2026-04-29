import pzdrkIcon from "@/assets/pzdrk.png"

interface RoxAppIconProps {
  className?: string
  size?: number
}

export function RoxAppIcon({ className, size = 64 }: RoxAppIconProps) {
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
