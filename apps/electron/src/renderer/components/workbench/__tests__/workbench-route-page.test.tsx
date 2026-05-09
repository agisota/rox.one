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
    expect(markup).toContain('5 демо-сценариев в средней панели')
    expect(markup).toContain('Сегодня · truth → вкладка → журнал')
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

  test('ships visible demo guidance and action metadata for every Experience tab', () => {
    for (const screen of WORKBENCH_SCREENS) {
      const sessions = getDemoSessionsForScreen(screen)
      for (const session of sessions) {
        expect(session.sourceSessionLabel.length).toBeGreaterThan(8)
        expect(session.usageSteps.length).toBeGreaterThanOrEqual(3)
        expect(session.setupSteps.length).toBeGreaterThanOrEqual(3)
        expect(session.expectedOutcomes.length).toBeGreaterThanOrEqual(3)
        expect(session.mcpPresetIds.length).toBeGreaterThanOrEqual(2)
        expect(session.demoActions.map((action) => action.label)).toEqual([
          'Настроить',
          'Запустить демо',
          'Ожидания',
          'Evidence',
          'Сбросить',
        ])
      }
    }
  })

  test.each(WORKBENCH_SCREENS.map((screen) => [screen] as const))('renders actionable demo console on %s', (screen) => {
    const sessions = getDemoSessionsForScreen(screen)
    const markup = renderToStaticMarkup(<WorkbenchRoutePage screen={screen} />)

    expect(markup).toContain('Демо-контур')
    expect(markup).toContain('Как пользоваться')
    expect(markup).toContain('Как настраивать')
    expect(markup).toContain('Что ожидать')
    expect(markup).toContain('MCP presets')
    expect(markup).toContain('Настроить')
    expect(markup).toContain('Запустить демо')
    expect(markup).toContain('Evidence')
    expect(markup).toContain(sessions[0].sourceSessionLabel)
    expect(markup).toContain('Откройте демо')
    expect(markup).toContain('Agent package:')
    expect(markup).toContain('Понятно, какие действия доступны')
  })
})
