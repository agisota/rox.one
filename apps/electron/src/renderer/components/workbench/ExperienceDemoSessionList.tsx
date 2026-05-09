import * as React from 'react'
import { format } from 'date-fns'
import { Activity, CheckCircle2, Circle } from 'lucide-react'
import { useAtom, useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'

import type { WorkbenchScreen } from '../../../shared/types'

import { EntityList } from '../ui/entity-list'
import { EntityRow } from '../ui/entity-row'
import { ExperienceStatusChip } from './experience-ui'
import {
  getDemoSessionsForScreen,
  type DemoExperienceAction,
  type DemoExperienceSession,
} from './demo-experience-sessions'
import { buildExperienceSessionGroups } from './experience-demo-session-groups'
import {
  experienceDemoRuntimeBySessionIdAtom,
  experienceDemoSelectedSessionByScreenAtom,
} from './experience-demo-session-store'

export function ExperienceDemoSessionList({ screen }: { screen: WorkbenchScreen }) {
  const { i18n, t } = useTranslation()
  const sessions = React.useMemo(() => getDemoSessionsForScreen(screen), [screen])
  const [selectedByScreen, setSelectedByScreen] = useAtom(experienceDemoSelectedSessionByScreenAtom)
  const runtimeBySessionId = useAtomValue(experienceDemoRuntimeBySessionIdAtom)
  const activeSessionId = selectedByScreen[screen] ?? sessions[0]?.id

  const groups = React.useMemo(() => buildExperienceSessionGroups(
    sessions,
    runtimeBySessionId,
    i18n.language,
    t('common.today'),
    t('common.yesterday'),
  ), [i18n.language, runtimeBySessionId, sessions, t])

  const selectDemoSession = React.useCallback((sessionId: string) => {
    setSelectedByScreen((prev) => ({ ...prev, [screen]: sessionId }))
  }, [screen, setSelectedByScreen])

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#05070b]" aria-label="Список демо-сессий опыта">
      <div className="border-b border-white/[0.08] px-4 py-3">
        <div className="text-sm font-semibold">Все сессии</div>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Демо-сессии этой вкладки в том же формате, что основной список: дата, статус, превью и метрики.
        </div>
      </div>
      <EntityList
        groups={groups}
        getKey={(session) => session.id}
        scrollAreaClassName="min-h-0"
        renderItem={(session, _index, isFirstInGroup) => {
          const runtime = runtimeBySessionId[session.id]
          const active = session.id === activeSessionId
          const metricSnapshot = session.truthState.metricSnapshots[0]
          const status = runtime?.lastActionId ? localizeDemoAction(runtime.lastActionId) : localizeMissionStatus(session.truthState.mission.status)
          return (
            <EntityRow
              icon={runtime?.eventCount ? <Activity /> : active ? <CheckCircle2 /> : <Circle />}
              title={session.title}
              subtitle={runtime?.actionResult ?? session.description}
              showSeparator={!isFirstInGroup}
              isSelected={active}
              onClick={() => selectDemoSession(session.id)}
              titleTrailing={<span className="text-[11px] text-muted-foreground">{formatShortTime(runtime?.lastMessageAt ?? session.truthState.mission.createdAt)}</span>}
              badges={(
                <>
                  <ExperienceStatusChip status={runtime?.eventCount ? 'running' : 'queued'} label={status} />
                  <ExperienceStatusChip status="success" label={`VDI ${metricSnapshot?.verifiedDeliverableIndex ?? 0}`} />
                  <ExperienceStatusChip status={(metricSnapshot?.openRiskScore ?? 0) > 16 ? 'warning' : 'success'} label={`Risk ${metricSnapshot?.openRiskScore ?? 0}`} />
                  {runtime?.eventCount ? <ExperienceStatusChip status="ready" label={`${runtime.eventCount} событий`} /> : null}
                </>
              )}
            />
          )
        }}
      />
    </section>
  )
}

function formatShortTime(value: string): string {
  return format(new Date(value), 'HH:mm')
}

function localizeMissionStatus(status: string): string {
  switch (status) {
    case 'draft':
      return 'черновик'
    case 'queued':
      return 'в очереди'
    case 'running':
      return 'в работе'
    case 'waiting_for_approval':
      return 'ждет согласования'
    case 'paused':
      return 'пауза'
    case 'completed':
      return 'завершено'
    case 'failed':
      return 'ошибка'
    case 'cancelled':
      return 'отменено'
    default:
      return status
  }
}

function localizeDemoAction(actionId: DemoExperienceAction['id']): string {
  switch (actionId) {
    case 'configure':
      return 'настроено'
    case 'run':
      return 'демо запущено'
    case 'expectations':
      return 'ожидания открыты'
    case 'evidence':
      return 'evidence записан'
    case 'reset':
      return 'сброшено'
    default:
      return actionId
  }
}
