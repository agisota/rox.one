import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'

import type { WorkbenchScreen } from '../../../shared/types'

import { AgentForgeTeamRegistry } from './AgentForgeTeamRegistry'
import { ArenaBuilderScreen } from './ArenaBuilderScreen'
import { DeepMissionsScreen } from './DeepMissionsScreen'
import { ExperienceDemoConsole } from './ExperienceDemoConsole'
import { MissionControlRunDetail } from './MissionControlRunDetail'
import { ProgressionObservatory } from './ProgressionObservatory'
import { QuestMapSkillTree } from './QuestMapSkillTree'
import {
  EXPERIENCE_SCREEN_LABELS,
  EXPERIENCE_SCREEN_PRODUCT_ROLES,
  getDemoSessionsForScreen,
  type DemoExperienceAction,
  type DemoExperienceSession,
} from './demo-experience-sessions'
import {
  experienceDemoRuntimeBySessionIdAtom,
  experienceDemoSelectedSessionByScreenAtom,
} from './experience-demo-session-store'

export interface WorkbenchRoutePageProps {
  screen: WorkbenchScreen
}

export function WorkbenchRoutePage({ screen }: WorkbenchRoutePageProps) {
  const screenSessions = React.useMemo(() => getDemoSessionsForScreen(screen), [screen])
  const selectedByScreen = useAtomValue(experienceDemoSelectedSessionByScreenAtom)
  const [runtimeBySessionId, setRuntimeBySessionId] = useAtom(experienceDemoRuntimeBySessionIdAtom)
  const activeDemoSessionId = selectedByScreen[screen] ?? screenSessions[0]?.id
  const activeDemoSession = screenSessions.find((session) => session.id === activeDemoSessionId) ?? screenSessions[0]
  const activeRuntime = activeDemoSession ? runtimeBySessionId[activeDemoSession.id] : undefined

  const runDemoAction = React.useCallback((action: DemoExperienceAction) => {
    if (!activeDemoSession) return

    setRuntimeBySessionId((current) => {
      if (action.id === 'reset') {
        const next = { ...current }
        delete next[activeDemoSession.id]
        return next
      }

      const previous = current[activeDemoSession.id]
      return {
        ...current,
        [activeDemoSession.id]: {
          actionResult: action.result,
          eventCount: (previous?.eventCount ?? 0) + 1,
          lastActionId: action.id,
          lastMessageAt: new Date().toISOString(),
          revision: (previous?.revision ?? 0) + 1,
        },
      }
    })
  }, [activeDemoSession, setRuntimeBySessionId])

  return (
    <div className="flex h-full min-h-0 flex-col" data-workbench-screen={screen}>
      <span className="sr-only">Слой опыта</span>
      <div className="border-b border-white/[0.08] bg-black/20 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Демо-сессия · {EXPERIENCE_SCREEN_LABELS[screen]}
            </div>
            <div className="max-w-3xl text-sm text-muted-foreground">
              {activeDemoSession ? activeDemoSession.title : EXPERIENCE_SCREEN_PRODUCT_ROLES[screen]}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <div>{screenSessions.length} демо-сценариев в средней панели</div>
            <div>Сегодня · truth → вкладка → журнал</div>
          </div>
        </div>
      </div>
      {activeDemoSession ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ExperienceDemoConsole
            screen={screen}
            activeSession={activeDemoSession}
            actionResult={activeRuntime?.actionResult}
            eventCount={activeRuntime?.eventCount ?? 0}
            lastActionId={activeRuntime?.lastActionId}
            onRunAction={runDemoAction}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            {renderWorkbenchScreen(screen, activeDemoSession, activeRuntime?.revision ?? 0)}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function renderWorkbenchScreen(screen: WorkbenchScreen, demoSession: DemoExperienceSession, revision: number): React.ReactNode {
  const key = `${screen}:${demoSession.id}:${revision}`
  const truthState = demoSession.truthState

  switch (screen) {
    case 'arena-builder':
      return <ArenaBuilderScreen key={key} truthState={truthState} />
    case 'mission-control':
      return <MissionControlRunDetail key={key} truthState={truthState} />
    case 'progression':
      return <ProgressionObservatory key={key} truthState={truthState} />
    case 'quest-map':
      return <QuestMapSkillTree key={key} truthState={truthState} layer="game" />
    case 'agent-forge':
      return <AgentForgeTeamRegistry key={key} truthState={truthState} />
    case 'deep-missions':
    default:
      return <DeepMissionsScreen key={key} truthState={truthState} />
  }
}
