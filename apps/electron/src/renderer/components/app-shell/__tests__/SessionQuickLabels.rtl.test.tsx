import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SessionQuickLabels, toggleSessionLabelEntries } from '../SessionQuickLabels'
import type { LabelConfig } from '@rox-one/shared/labels'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/components/ui/label-icon', () => ({
  LabelIcon: ({ label }: { label: LabelConfig }) => <span>{label.name}</span>,
}))

vi.mock('@/components/ui/styled-dropdown', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyledDropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyledDropdownMenuItem: ({
    children,
    onSelect,
    onClick,
  }: {
    children: React.ReactNode
    onSelect?: (event: { preventDefault: () => void }) => void
    onClick?: () => void
  }) => (
    <button
      type="button"
      onClick={() => {
        onSelect?.({ preventDefault: vi.fn() })
        onClick?.()
      }}
    >
      {children}
    </button>
  ),
  StyledDropdownMenuSeparator: () => <hr />,
  StyledDropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  StyledDropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

afterEach(() => {
  cleanup()
})

const labels: LabelConfig[] = [
  { id: 'bug', name: 'Bug' },
  { id: 'priority', name: 'Priority' },
]

describe('toggleSessionLabelEntries', () => {
  it('adds a missing label and removes existing valued entries by base label id', () => {
    expect(toggleSessionLabelEntries(['bug::high'], 'priority')).toEqual(['bug::high', 'priority'])
    expect(toggleSessionLabelEntries(['bug::high', 'priority'], 'bug')).toEqual(['priority'])
  })
})

describe('SessionQuickLabels', () => {
  it('toggles labels through the direct labels callback', () => {
    const onLabelsChange = vi.fn()
    render(
      <SessionQuickLabels
        labels={labels}
        sessionLabels={[]}
        onLabelsChange={onLabelsChange}
      />
    )

    fireEvent.click(screen.getByLabelText('sessionMenu.labels'))
    fireEvent.click(screen.getAllByText('Bug')[1])

    expect(onLabelsChange).toHaveBeenCalledWith(['bug'])
  })
})
