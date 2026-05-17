import { Kanban, List } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { SessionMonitorViewMode } from './session-monitor-view'

interface SessionMonitorToolbarProps {
  viewMode: SessionMonitorViewMode
  totalCount: number
  onViewModeChange: (mode: SessionMonitorViewMode) => void
}

export function SessionMonitorToolbar({
  viewMode,
  totalCount,
  onViewModeChange,
}: SessionMonitorToolbarProps) {
  const { t } = useTranslation()

  const options: Array<{ mode: SessionMonitorViewMode; label: string; icon: typeof List }> = [
    { mode: 'list', label: t('session.listView'), icon: List },
    { mode: 'kanban', label: t('session.kanbanView'), icon: Kanban },
  ]

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-2 py-1.5">
      <span className="min-w-0 truncate px-1 text-[11px] text-muted-foreground">
        {t('session.monitorCount', { count: totalCount })}
      </span>
      <div
        className="inline-flex h-7 items-center rounded-[8px] border border-border/60 bg-muted/40 p-0.5"
        role="group"
        aria-label={t('session.monitorViewMode')}
      >
        {options.map(({ mode, label, icon: Icon }) => {
          const active = viewMode === mode
          return (
            <button
              key={mode}
              type="button"
              aria-label={label}
              aria-pressed={active}
              title={label}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                'inline-flex h-6 w-7 items-center justify-center rounded-[6px] text-muted-foreground transition-colors',
                active && 'bg-background text-foreground shadow-minimal',
                !active && 'hover:bg-foreground/[0.04] hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
