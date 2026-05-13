/**
 * RTL a11y smoke tests for TeamManagementSettingsPage. [P1-a11y-gap]
 *
 * Cases covered:
 *   - a11y: no axe violations on the "loading" and "empty actors" states.
 *     TeamManagementPanel uses RolesPanelContext for RPC; we provide a
 *     stub rpcClient that resolves empty arrays immediately.
 *
 * Complexity note: TeamManagementPanel fetches roles + grants via the
 * injected rpcClient, then renders ActorRows. Providing pre-seeded
 * initialState bypasses the async fetch entirely and gives a stable
 * render in jsdom. The page itself wires up window.electronAPI.invokeOnServer
 * as the transport — we skip that and test the panel via initialState.
 *
 * Mocked deps:
 *   - PanelHeader, HeaderMenu, ScrollArea: thin stubs
 *   - window.electronAPI: no-op invokeOnServer (page still renders via
 *     initialState on TeamManagementPanel)
 *
 * A11y violations found: 0 expected. TODO: file follow-up if violations found.
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { render } from '../../../../test-utils/render'
import { runAxe } from '../../../../test-utils/a11y'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/components/app-shell/PanelHeader', () => ({
  PanelHeader: ({ title }: { title?: string }) => (
    <header>
      <h1>{title ?? 'Team management'}</h1>
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

vi.mock('@/lib/navigate', () => ({
  routes: { view: { settings: (slug: string) => `settings/${slug}` } },
}))

// ── Imports under test ────────────────────────────────────────────────────────

import TeamManagementSettingsPage from '../TeamManagementSettingsPage'
import {
  RolesPanelContext,
  TeamManagementPanel,
} from '@/components/settings/rbac'

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
  // invokeOnServer would be called by the page's useRolesRpcClient — but since
  // we are not testing production transport here, a no-op is fine. The panel
  // renders the "no actors" empty state when grants = [].
  ;(api as Record<string, unknown>).invokeOnServer = () =>
    Promise.resolve([])
})

afterEach(() => {
  cleanup()
})

// Minimal stub rpcClient for direct panel rendering
const stubRpcClient = {
  invoke: (_channel: string, ..._args: unknown[]) =>
    Promise.resolve([]),
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TeamManagementSettingsPage a11y [P1-a11y-gap]', () => {
  it('renders without axe violations (full page, empty RBAC state)', async () => {
    // Render the full settings page (tests the page wrapper + context wiring)
    const { container } = render(<TeamManagementSettingsPage />)

    // Wait for rpcClient.invoke promises to resolve
    await new Promise((r) => setTimeout(r, 0))

    expect(container.firstChild).not.toBeNull()

    // Primary a11y assertion — 0 violations expected.
    // TODO: if violations are found, file follow-up ticket per P1 a11y audit.
    const results = await runAxe(container)
    expect(results.violations.length).toBe(0)
  })

  it('TeamManagementPanel renders without axe violations (pre-seeded empty state)', async () => {
    // Test the panel in isolation with pre-seeded state to avoid async fetch.
    // This gives a stable "no actors" empty-state render.
    const { container } = render(
      <RolesPanelContext.Provider
        value={{ rpcClient: stubRpcClient, callerUserId: 'user-test' }}
      >
        <TeamManagementPanel
          initialState={{
            status: 'idle',
            roles: [],
            grants: [],
            error: null,
          }}
        />
      </RolesPanelContext.Provider>,
    )

    await new Promise((r) => setTimeout(r, 0))

    expect(container.firstChild).not.toBeNull()

    const results = await runAxe(container)
    expect(results.violations.length).toBe(0)
  })
})
