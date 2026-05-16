import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SessionInlineTitle } from '../SessionInlineTitle'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

afterEach(() => {
  cleanup()
})

describe('SessionInlineTitle', () => {
  it('commits a trimmed changed title on Enter through the direct rename callback', () => {
    const onRename = vi.fn()
    render(<SessionInlineTitle title="Old title" onRename={onRename} />)

    fireEvent.doubleClick(screen.getByText('Old title'))
    const input = screen.getByLabelText('session.renameSession')
    fireEvent.change(input, { target: { value: '  New title  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRename).toHaveBeenCalledWith('New title')
  })

  it('does not commit unchanged or empty titles', () => {
    const onRename = vi.fn()
    render(<SessionInlineTitle title="Old title" onRename={onRename} />)

    fireEvent.doubleClick(screen.getByText('Old title'))
    const input = screen.getByLabelText('session.renameSession')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRename).not.toHaveBeenCalled()
  })

  it('cancels inline rename on Escape', () => {
    const onRename = vi.fn()
    render(<SessionInlineTitle title="Old title" onRename={onRename} />)

    fireEvent.doubleClick(screen.getByText('Old title'))
    const input = screen.getByLabelText('session.renameSession')
    fireEvent.change(input, { target: { value: 'New title' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText('Old title')).toBeTruthy()
  })
})
