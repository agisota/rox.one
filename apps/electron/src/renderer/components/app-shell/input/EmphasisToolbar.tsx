/**
 * EmphasisToolbar.tsx (M.10 T235)
 *
 * Presentational 4-button toolbar (Bold / Italic / Code / Strike) that sits
 * near the composer textarea. Pure UI — all logic about *how* the markdown
 * markers wrap text lives in `emphasis-mode.ts`; this component only
 * notifies the parent via `onToggle(mode)` when a button is clicked or its
 * keyboard shortcut fires.
 *
 * The toolbar is intentionally lightweight so it can be reused in both the
 * desktop composer and the compact composer surface. The host component is
 * responsible for positioning, focus management, and the actual textarea
 * mutation.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { isMac } from '@/lib/platform'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rox-one/ui'

import {
  EMPHASIS_SHORTCUTS,
  type EmphasisMode,
} from './emphasis-mode'

export interface EmphasisToolbarProps {
  /** Called when a toolbar button (or its bound shortcut) is activated. */
  onToggle: (mode: EmphasisMode) => void
  /** Optional disabled flag — wires through to every button. */
  disabled?: boolean
  /** Optional className to position the toolbar inside its host. */
  className?: string
  /** Optional override for the bag of modes shown; defaults to all four. */
  modes?: readonly EmphasisMode[]
  /**
   * `data-testid` prefix so RTL tests can find individual buttons without
   * relying on glyph text (which varies across locales).
   */
  testIdPrefix?: string
}

/**
 * Glyph rendered inside each toolbar button. We use semantic styling
 * (`<strong>`, `<em>`, etc.) rather than an icon set so the toolbar reads
 * sensibly when CSS fails to load and keeps the visual treatment in lock
 * step with the markdown that ships in the message.
 */
function EmphasisGlyph({ mode }: { mode: EmphasisMode }): React.ReactElement {
  switch (mode) {
    case 'bold':
      return <strong className="font-bold" aria-hidden>B</strong>
    case 'italic':
      return <em className="italic" aria-hidden>I</em>
    case 'code':
      return <span className="font-mono" aria-hidden>{'<>'}</span>
    case 'strike':
      return <span className="line-through" aria-hidden>S</span>
  }
}

/**
 * Build the tooltip display label for a given mode. The shortcut string is
 * platform-aware (Cmd on macOS, Ctrl elsewhere) and uses the `{{shortcut}}`
 * interpolation surface so translators can re-order the parts without
 * editing code.
 */
function shortcutDisplay(mode: EmphasisMode): string {
  const entry = EMPHASIS_SHORTCUTS.find((shortcut) => shortcut.mode === mode)
  if (!entry) return ''
  const mod = isMac ? '⌘' : 'Ctrl+'
  const shift = entry.requiresShift ? (isMac ? '⇧' : 'Shift+') : ''
  // Render the key portion as the friendly label, e.g. "B", "I", "`", "X".
  const keyLabel = (() => {
    switch (entry.code) {
      case 'KeyB':
        return 'B'
      case 'KeyI':
        return 'I'
      case 'Backquote':
        return '`'
      case 'KeyX':
        return 'X'
      default:
        return entry.code
    }
  })()
  return `${mod}${shift}${keyLabel}`
}

const DEFAULT_MODES: readonly EmphasisMode[] = ['bold', 'italic', 'code', 'strike']

export function EmphasisToolbar({
  onToggle,
  disabled,
  className,
  modes = DEFAULT_MODES,
  testIdPrefix = 'composer-emphasis',
}: EmphasisToolbarProps): React.ReactElement {
  const { t } = useTranslation()

  // The toolbar is keyed by `aria-label` so screen readers announce it as a
  // single named group rather than four floating buttons.
  const groupLabel = t('workbench.composer.emphasis.toolbar.aria-label', {
    defaultValue: 'Formatting',
  })

  return (
    <div
      role="toolbar"
      aria-label={groupLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-background/60 p-0.5 text-xs',
        className,
      )}
      data-testid={`${testIdPrefix}-toolbar`}
    >
      {modes.map((mode) => {
        const tooltip = t('workbench.composer.emphasis.toolbar.tooltip', {
          defaultValue: '{{label}} ({{shortcut}})',
          label: capitaliseLabel(mode),
          shortcut: shortcutDisplay(mode),
        })
        const buttonLabel = capitaliseLabel(mode)
        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label={buttonLabel}
                title={tooltip}
                data-testid={`${testIdPrefix}-${mode}`}
                data-mode={mode}
                onMouseDown={(event) => {
                  // Preventing default keeps the textarea selection in place
                  // when the user clicks the button — otherwise focus would
                  // jump and the selection would collapse.
                  event.preventDefault()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  if (disabled) return
                  onToggle(mode)
                }}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded text-foreground/70',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <EmphasisGlyph mode={mode} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

/**
 * Title-case a mode identifier for ARIA labels and tooltip interpolation.
 * Translators receive the result via the `{{label}}` token, which lets them
 * either substitute their own translation of the mode name or keep the
 * English label if no translation has been provided yet.
 */
function capitaliseLabel(mode: EmphasisMode): string {
  switch (mode) {
    case 'bold':
      return 'Bold'
    case 'italic':
      return 'Italic'
    case 'code':
      return 'Code'
    case 'strike':
      return 'Strike'
  }
}
