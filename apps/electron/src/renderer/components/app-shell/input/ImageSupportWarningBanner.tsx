import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotionPreference } from '@/context/ReducedMotionContext'

export interface ImageSupportWarningBannerProps {
  /** Display name of the active model — interpolated into the message. */
  modelName: string
  /** Click-handler for the inline "Enable image support" action. */
  onEnable: () => void
}

/**
 * Pre-flight banner shown above the chat input when the user has staged image
 * attachments while the active custom-endpoint model is configured as text-only.
 *
 * Rendering conditions live in the parent (`FreeFormInput`); this component just
 * draws the warning and the inline action. The action calls the same
 * `setModelSupportsImages` flow used by the model picker's per-row toggle, so the
 * two surfaces always agree on the connection's state.
 */
export function ImageSupportWarningBanner({
  modelName,
  onEnable,
}: ImageSupportWarningBannerProps) {
  const { t } = useTranslation()
  const reduced = useReducedMotionPreference()
  const transition = reduced ? { duration: 0 } : { duration: 0.2 }

  return (
    <AnimatePresence>
      <motion.div
        key="image-support-warning"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={transition}
        className="flex items-center gap-2 px-3 py-2 mx-2 mt-2 rounded-md bg-amber-500/10 text-foreground/70 text-xs"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="flex-1 min-w-0">
          {t('chat.imageWarning.title', { modelName })}
        </span>
        <button
          type="button"
          onClick={onEnable}
          className="shrink-0 underline underline-offset-2 hover:text-foreground"
        >
          {t('chat.imageWarning.action')}
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
