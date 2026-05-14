/**
 * RTL a11y + error-boundary smoke tests for RouteErrorBoundary. [T-routeeb-a11y]
 *
 * Cases covered:
 *   - error boundary: RouteErrorBoundary catches a render crash and shows the
 *     graceful fallback (role="alert") instead of propagating to the root
 *   - fallback contains a Reload button
 *   - a11y: no axe violations on the fallback state
 *
 * No Electron-specific APIs are exercised here. The component only uses
 * React.Component lifecycle methods and renders a static UI on error.
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '../../../test-utils/render'
import { expectNoA11yViolations } from '../../../test-utils/a11y'
import { RouteErrorBoundary } from '../RouteErrorBoundary'

// Suppress expected console.error output from componentDidCatch during tests.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

// A child component that throws on render so we can trigger the boundary.
function ThrowingChild(): React.ReactElement {
  throw new Error('test-crash')
}

describe('RouteErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    const { getByText } = render(
      <RouteErrorBoundary name="test-route">
        <p>Normal content</p>
      </RouteErrorBoundary>,
    )
    expect(getByText('Normal content')).toBeTruthy()
  })

  it('renders the fallback with role="alert" when a child throws', () => {
    render(
      <RouteErrorBoundary name="account-settings">
        <ThrowingChild />
      </RouteErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('renders a Reload button in the fallback', () => {
    render(
      <RouteErrorBoundary name="account-settings">
        <ThrowingChild />
      </RouteErrorBoundary>,
    )
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('passes axe a11y checks on the fallback state', async () => {
    const { container } = render(
      <RouteErrorBoundary name="appearance">
        <ThrowingChild />
      </RouteErrorBoundary>,
    )
    await expectNoA11yViolations(container)
  })
})
