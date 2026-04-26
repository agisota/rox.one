interface RoxAgentsSymbolProps {
  className?: string
}

/**
 * ROX ONE crystal symbol — premium gemstone icon
 * Multi-facet diamond with depth, refraction highlights, and apex sparkle
 * Uses accent color from theme (currentColor from className)
 */
export function RoxAgentsSymbol({ className }: RoxAgentsSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top crown facet */}
      <path
        d="M12 1.5L20.5 8.5L12 13.5L3.5 8.5Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      {/* Left pavilion facet */}
      <path
        d="M3.5 8.5L12 13.5L9.5 19L3 11Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
      {/* Right pavilion facet */}
      <path
        d="M20.5 8.5L21 11L14.5 19L12 13.5Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      {/* Bottom culet */}
      <path
        d="M9.5 19L12 13.5L14.5 19L12 21.5Z"
        fill="currentColor"
        fillOpacity="0.4"
      />
      {/* Top-left edge highlight */}
      <path
        d="M12 1.5L3.5 8.5"
        stroke="currentColor"
        strokeWidth="0.4"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />
      {/* Top-right edge highlight */}
      <path
        d="M12 1.5L20.5 8.5"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />
      {/* Horizontal girdle */}
      <path
        d="M3.5 8.5L20.5 8.5"
        stroke="currentColor"
        strokeWidth="0.3"
        strokeOpacity="0.2"
        strokeLinecap="round"
      />
      {/* Center vertical */}
      <path
        d="M12 1.5L12 21.5"
        stroke="currentColor"
        strokeWidth="0.4"
        strokeOpacity="0.15"
        strokeLinecap="round"
      />
      {/* Reflection triangle */}
      <path
        d="M12 1.5L8.5 5.5L10 6.5Z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Apex sparkle */}
      <circle cx="12" cy="1.5" r="0.6" fill="currentColor" fillOpacity="0.7" />
    </svg>
  )
}
