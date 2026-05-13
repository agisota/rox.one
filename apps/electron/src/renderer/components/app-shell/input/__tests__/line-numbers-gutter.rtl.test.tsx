/**
 * RTL coverage for LineNumbersGutter.tsx (M.10 T236).
 *
 * Cases covered:
 *   - Hidden when `visible={false}` (renders nothing in compact mode)
 *   - Visible when `visible={true}` with one row for a single-line value
 *   - Visible with five rows for a 4-newline value (incl. trailing newline)
 *   - Toggling visibility re-renders correctly
 *   - Re-typing increments the row count without stale DOM nodes
 *   - aria-hidden so screen readers don't double-read line numbers
 */
import * as React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { LineNumbersGutter } from '../LineNumbersGutter'

afterEach(() => {
  cleanup()
})

describe('LineNumbersGutter', () => {
  it('renders nothing when visible={false}', () => {
    const { container } = render(
      <LineNumbersGutter value="hello\nworld" visible={false} />,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('composer-line-numbers-gutter')).toBeNull()
  })

  it('renders a single row for an empty value when visible', () => {
    render(<LineNumbersGutter value="" visible={true} />)
    const gutter = screen.getByTestId('composer-line-numbers-gutter')
    expect(gutter.getAttribute('data-line-count')).toBe('1')
    // One <span> child for the lone row "1".
    expect(gutter.querySelectorAll('[data-line-number]').length).toBe(1)
    expect(gutter.textContent).toBe('1')
  })

  it('renders one row per visual line in a multi-line value', () => {
    const value = 'alpha\nbeta\ngamma\ndelta'
    render(<LineNumbersGutter value={value} visible={true} />)
    const gutter = screen.getByTestId('composer-line-numbers-gutter')
    expect(gutter.getAttribute('data-line-count')).toBe('4')
    const rows = gutter.querySelectorAll('[data-line-number]')
    expect(rows.length).toBe(4)
    expect(rows[0]?.textContent).toBe('1')
    expect(rows[3]?.textContent).toBe('4')
  })

  it('counts a trailing newline as an extra row', () => {
    render(<LineNumbersGutter value={'foo\nbar\n'} visible={true} />)
    const gutter = screen.getByTestId('composer-line-numbers-gutter')
    expect(gutter.getAttribute('data-line-count')).toBe('3')
    expect(gutter.querySelectorAll('[data-line-number]').length).toBe(3)
  })

  it('toggles between hidden and visible across re-renders', () => {
    const { rerender } = render(
      <LineNumbersGutter value="one\ntwo" visible={false} />,
    )
    expect(screen.queryByTestId('composer-line-numbers-gutter')).toBeNull()

    rerender(<LineNumbersGutter value="one\ntwo" visible={true} />)
    expect(screen.getByTestId('composer-line-numbers-gutter')).not.toBeNull()

    rerender(<LineNumbersGutter value="one\ntwo" visible={false} />)
    expect(screen.queryByTestId('composer-line-numbers-gutter')).toBeNull()
  })

  it('updates the row count when the value grows', () => {
    const { rerender } = render(
      <LineNumbersGutter value="one" visible={true} />,
    )
    expect(
      screen.getByTestId('composer-line-numbers-gutter').getAttribute('data-line-count'),
    ).toBe('1')

    rerender(<LineNumbersGutter value={'one\ntwo\nthree'} visible={true} />)
    const gutter = screen.getByTestId('composer-line-numbers-gutter')
    expect(gutter.getAttribute('data-line-count')).toBe('3')
    expect(gutter.querySelectorAll('[data-line-number]').length).toBe(3)
  })

  it('is aria-hidden so screen readers do not re-read line numbers', () => {
    render(<LineNumbersGutter value={'a\nb'} visible={true} />)
    const gutter = screen.getByTestId('composer-line-numbers-gutter')
    expect(gutter.getAttribute('aria-hidden')).toBe('true')
  })
})
