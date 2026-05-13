/**
 * RTL a11y smoke tests for AccountSettingsPage. [P1-a11y-gap]
 *
 * Cases covered:
 *   - a11y: no axe violations on the unauthenticated (login panel) branch.
 *     This is the simplest renderable state — avoids the heavy authenticated
 *     branch that requires account/billing/sessions/teams IPC calls.
 *
 * Mocked deps:
 *   - window.electronAPI: accountRequest (the page's primary IPC method)
 *   - @/components/app-shell/PanelHeader: stubbed (avoids HeaderMenu portal issues)
 *   - @/components/ui/HeaderMenu: stubbed
 *   - @/components/ui/scroll-area: thin passthrough wrapper
 *   - AccountAuthPanel: rendered via real import (lightweight form, already tested)
 *
 * The page fetches account data on mount. We stub `accountRequest` to reject so
 * the page renders the auth panel (unauthenticated branch) immediately.
 *
 * A11y violations found: 0 (if any are found, mark with TODO and do NOT fix in
 * this PR — this is coverage-only, not a fix PR).
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { render } from '../../../../test-utils/render'
import { expectNoA11yViolations, runAxe } from '../../../../test-utils/a11y'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/components/app-shell/PanelHeader', () => ({
  PanelHeader: ({ title }: { title?: string }) => (
    <header>
      <h1>{title ?? 'Account'}</h1>
    </header>
  ),
}))

vi.mock('@/components/ui/HeaderMenu', () => ({
  HeaderMenu: () => null,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}))

// navigate lib: routes just returns strings
vi.mock('@/lib/navigate', () => ({
  routes: { view: { settings: (slug: string) => `settings/${slug}` } },
}))

// ── Imports under test ────────────────────────────────────────────────────────

import AccountSettingsPage from '../AccountSettingsPage'

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
  // Reject accountRequest so the page lands on the unauthenticated branch
  // (AccountAuthPanel login form) without any loading spinner.
  api.accountRequest = () => Promise.reject(new Error('not-authenticated'))
  api.openUrl = () => Promise.resolve()
})

afterEach(() => {
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AccountSettingsPage a11y [P1-a11y-gap]', () => {
  it('renders without axe violations (unauthenticated / login-panel branch)', async () => {
    const { container } = render(<AccountSettingsPage />)

    // The page starts in a loading state and immediately resolves the fetch;
    // wait one microtask tick for the promise rejection to propagate.
    await new Promise((r) => setTimeout(r, 0))

    expect(container.firstChild).not.toBeNull()

    // Primary a11y assertion — 0 violations expected.
    // If violations are found, they are a pre-existing issue and must NOT be
    // fixed in this PR. TODO: file follow-up ticket per P1 a11y audit.
    const results = await runAxe(container)
    expect(results.violations.length).toBe(0)
  })
})
