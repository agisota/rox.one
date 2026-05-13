/**
 * LineNumbersGutter.tsx (M.10 T236)
 *
 * Presentational fixed-width gutter that renders `1..N` row numbers next to
 * the composer textarea. Visible only when the composer is in expanded mode
 * (the parent passes `visible={isExpanded}`); when hidden the component
 * renders nothing so it never costs DOM nodes in compact mode.
 *
 * Pure UI — no state, no DOM-measurement. The row count comes from the pure
 * `countLines` helper in `line-numbers.ts`. Tested by both the helper's
 * bun:test suite and an RTL test that verifies visibility + count rendering.
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

import { buildLineNumbers } from './line-numbers'

export interface LineNumbersGutterProps {
  /** Current textarea value. Used only to compute the number of rows. */
  value: string
  /** Whether the composer is in expanded mode; hidden otherwise. */
  visible: boolean
  /** Optional className override for positioning inside the host. */
  className?: string
  /**
   * `data-testid` override so RTL tests can latch onto the gutter without
   * relying on the row text (which is numeric and locale-stable).
   */
  testId?: string
}

/**
 * Renders the gutter as an `aria-hidden` block — the row numbers are
 * decorative cues for the sighted user; screen readers should announce the
 * textarea contents directly rather than re-reading the gutter.
 *
 * Layout note: `font-mono` + `leading-6` aligns each row to a 24px row
 * height, which matches the composer textarea's 1.5 line-height at the
 * 16px base font size (`text-base`). If the textarea's line-height ever
 * diverges, update this single class to keep the rows aligned.
 */
export function LineNumbersGutter({
  value,
  visible,
  className,
  testId = 'composer-line-numbers-gutter',
}: LineNumbersGutterProps): React.ReactElement | null {
  if (!visible) return null

  const rows = buildLineNumbers(value)
  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      data-line-count={rows.length}
      className={cn(
        'line-numbers-gutter',
        'select-none pointer-events-none',
        'flex flex-col items-end',
        'min-w-[2.5rem] px-2 py-4',
        'font-mono text-xs leading-6',
        'text-foreground/40',
        'border-r border-border/40',
        className,
      )}
    >
      {rows.map((n) => (
        <span
          key={n}
          data-line-number={n}
          className="block tabular-nums"
        >
          {n}
        </span>
      ))}
    </div>
  )
}
