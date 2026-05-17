export interface SessionListSortFields {
  id?: string
  pinnedAt?: number
  lastMessageAt?: number
  createdAt?: number
}

function recencyValue(session: SessionListSortFields): number {
  return session.lastMessageAt ?? session.createdAt ?? 0
}

export function compareSessionsForList<T extends SessionListSortFields>(a: T, b: T): number {
  const aPinned = typeof a.pinnedAt === 'number' && a.pinnedAt > 0
  const bPinned = typeof b.pinnedAt === 'number' && b.pinnedAt > 0

  if (aPinned !== bPinned) return aPinned ? -1 : 1

  if (aPinned && bPinned) {
    const pinDelta = (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
    if (pinDelta !== 0) return pinDelta
  }

  const recencyDelta = recencyValue(b) - recencyValue(a)
  if (recencyDelta !== 0) return recencyDelta

  return (a.id ?? '').localeCompare(b.id ?? '')
}

export function sortSessionsForList<T extends SessionListSortFields>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareSessionsForList)
}
