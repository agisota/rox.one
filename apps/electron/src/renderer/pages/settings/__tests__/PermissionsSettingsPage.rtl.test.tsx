/**
 * RTL a11y smoke tests for PermissionsSettingsPage. [P1-a11y-gap]
 *
 * Cases covered:
 *   - a11y: no axe violations on the "no permissions loaded" empty state.
 *     The page renders a loading spinner then transitions to an empty
 *     permissions table. We stub the IPC calls to resolve with empty configs.
 *   - basic interaction: "Learn more" link button is present and reachable.
 *
 * Mocked deps:
 *   - window.electronAPI: getDefaultPermissionsConfig, getWorkspacePermissionsConfig,
 *     onDefaultPermissionsChanged, openUrl
 *   - useAppShellContext + useActiveWorkspace: minimal stubs
 *   - PanelHeader, HeaderMenu, ScrollArea: thin stubs
 *   - EditPopover, EditButton: stubbed (avoids portal/floating-ui issues)
 *   - PermissionsDataTable: stubbed (data-table uses ResizeObserver internally)
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
      <h1>{title ?? 'Permissions'}</h1>
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

// EditPopover / EditButton: stub out to avoid floating-ui portal complexity
vi.mock('@/components/ui/EditPopover', () => ({
  EditPopover: () => null,
  EditButton: () => <button type="button" aria-label="Edit">Edit</button>,
  getEditConfig: () => ({
    context: '',
    example: '',
    displayLabel: 'Edit',
    model: undefined,
    systemPromptPreset: undefined,
  }),
}))

// PermissionsDataTable: stub — the real table mounts ResizeObserver and portals
vi.mock('@/components/info', () => ({
  PermissionsDataTable: ({ data }: { data?: unknown[] }) => (
    <table aria-label="Permissions">
      <tbody>
        {(data ?? []).map((_, i) => (
          <tr key={i}>
            <td>row {i}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  LabelsDataTable: () => <table aria-label="Labels"><tbody /></table>,
  AutoRulesDataTable: () => <table aria-label="Auto rules"><tbody /></table>,
}))

// AppShellContext: minimal stub
vi.mock('@/context/AppShellContext', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    useAppShellContext: () => ({
      activeWorkspaceId: 'ws-test',
    }),
    useActiveWorkspace: () => ({
      id: 'ws-test',
      name: 'Test Workspace',
      rootPath: '/tmp/test-ws',
    }),
  }
})

// ── Imports under test ────────────────────────────────────────────────────────

import PermissionsSettingsPage from '../PermissionsSettingsPage'

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
  api.getDefaultPermissionsConfig = () =>
    Promise.resolve({ config: null, path: '/home/test/.rox/permissions/default.json' })
  api.getWorkspacePermissionsConfig = () => Promise.resolve(null)
  // onDefaultPermissionsChanged: return an unsubscribe fn
  api.onDefaultPermissionsChanged = (_cb: () => void) => () => {}
  api.openUrl = () => Promise.resolve()
})

afterEach(() => {
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PermissionsSettingsPage a11y [P1-a11y-gap]', () => {
  it('renders without axe violations (empty permissions state)', async () => {
    const { container } = render(<PermissionsSettingsPage />)

    // Wait for async IPC calls to resolve so the loading spinner clears
    await new Promise((r) => setTimeout(r, 0))

    expect(container.firstChild).not.toBeNull()

    // Primary a11y assertion — 0 violations expected.
    // TODO: if violations are found, file follow-up ticket per P1 a11y audit.
    const results = await runAxe(container)
    expect(results.violations.length).toBe(0)
  })

  it('Learn more link is present after loading completes', async () => {
    const { getByText } = render(<PermissionsSettingsPage />)
    await new Promise((r) => setTimeout(r, 0))
    // i18n returns the key as the value in test env
    const learnMore = getByText(/common\.learnMore|learn more/i)
    expect(learnMore).toBeTruthy()
  })
})
