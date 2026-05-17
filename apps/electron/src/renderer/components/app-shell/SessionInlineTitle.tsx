import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export interface SessionInlineTitleProps {
  title: string
  displayTitle?: React.ReactNode
  onRename: (name: string) => void
}

export function SessionInlineTitle({
  title,
  displayTitle,
  onRename,
}: SessionInlineTitleProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(title)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const finishedRef = React.useRef(false)

  React.useEffect(() => {
    if (!isEditing) setDraft(title)
  }, [isEditing, title])

  React.useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const startEditing = React.useCallback((event?: React.SyntheticEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    finishedRef.current = false
    setDraft(title)
    setIsEditing(true)
  }, [title])

  const finishEditing = React.useCallback((commit: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true

    const trimmed = draft.trim()
    if (commit && trimmed && trimmed !== title.trim()) {
      onRename(trimmed)
    }

    setIsEditing(false)
  }, [draft, onRename, title])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        aria-label={t('session.renameSession')}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onBlur={() => finishEditing(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            finishEditing(true)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            finishEditing(false)
          }
        }}
        className={cn(
          'h-6 w-full min-w-0 rounded-[6px] border border-border/60 bg-background px-1.5',
          'text-[13px] font-medium text-foreground shadow-minimal outline-none',
          'focus:border-accent/60 focus:ring-1 focus:ring-accent/30'
        )}
      />
    )
  }

  return (
    <span
      className="block min-w-0 truncate"
      title={title}
      onDoubleClick={startEditing}
    >
      {displayTitle ?? title}
    </span>
  )
}
