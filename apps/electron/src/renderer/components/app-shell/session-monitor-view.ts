import type { SessionMeta } from '@/atoms/sessions'
import type { SessionStatus } from '@/config/session-status-config'
import { getSessionStatus } from '@/utils/session'

export type SessionMonitorViewMode = 'list' | 'kanban'

export interface SessionMonitorRow {
  item: SessionMeta
}

export interface SessionMonitorKanbanGroup<T extends SessionMonitorRow = SessionMonitorRow> {
  key: string
  statusId: string
  label: string
  items: T[]
  status?: SessionStatus
}

export function normalizeSessionMonitorViewMode(value: unknown): SessionMonitorViewMode {
  return value === 'kanban' ? 'kanban' : 'list'
}

export function buildSessionMonitorKanbanGroups<T extends SessionMonitorRow>(
  rows: readonly T[],
  statuses: readonly SessionStatus[],
  translateStatus?: (statusId: string, fallback: string) => string,
): SessionMonitorKanbanGroup<T>[] {
  const groups: SessionMonitorKanbanGroup<T>[] = []
  const groupsByStatus = new Map<string, SessionMonitorKanbanGroup<T>>()

  for (const status of statuses) {
    const group: SessionMonitorKanbanGroup<T> = {
      key: `status-${status.id}`,
      statusId: status.id,
      label: translateStatus?.(status.id, status.label) ?? status.label,
      items: [],
      status,
    }
    groups.push(group)
    groupsByStatus.set(status.id, group)
  }

  for (const row of rows) {
    const statusId = getSessionStatus(row.item)
    let group = groupsByStatus.get(statusId)

    if (!group) {
      group = {
        key: `status-${statusId}`,
        statusId,
        label: statusId,
        items: [],
      }
      groups.push(group)
      groupsByStatus.set(statusId, group)
    }

    group.items.push(row)
  }

  return groups
}
