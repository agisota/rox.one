/**
 * LabelValuePopoverContent — heavy editor body for {@link LabelValuePopover}.
 *
 * Split out from `label-value-popover.tsx` so the date editor pulls
 * `react-day-picker`, `chrono-node`, and `date-fns` into a lazy chunk instead
 * of the eagerly-loaded app-shell main chunk (T132). The trigger wrapper stays
 * lightweight; this body is loaded the first time a popover actually opens.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, CalendarDays } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Calendar } from './calendar'
import { cn } from '@/lib/utils'
import { parseDate } from 'chrono-node'
import { format, parse } from 'date-fns'
import type { LabelConfig } from '@rox-one/shared/labels'

export interface LabelValuePopoverContentProps {
  label: LabelConfig
  value?: string
  onValueChange?: (newValue: string | undefined) => void
  onRemove?: () => void
  onOpenChange: (open: boolean) => void
  sessionId?: string
}

export function LabelValuePopoverContent({
  label,
  value,
  onValueChange,
  onRemove,
  onOpenChange,
  sessionId,
}: LabelValuePopoverContentProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = React.useState(value ?? '')
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const removeButtonRef = React.useRef<HTMLButtonElement>(null)

  // On mount (open), seed the draft from the current value. For date labels
  // with a stored YYYY-MM-DD, display a human-friendly form for editing.
  React.useEffect(() => {
    if (label.valueType === 'date' && value) {
      try {
        const parsed = parse(value, 'yyyy-MM-dd', new Date())
        setDraft(format(parsed, 'MMMM d, yyyy'))
      } catch {
        setDraft(value)
      }
    } else {
      setDraft(value ?? '')
    }
    // Run once per mount; value identity is the only meaningful trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenAutoFocus = React.useCallback((e: Event) => {
    e.preventDefault()
    if (label.valueType) {
      inputRef.current?.focus()
    } else {
      removeButtonRef.current?.focus()
    }
  }, [label.valueType])

  const handleCloseAutoFocus = React.useCallback((e: Event) => {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('rox:focus-input', {
      detail: { sessionId },
    }))
  }, [sessionId])

  const commitValue = React.useCallback(() => {
    const trimmed = draft.trim()
    onValueChange?.(trimmed || undefined)
  }, [draft, onValueChange])

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitValue()
      onOpenChange(false)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value ?? '')
      onOpenChange(false)
    }
  }, [commitValue, onOpenChange, value])

  const parsedDate = React.useMemo(() => {
    if (label.valueType !== 'date' || !draft.trim()) return null
    return parseDate(draft.trim())
  }, [label.valueType, draft])

  const calendarDate = React.useMemo(() => {
    if (parsedDate) return parsedDate
    if (label.valueType === 'date' && value) {
      try {
        return parse(value, 'yyyy-MM-dd', new Date())
      } catch {
        return undefined
      }
    }
    return undefined
  }, [parsedDate, label.valueType, value])

  const handleDateKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (parsedDate) {
        onValueChange?.(format(parsedDate, 'yyyy-MM-dd'))
        onOpenChange(false)
      } else if (!draft.trim()) {
        onValueChange?.(undefined)
        onOpenChange(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(value ?? '')
      onOpenChange(false)
    }
  }, [parsedDate, draft, onOpenChange, onValueChange, value])

  return (
    <PopoverContent
      side="top"
      align="start"
      sideOffset={6}
      collisionPadding={12}
      className="w-56 p-0"
      onOpenAutoFocus={handleOpenAutoFocus}
      onCloseAutoFocus={handleCloseAutoFocus}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {label.valueType === 'date' && (
        <div className="px-1.5 py-1.5 border-b border-border/50">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setCalendarOpen(true)
                } else {
                  handleDateKeyDown(e)
                }
              }}
              onBlur={() => {
                if (parsedDate) {
                  onValueChange?.(format(parsedDate, 'yyyy-MM-dd'))
                } else if (!draft.trim()) {
                  onValueChange?.(undefined)
                }
              }}
              placeholder="tomorrow, next friday..."
              className={cn(
                'flex-1 h-7 px-2 text-[13px]',
                'bg-transparent',
                'text-foreground placeholder:text-foreground/30',
                'outline-none',
              )}
            />
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Select date"
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-[5px]',
                    'hover:bg-foreground/5 transition-colors cursor-pointer',
                    'outline-none',
                    calendarOpen && 'bg-foreground/5',
                  )}
                >
                  <CalendarDays className="w-3.5 h-3.5 text-foreground/50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[220px] overflow-hidden p-0"
                side="top"
                align="end"
                sideOffset={8}
              >
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  captionLayout="dropdown"
                  defaultMonth={calendarDate}
                  onSelect={(date) => {
                    if (date) {
                      onValueChange?.(format(date, 'yyyy-MM-dd'))
                      setDraft(format(date, 'MMMM d, yyyy'))
                      setCalendarOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          {parsedDate && (
            <div className="px-2 text-[11px] text-foreground/50">
              {format(parsedDate, 'EEE, MMM d, yyyy')}
            </div>
          )}
        </div>
      )}

      {label.valueType && label.valueType !== 'date' && (
        <div className="px-1.5 py-1.5 border-b border-border/50">
          <input
            ref={inputRef}
            type={label.valueType === 'number' ? 'number' : 'text'}
            step={label.valueType === 'number' ? 'any' : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitValue}
            placeholder={label.valueType === 'number' ? 'Enter number...' : 'Enter value...'}
            className={cn(
              'w-full h-7 px-2 text-[13px]',
              'bg-transparent',
              'text-foreground placeholder:text-foreground/30',
              'outline-none',
            )}
          />
        </div>
      )}

      <div className="p-1">
        <button
          ref={removeButtonRef}
          type="button"
          onClick={() => {
            onRemove?.()
            onOpenChange(false)
          }}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px]',
            'text-[13px] text-destructive',
            'hover:bg-foreground/[0.03] focus:bg-foreground/[0.03]',
            'transition-colors cursor-pointer outline-none',
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('common.remove')}</span>
        </button>
      </div>
    </PopoverContent>
  )
}
