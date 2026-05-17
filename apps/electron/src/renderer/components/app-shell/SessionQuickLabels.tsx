import * as React from 'react'
import { Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuSub,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
  StyledDropdownMenuSubContent,
  StyledDropdownMenuSubTrigger,
} from '@/components/ui/styled-dropdown'
import { cn } from '@/lib/utils'
import { extractLabelId, type LabelConfig } from '@rox-one/shared/labels'
import { LabelMenuItems } from './SessionMenuParts'

export function toggleSessionLabelEntries(sessionLabels: readonly string[], labelId: string): string[] {
  const hasLabel = sessionLabels.some(entry => extractLabelId(entry) === labelId)
  if (hasLabel) {
    return sessionLabels.filter(entry => extractLabelId(entry) !== labelId)
  }
  return [...sessionLabels, labelId]
}

export interface SessionQuickLabelsProps {
  labels: LabelConfig[]
  sessionLabels?: string[]
  onLabelsChange: (labels: string[]) => void
  className?: string
}

export function SessionQuickLabels({
  labels,
  sessionLabels = [],
  onLabelsChange,
  className,
}: SessionQuickLabelsProps) {
  const { t } = useTranslation()
  const appliedLabelIds = React.useMemo(
    () => new Set(sessionLabels.map(extractLabelId)),
    [sessionLabels]
  )

  const handleToggle = React.useCallback((labelId: string) => {
    onLabelsChange(toggleSessionLabelEntries(sessionLabels, labelId))
  }, [onLabelsChange, sessionLabels])

  if (labels.length === 0) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={t('sessionMenu.labels')}
          title={t('sessionMenu.labels')}
          className={cn(
            'inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-[6px] px-1',
            'text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40',
            className
          )}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Tag className="h-3.5 w-3.5" />
          {sessionLabels.length > 0 && (
            <span className="text-[10px] tabular-nums leading-none text-foreground/60">
              {sessionLabels.length}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <StyledDropdownMenuContent
        align="end"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <LabelMenuItems
          labels={labels}
          appliedLabelIds={appliedLabelIds}
          onToggle={handleToggle}
          menu={{
            MenuItem: StyledDropdownMenuItem,
            Separator: StyledDropdownMenuSeparator,
            Sub: DropdownMenuSub,
            SubTrigger: StyledDropdownMenuSubTrigger,
            SubContent: StyledDropdownMenuSubContent,
          }}
        />
      </StyledDropdownMenuContent>
    </DropdownMenu>
  )
}
