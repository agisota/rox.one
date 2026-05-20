/**
 * OnboardingPromptModal
 *
 * Generic 3-choice prompt modal used for the "Auto-launch Rox Design?" prompt.
 * Renders three action buttons (Always, Ask me, Never) plus an accessible
 * close/dismiss button.
 *
 * Phase D / T537 PR #4
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { AutoLaunchDesignChoice } from '@/hooks/useAutoLaunchDecision'

export interface OnboardingPromptModalProps {
  /**
   * Whether the modal is visible. Controlled externally so callers can
   * conditionally render it without unmounting the full settings tree.
   */
  open: boolean

  /** Title rendered at the top of the modal. */
  title: string

  /** Optional description rendered below the title. */
  description?: string

  /** Labels for the three choices. */
  labels?: {
    always?: string
    ask?: string
    never?: string
    close?: string
  }

  /** Called when the user picks a choice. */
  onChoice: (choice: AutoLaunchDesignChoice) => void

  /** Called when the user closes / dismisses without picking. */
  onClose: () => void
}

/**
 * OnboardingPromptModal
 *
 * Auto-launch prompt with 3 action buttons + close.
 * Accessible: modal role, labelled dialog, focus trap via the button layout.
 */
export function OnboardingPromptModal({
  open,
  title,
  description,
  labels = {},
  onChoice,
  onClose,
}: OnboardingPromptModalProps) {
  const { t } = useTranslation()

  const alwaysLabel = labels.always ?? t('onboarding.autoLaunch.always')
  const askLabel = labels.ask ?? t('onboarding.autoLaunch.ask')
  const neverLabel = labels.never ?? t('onboarding.autoLaunch.never')
  const closeLabel = labels.close ?? t('common.close')

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-background shadow-xl p-6 flex flex-col gap-4">
        {/* Close button */}
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col gap-1.5 pr-6">
          <h2
            id="onboarding-prompt-title"
            className="text-base font-semibold leading-snug text-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Choice buttons */}
        <div className="flex flex-col gap-2" role="group" aria-label={t('onboarding.autoLaunch.choiceGroupLabel')}>
          <button
            type="button"
            onClick={() => onChoice('always')}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {alwaysLabel}
          </button>
          <button
            type="button"
            onClick={() => onChoice('ask')}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-background shadow-minimal text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {askLabel}
          </button>
          <button
            type="button"
            onClick={() => onChoice('never')}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-background shadow-minimal text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {neverLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
