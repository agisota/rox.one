/**
 * Header - App header with branding and controls
 */

import { Sun, Moon, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * ROXAgentLogo - The ROX "C" logo
 */
function ROXAgentLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <linearGradient id="rox-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00D4FF" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#0B1020" />
      <path
        d="M7 18V6H12.8C15.9 6 17.5 7.5 17.5 10C17.5 11.8 16.6 13.1 14.9 13.7L17.8 18H14.9L12.4 14.1H9.7V18H7ZM9.7 11.6H12.6C14.1 11.6 14.9 11 14.9 10C14.9 9 14.1 8.4 12.6 8.4H9.7V11.6Z"
        fill="url(#rox-gradient)"
      />
    </svg>
  )
}

interface HeaderProps {
  hasSession: boolean
  sessionTitle?: string
  isDark: boolean
  onToggleTheme: () => void
  onClear: () => void
}

export function Header({ hasSession, sessionTitle, isDark, onToggleTheme, onClear }: HeaderProps) {
  const { t } = useTranslation()
  return (
    <header className="shrink-0 grid grid-cols-[auto_1fr_auto] items-center px-4 py-3">
      {/* Logo - links to main site */}
      <a
        href="https://app.rox.one"
        className="hover:opacity-80 transition-opacity"
        title="ROX"
      >
        <ROXAgentLogo className="w-6 h-6 text-[#9570BE]" />
      </a>

      {/* Session title - centered */}
      <div className="flex justify-center">
        {sessionTitle && (
          <span className="text-sm font-semibold text-foreground truncate max-w-md">
            {sessionTitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Clear button (when session is loaded) */}
        {hasSession && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-md bg-background shadow-minimal text-foreground/40 hover:text-foreground/70 transition-colors"
            title={t('viewer.clearSession')}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-md bg-background shadow-minimal text-foreground/40 hover:text-foreground/70 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
