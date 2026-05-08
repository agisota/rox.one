import * as React from 'react'

import type { WorkbenchScreen } from '../../../shared/types'

import { AgentForgeTeamRegistry } from './AgentForgeTeamRegistry'
import { ArenaBuilderScreen } from './ArenaBuilderScreen'
import { DeepMissionsScreen } from './DeepMissionsScreen'
import { MissionControlRunDetail } from './MissionControlRunDetail'
import { ProgressionObservatory } from './ProgressionObservatory'
import { QuestMapSkillTree } from './QuestMapSkillTree'
import {
  EXPERIENCE_SCREEN_LABELS,
  EXPERIENCE_SCREEN_PRODUCT_ROLES,
  getDemoSessionsForScreen,
  type DemoExperienceSession,
} from './demo-experience-sessions'

export interface WorkbenchRoutePageProps {
  screen: WorkbenchScreen
}

export function WorkbenchRoutePage({ screen }: WorkbenchRoutePageProps) {
  const screenSessions = React.useMemo(() => getDemoSessionsForScreen(screen), [screen])
  const [activeDemoSessionByScreen, setActiveDemoSessionByScreen] = React.useState<Partial<Record<WorkbenchScreen, string>>>({})
  const activeDemoSessionId = activeDemoSessionByScreen[screen] ?? screenSessions[0]?.id
  const activeDemoSession = screenSessions.find((session) => session.id === activeDemoSessionId) ?? screenSessions[0]

  const selectDemoSession = React.useCallback((sessionId: string) => {
    setActiveDemoSessionByScreen((prev) => ({ ...prev, [screen]: sessionId }))
  }, [screen])

  return (
    <div className="h-full min-h-0" data-workbench-screen={screen}>
      <span className="sr-only">Слой опыта</span>
      <div className="border-b border-white/[0.08] bg-black/20 px-6 py-3">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Demo sessions · {EXPERIENCE_SCREEN_LABELS[screen]}
            </div>
            <div className="max-w-3xl text-sm text-muted-foreground">
              {EXPERIENCE_SCREEN_PRODUCT_ROLES[screen]}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <div>{screenSessions.length} sanitized сценариев</div>
            <div>sessions → truth → tab → skills</div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {screenSessions.map((session) => {
            const active = session.id === activeDemoSession?.id
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => selectDemoSession(session.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:text-foreground'
                }`}
                title={session.description}
              >
                {session.label}
              </button>
            )
          })}
        </div>
      </div>
      {activeDemoSession ? renderWorkbenchScreen(screen, activeDemoSession) : null}
    </div>
  )
}

function renderWorkbenchScreen(screen: WorkbenchScreen, demoSession: DemoExperienceSession): React.ReactNode {
  const key = `${screen}:${demoSession.id}`
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
