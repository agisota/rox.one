import { describe, expect, test } from 'bun:test'

import { getDemoSessionsForScreen } from '../demo-experience-sessions'
import { buildExperienceSessionGroups } from '../experience-demo-session-groups'

describe('ExperienceDemoSessionList grouping', () => {
  test('groups demo sessions like the main session navigator and promotes acted sessions', () => {
    const sessions = getDemoSessionsForScreen('agent-forge')
    const promotedSession = sessions[2]
    const now = new Date()
    const groups = buildExperienceSessionGroups(
      sessions,
      {
        [promotedSession.id]: {
          actionResult: 'демо запущено',
          eventCount: 1,
          lastActionId: 'run',
          lastMessageAt: now.toISOString(),
          revision: 1,
        },
      },
      'ru',
      'Сегодня',
      'Вчера',
    )

    expect(groups[0].label).toBe('Сегодня')
    expect(groups[0].items[0].id).toBe(promotedSession.id)
    expect(groups.flatMap((group) => group.items)).toHaveLength(5)
  })
})
