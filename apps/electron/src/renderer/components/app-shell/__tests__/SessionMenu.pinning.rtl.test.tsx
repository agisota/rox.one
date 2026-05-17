import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { SessionMenu } from '../SessionMenu'
import type { SessionMeta } from '@/atoms/sessions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/components/messaging/MessagingSessionMenuItem', () => ({
  MessagingSessionMenuItem: () => null,
}))

vi.mock('@/components/ui/menu-context', () => ({
  useMenuComponents: () => ({
    MenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>{children}</button>
    ),
    Separator: () => <hr />,
    Sub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SubTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    SubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
}))

vi.mock('@/lib/navigate', () => ({
  navigate: vi.fn(),
  routes: {
    view: {
      allSessions: (sessionId?: string) => `/sessions/${sessionId ?? ''}`,
    },
  },
}))

vi.mock('./session-share-flow', () => ({
  createShareFlowController: () => ({ share: vi.fn() }),
}))

function makeItem(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: 'session-1',
    workspaceId: 'workspace-1',
    lastMessageAt: 100,
    ...overrides,
  }
}

function renderMenu(item: SessionMeta, callbacks?: { onPin?: () => void; onUnpin?: () => void }) {
  return render(
    <SessionMenu
      item={item}
      sessionStatuses={[]}
      labels={[]}
      onRename={vi.fn()}
      onFlag={vi.fn()}
      onUnflag={vi.fn()}
      onPin={callbacks?.onPin}
      onUnpin={callbacks?.onUnpin}
      onArchive={vi.fn()}
      onUnarchive={vi.fn()}
      onMarkUnread={vi.fn()}
      onSessionStatusChange={vi.fn()}
      onOpenInNewWindow={vi.fn()}
      onDelete={vi.fn()}
    />
  )
}

describe('SessionMenu pinning', () => {
  it('shows Pin for unpinned sessions and calls the direct pin callback', () => {
    const onPin = vi.fn()
    renderMenu(makeItem(), { onPin, onUnpin: vi.fn() })

    fireEvent.click(screen.getByText('sessionMenu.pin'))

    expect(onPin).toHaveBeenCalledTimes(1)
  })

  it('shows Unpin for pinned sessions and calls the direct unpin callback', () => {
    const onUnpin = vi.fn()
    renderMenu(makeItem({ pinnedAt: 200 }), { onPin: vi.fn(), onUnpin })

    fireEvent.click(screen.getByText('sessionMenu.unpin'))

    expect(onUnpin).toHaveBeenCalledTimes(1)
  })
})
