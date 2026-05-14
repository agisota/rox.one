/**
 * LabelValuePopover - Popover for editing a label's typed value or removing it.
 *
 * Opens when clicking a LabelBadge. Shows:
 * - Value editor input adapted to the label's valueType (number/string/date)
 * - "Remove" button to detach the label from the session
 *
 * Value changes are committed on Enter or blur; Escape cancels and closes.
 * Boolean labels (no valueType) show only the remove button.
 *
 * T132: This module is only the lightweight Popover trigger wrapper. The heavy
 * editor body (react-day-picker calendar + chrono-node + date-fns) is split
 * into `./label-value-popover-content.tsx` and lazy-loaded the first time the
 * popover opens. That keeps ~108 KB gz out of the main app-shell chunk.
 */

import * as React from 'react'
import { Popover, PopoverTrigger } from './popover'
import type { LabelConfig } from '@rox-one/shared/labels'

const LazyLabelValuePopoverContent = React.lazy(() =>
  import('./label-value-popover-content').then((m) => ({ default: m.LabelValuePopoverContent })),
)

export interface LabelValuePopoverProps {
  /** Label configuration (color, name, valueType) */
  label: LabelConfig
  /** Current raw value string */
  value?: string
  /** Called when user commits a new value (Enter or blur) */
  onValueChange?: (newValue: string | undefined) => void
  /** Called when user clicks "Remove" */
  onRemove?: () => void
  /** Controlled open state */
  open: boolean
  /** Open state change handler */
  onOpenChange: (open: boolean) => void
  /** Session identifier for scoped focus restoration */
  sessionId?: string
  /** The trigger element (typically a LabelBadge) */
  children: React.ReactNode
}

export function LabelValuePopover({
  label,
  value,
  onValueChange,
  onRemove,
  open,
  onOpenChange,
  sessionId,
  children,
}: LabelValuePopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      {open ? (
        <React.Suspense fallback={null}>
          <LazyLabelValuePopoverContent
            label={label}
            value={value}
            onValueChange={onValueChange}
            onRemove={onRemove}
            onOpenChange={onOpenChange}
            sessionId={sessionId}
          />
        </React.Suspense>
      ) : null}
    </Popover>
  )
}
