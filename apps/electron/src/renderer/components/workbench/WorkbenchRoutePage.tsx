import * as React from 'react'

import type { WorkbenchScreen } from '../../../shared/types'

import { AgentForgeTeamRegistry } from './AgentForgeTeamRegistry'
import { ArenaBuilderScreen } from './ArenaBuilderScreen'
import { DeepMissionsScreen } from './DeepMissionsScreen'
import { MissionControlRunDetail } from './MissionControlRunDetail'
import { ProgressionObservatory } from './ProgressionObservatory'
import { QuestMapSkillTree } from './QuestMapSkillTree'

export interface WorkbenchRoutePageProps {
  screen: WorkbenchScreen
}

export function WorkbenchRoutePage({ screen }: WorkbenchRoutePageProps) {
  return (
    <div className="h-full min-h-0" data-workbench-screen={screen}>
      <span className="sr-only">Experience Layer</span>
      {renderWorkbenchScreen(screen)}
    </div>
  )
}

function renderWorkbenchScreen(screen: WorkbenchScreen): React.ReactNode {
  switch (screen) {
    case 'arena-builder':
      return <ArenaBuilderScreen />
    case 'mission-control':
      return <MissionControlRunDetail />
    case 'progression':
      return <ProgressionObservatory />
    case 'quest-map':
      return <QuestMapSkillTree layer="game" />
    case 'agent-forge':
      return <AgentForgeTeamRegistry />
    case 'deep-missions':
    default:
      return <DeepMissionsScreen />
  }
}
