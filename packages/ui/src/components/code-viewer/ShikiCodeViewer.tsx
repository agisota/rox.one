/**
 * ShikiCodeViewer - Read-only code viewer using Shiki syntax highlighting
 *
 * Platform-agnostic component for displaying code with:
 * - Line numbers
 * - Syntax highlighting via Shiki (via shared `getSingletonHighlighter`
 *   adapter from `@rox-one/shared/highlight`; see M.11/T174 migration off
 *   the raw `shiki` package onto the engine-agnostic adapter).
 * - Light/dark theme support
 * - Scrollable with custom scrollbar styling
 */

import * as React from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import { getSingletonHighlighter, resolveLanguage } from '@rox-one/shared/highlight'
import { cn } from '../../lib/utils'
import { LANGUAGE_MAP } from './language-map'

export interface ShikiCodeViewerProps {
  /** The code content to display */
  code: string
  /** Language for syntax highlighting (auto-detected from filePath if not provided) */
  language?: string
  /** File path - used for language detection if language not specified */
  filePath?: string
  /** Starting line number (default: 1) */
  startLine?: number
  /** Theme mode */
  theme?: 'light' | 'dark'
  /** Shiki theme name (e.g., 'github-dark', 'dracula'). Defaults to github-dark/github-light based on theme mode */
  shikiTheme?: string
  /** Callback when ready */
  onReady?: () => void
  /** Additional class names */
  className?: string
}

// Language preload + alias logic lives in the shared `@rox-one/shared/highlight`
// adapter (PRELOADED_LANGUAGES + LANGUAGE_ALIASES + resolveLanguage). This
// component no longer maintains its own copy — `resolveLanguage` returns
// null for unsupported fences and the adapter further falls back to 'text'.

function getLanguageFromPath(filePath: string, explicit?: string): string {
  if (explicit) return explicit
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return LANGUAGE_MAP[ext] || 'text'
}

/**
 * ShikiCodeViewer - Syntax highlighted code viewer with line numbers
 */
export function ShikiCodeViewer({
  code,
  language,
  filePath,
  startLine = 1,
  theme = 'light',
  shikiTheme,
  onReady,
  className,
}: ShikiCodeViewerProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasCalledReady = useRef(false)

  // Resolve language from props or file path via the shared adapter — falls
  // back to 'text' if the input is not in the curated preload set. The
  // highlighter itself also resolves unsupported languages to 'text' as a
  // second line of defence.
  const resolvedLang: string = useMemo(() => {
    const lang = language || (filePath ? getLanguageFromPath(filePath) : 'text')
    return resolveLanguage(lang) ?? 'text'
  }, [language, filePath])

  // Split code into lines for line numbers
  const lines = useMemo(() => code.split('\n'), [code])

  // Highlight code with Shiki
  useEffect(() => {
    let cancelled = false

    async function highlight() {
      // Use provided shikiTheme or fall back to github theme based on mode
      const resolvedShikiTheme = shikiTheme || (theme === 'dark' ? 'github-dark' : 'github-light')

      try {
        const highlighter = await getSingletonHighlighter()
        const html = await highlighter.highlight(code, resolvedLang, {
          theme: resolvedShikiTheme,
        })

        if (!cancelled) {
          setHighlighted(html)
          setIsLoading(false)

          // Call onReady once
          if (!hasCalledReady.current && onReady) {
            hasCalledReady.current = true
            requestAnimationFrame(() => onReady())
          }
        }
      } catch (error) {
        console.warn(`Shiki highlighting failed for language "${resolvedLang}":`, error)
        if (!cancelled) {
          setHighlighted(null)
          setIsLoading(false)

          if (!hasCalledReady.current && onReady) {
            hasCalledReady.current = true
            requestAnimationFrame(() => onReady())
          }
        }
      }
    }

    highlight()

    return () => {
      cancelled = true
    }
  }, [code, resolvedLang, theme, shikiTheme, onReady])

  // Use CSS variables so custom themes are respected
  const backgroundColor = 'var(--background)'
  const lineNumberColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'

  return (
    <div
      className={cn('h-full w-full overflow-auto', className)}
      style={{ backgroundColor }}
    >
      <div className="min-h-full flex">
        {/* Line numbers gutter */}
        <div
          className="sticky left-0 shrink-0 select-none text-right pr-4 pt-4 pb-4"
          style={{
            backgroundColor,
            borderRight: `1px solid ${borderColor}`,
            minWidth: '60px',
          }}
        >
          {lines.map((_, index) => (
            <div
              key={index}
              className="font-mono text-[13px] leading-[1.6] px-2"
              style={{ color: lineNumberColor }}
            >
              {startLine + index}
            </div>
          ))}
        </div>

        {/* Code content */}
        <div className="flex-1 min-w-0 p-4 overflow-x-auto">
          {isLoading || !highlighted ? (
            <pre className="font-mono text-[13px] leading-[1.6] whitespace-pre">
              <code>{code}</code>
            </pre>
          ) : (
            <div
              className={cn(
                'font-mono text-[13px] leading-[1.6]',
                '[&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_pre]:whitespace-pre',
                '[&_code]:!bg-transparent'
              )}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
