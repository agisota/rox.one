interface RoxAgentsLogoProps {
  className?: string
}

/**
 * ROX ONE logo - crystal symbol + wordmark
 * Uses accent color from theme (currentColor from className)
 */
export function RoxAgentsLogo({ className }: RoxAgentsLogoProps) {
  return (
    <svg
      viewBox="0 0 120 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L22 12L12 22L2 12Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        d="M12 2L12 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.3"
      />
      <path
        d="M2 12L22 12"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.2"
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
        ROX ONE
      </text>
    </svg>
  )
}
