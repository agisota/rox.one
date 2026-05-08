import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { WORKBENCH_SCREENS } from '../../../../shared/types'
import { WorkbenchRoutePage } from '../WorkbenchRoutePage'
import { DEMO_EXPERIENCE_SESSIONS, getDemoSessionsForScreen } from '../demo-experience-sessions'

describe('WorkbenchRoutePage', () => {
  test.each([
    ['deep-missions', 'Долгие миссии'],
    ['arena-builder', 'Арена агентов'],
    ['mission-control', 'Центр миссий'],
    ['progression', 'Обсерватория прогресса'],
    ['quest-map', 'Карта квестов'],
    ['agent-forge', 'Кузница агентов'],
  ] as const)('renders %s as a first-class screen', (screen, expectedTitle) => {
    const markup = renderToStaticMarkup(<WorkbenchRoutePage screen={screen} />)

    expect(markup).toContain(expectedTitle)
    expect(markup).toContain('Слой опыта')
    expect(markup).toContain('5 sanitized сценариев')
    expect(markup).toContain('sessions → truth → tab → skills')
  })

  test('ships five sanitized demo sessions per Experience tab', () => {
    expect(DEMO_EXPERIENCE_SESSIONS).toHaveLength(30)

    for (const screen of WORKBENCH_SCREENS) {
      const sessions = getDemoSessionsForScreen(screen)
      expect(sessions).toHaveLength(5)
      expect(new Set(sessions.map((session) => session.id)).size).toBe(5)
      for (const session of sessions) {
        expect(session.screen).toBe(screen)
        expect(session.truthState.mission.title).toBe(session.title)
        expect(session.truthState.agentPackages.length).toBeGreaterThan(0)
        expect(session.truthState.installedAgentPackageIds.length).toBeGreaterThan(0)
      }
    }
  })
})
