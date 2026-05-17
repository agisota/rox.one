import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import type { SessionMeta } from '@/atoms/sessions'
import type { SessionStatus } from '@/config/session-status-config'
import { SessionMonitorToolbar } from '../SessionMonitorToolbar'
import {
  buildSessionMonitorKanbanGroups,
  normalizeSessionMonitorViewMode,
} from '../session-monitor-view'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> | string) => {
      if (key === 'session.monitorCount' && typeof options === 'object') {
        return `${options.count} sessions`
      }
      if (typeof options === 'string') return options
      return key
    },
  }),
}))

afterEach(() => {
  cleanup()
})

const statuses: SessionStatus[] = [
  { id: 'todo', label: 'Todo', resolvedColor: 'var(--info)', icon: null, iconColorable: true },
  { id: 'active', label: 'Active', resolvedColor: 'var(--success)', icon: null, iconColorable: true },
  { id: 'blocked', label: 'Blocked', resolvedColor: 'var(--destructive)', icon: null, iconColorable: true },
]

function makeSession(id: string, sessionStatus?: string): SessionMeta {
  return {
    id,
    workspaceId: 'workspace-1',
    lastMessageAt: 100,
    ...(sessionStatus ? { sessionStatus } : {}),
  }
}

describe('session monitor view helpers', () => {
  it('normalizes stored monitor view values', () => {
    expect(normalizeSessionMonitorViewMode('kanban')).toBe('kanban')
    expect(normalizeSessionMonitorViewMode('list')).toBe('list')
    expect(normalizeSessionMonitorViewMode('unexpected')).toBe('list')
    expect(normalizeSessionMonitorViewMode(null)).toBe('list')
  })

  it('builds Kanban columns from configured statuses before custom statuses', () => {
    const groups = buildSessionMonitorKanbanGroups(
      [
        { item: makeSession('s-active', 'active') },
        { item: makeSession('s-custom', 'waiting-for-human') },
        { item: makeSession('s-todo') },
      ],
      statuses,
      (statusId, fallback) => `status:${statusId}:${fallback}`,
    )

    expect(groups.map((group) => group.key)).toEqual([
      'status-todo',
      'status-active',
      'status-blocked',
      'status-waiting-for-human',
    ])
    expect(groups.map((group) => group.label)).toEqual([
      'status:todo:Todo',
      'status:active:Active',
      'status:blocked:Blocked',
      'waiting-for-human',
    ])
    expect(groups.map((group) => group.items.map((row) => row.item.id))).toEqual([
      ['s-todo'],
      ['s-active'],
      [],
      ['s-custom'],
    ])
  })
})

describe('SessionMonitorToolbar', () => {
  it('exposes List and Kanban mode buttons', () => {
    const onViewModeChange = vi.fn()

    render(
      <SessionMonitorToolbar
        viewMode="list"
        totalCount={3}
        onViewModeChange={onViewModeChange}
      />,
    )

    expect(screen.getByText('3 sessions')).toBeTruthy()
    expect(screen.getByLabelText('session.listView').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('session.kanbanView').getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByLabelText('session.kanbanView'))

    expect(onViewModeChange).toHaveBeenCalledWith('kanban')
  })
})
