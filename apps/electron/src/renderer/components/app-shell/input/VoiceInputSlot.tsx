/**
 * VoiceInputSlot.tsx (M.10 T238)
 *
 * Placeholder toolbar slot for the composer's voice-input feature. T238
 * intentionally ships only the slot — the ASR (automatic speech
 * recognition) backend integration lives in T239 once a provider is
 * picked. Today the slot renders a disabled microphone button whose
 * tooltip explains the feature is coming soon. The interface is shaped
 * so T239 can swap in a real `onStart` handler without touching the
 * surrounding toolbar JSX.
 *
 * The component is pure UI: it owns no state, fires no side effects, and
 * is unaware of `mediaDevices` / `AudioContext`. The host (FreeFormInput)
 * decides whether to pass `onStart` — when absent, the button stays
 * disabled and the tooltip surfaces the "coming soon" copy.
 */

import * as React from 'react'
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rox-one/ui'

export interface VoiceInputSlotProps {
  /**
   * Optional start handler. When defined, the slot is interactive and the
   * tooltip omits the "coming soon" hint. When undefined (the T238 default)
   * the button renders disabled and the tooltip explains why. Wiring the
   * real ASR provider in T239 is a one-line change: pass an `onStart`
   * implementation from the host and the disabled state flips off.
   */
  onStart?: () => void
  /**
   * Optional stop handler (T239). When the slot is currently `recording`,
   * clicking the button calls `onStop` instead of `onStart` so the same
   * affordance toggles capture on / off. Omitted hosts treat the button as
   * single-shot start-only.
   */
  onStop?: () => void
  /**
   * Optional recording flag (T239). When `true`, the slot renders an
   * "active" state — different tooltip body and a `data-recording` hook
   * so RTL tests can assert the live affordance. Defaults to `false` so
   * existing T238 callers keep their behaviour.
   */
  recording?: boolean
  /** Optional disabled override (forces disabled even when `onStart` is set). */
  disabled?: boolean
  /** Optional className for host-side positioning inside the toolbar row. */
  className?: string
  /** `data-testid` prefix so RTL tests can target the button deterministically. */
  testIdPrefix?: string
}

export function VoiceInputSlot({
  onStart,
  onStop,
  recording = false,
  disabled,
  className,
  testIdPrefix = 'composer-voice-input',
}: VoiceInputSlotProps): React.ReactElement {
  const { t } = useTranslation()

  // The aria-label is always the canonical action name so screen readers
  // announce "Voice input, button" regardless of whether the placeholder
  // tooltip is currently surfaced.
  const ariaLabel = t('composer.voiceInput.aria-label', {
    defaultValue: 'Voice input',
  })
  const comingSoon = t('composer.voiceInput.comingSoon', {
    defaultValue: 'Coming soon',
  })
  // T239: when actively capturing, the tooltip body advertises the stop
  // action so the operator knows the same affordance ends the session.
  const stopLabel = t('composer.voiceInput.stop', {
    defaultValue: 'Stop recording',
  })

  // The slot is disabled when (a) no provider has been registered yet
  // (the T238 placeholder mode) OR (b) the host explicitly forces it.
  // Either case surfaces the "coming soon" tooltip so the user has a
  // consistent explanation for why the button cannot be activated.
  const isPlaceholder = onStart === undefined
  const isDisabled = isPlaceholder || disabled === true

  // Tooltip body resolves to one of three messages:
  //   - placeholder mode → "Voice input — Coming soon" (T238 copy)
  //   - recording → "Stop recording" so the toggle behaviour is discoverable
  //   - interactive idle → plain "Voice input" action name
  const tooltipBody = isPlaceholder
    ? `${ariaLabel} — ${comingSoon}`
    : recording
      ? stopLabel
      : ariaLabel

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={isDisabled}
          aria-label={ariaLabel}
          aria-disabled={isDisabled || undefined}
          aria-pressed={!isPlaceholder ? recording : undefined}
          title={tooltipBody}
          data-testid={`${testIdPrefix}-button`}
          data-placeholder={isPlaceholder ? 'true' : 'false'}
          data-recording={recording ? 'true' : 'false'}
          onMouseDown={(event) => {
            // Match the emphasis toolbar's behaviour — preserve textarea
            // selection on click instead of stealing focus to the button.
            event.preventDefault()
          }}
          onClick={(event) => {
            event.preventDefault()
            if (isDisabled) return
            if (recording) {
              // T239: while recording, the same button stops capture.
              // If the host wired the slot without a stop handler the
              // click becomes a no-op — we deliberately do NOT fall back
              // to `onStart` because that would double-start a recognizer
              // that is already mid-session.
              if (onStop) onStop()
              return
            }
            if (!onStart) return
            onStart()
          }}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded text-foreground/70',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            isDisabled && 'opacity-50 cursor-not-allowed',
            recording && 'text-destructive bg-destructive/10',
            className,
          )}
        >
          <Mic size={14} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  )
}
