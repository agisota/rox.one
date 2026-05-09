import { format, isToday, isYesterday, startOfDay } from 'date-fns'

import { getDateLocale } from '@craft-agent/shared/i18n'

import type { EntityListGroup } from '../ui/entity-list'
import type { DemoExperienceSession } from './demo-experience-sessions'
import type { DemoSessionRuntime } from './experience-demo-session-store'

export function buildExperienceSessionGroups(
  sessions: DemoExperienceSession[],
  runtimeBySessionId: Record<string, DemoSessionRuntime>,
  language: string,
  todayLabel: string,
  yesterdayLabel: string,
): EntityListGroup<DemoExperienceSession>[] {
  const sorted = [...sessions].sort((left, right) =>
    getSessionSortTime(right, runtimeBySessionId).localeCompare(getSessionSortTime(left, runtimeBySessionId)),
  )
  const grouped = new Map<string, DemoExperienceSession[]>()

  for (const session of sorted) {
    const date = startOfDay(new Date(getSessionSortTime(session, runtimeBySessionId)))
    const key = date.toISOString()
    grouped.set(key, [...(grouped.get(key) ?? []), session])
  }

  return [...grouped.entries()].map(([key, items]) => {
    const date = new Date(key)
    return {
      key,
      label: formatDateGroupLabel(date, language, todayLabel, yesterdayLabel),
      items,
    }
  })
}

function getSessionSortTime(session: DemoExperienceSession, runtimeBySessionId: Record<string, DemoSessionRuntime>): string {
  return runtimeBySessionId[session.id]?.lastMessageAt ?? session.truthState.mission.createdAt
}

function formatDateGroupLabel(date: Date, language: string, todayLabel: string, yesterdayLabel: string): string {
  if (isToday(date)) return todayLabel || 'Сегодня'
  if (isYesterday(date)) return yesterdayLabel || 'Вчера'
  return format(date, 'MMM d', { locale: getDateLocale(language) })
}

