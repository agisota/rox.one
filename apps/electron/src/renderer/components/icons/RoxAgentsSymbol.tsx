import pzdrkIcon from "@/assets/pzdrk.png"

interface RoxAgentsSymbolProps {
  className?: string
}

export function RoxAgentsSymbol({ className }: RoxAgentsSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ROX ONE"
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
