/**
 * RTL a11y smoke tests for LabelsSettingsPage. [P1-a11y-gap]
 *
 * Cases covered:
 *   - a11y: no axe violations on the "no labels" empty state.
 *     The page uses useLabels (IPC-backed) and renders two data tables.
 *     We stub the hook and the tables to get a stable, accessible render.
 *   - basic presence: section headings are present after load.
 *
 * Mocked deps:
 *   - useLabels: returns empty labels, isLoading=false immediately
 *   - useAppShellContext + useActiveWorkspace: minimal stubs
 *   - PanelHeader, HeaderMenu, ScrollArea: thin stubs
 *   - EditPopover, EditButton, getEditConfig: stubs (avoids floating-ui portals)
 *   - LabelsDataTable, AutoRulesDataTable: stubs (avoid ResizeObserver + portals)
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
      <h1>{title ?? 'Labels'}</h1>
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

// Data tables: stub to avoid ResizeObserver/portal issues in happy-dom
vi.mock('@/components/info', () => ({
  LabelsDataTable: ({ data }: { data?: unknown[] }) => (
    <table aria-label="Labels">
      <tbody>
        {(data ?? []).map((_, i) => (
          <tr key={i}>
            <td>label {i}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  AutoRulesDataTable: ({ data }: { data?: unknown[] }) => (
    <table aria-label="Auto-apply rules">
      <tbody>
        {(data ?? []).map((_, i) => (
          <tr key={i}>
            <td>rule {i}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  PermissionsDataTable: () => <table aria-label="Permissions"><tbody /></table>,
}))

// useLabels: return empty / non-loading state immediately (no IPC needed)
vi.mock('@/hooks/useLabels', () => ({
  useLabels: () => ({
    labels: [],
    flatLabels: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(() => Promise.resolve()),
  }),
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

import LabelsSettingsPage from '../LabelsSettingsPage'

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
  api.openUrl = () => Promise.resolve()
})

afterEach(() => {
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LabelsSettingsPage a11y [P1-a11y-gap]', () => {
  it('renders without axe violations (empty labels state)', async () => {
    const { container } = render(<LabelsSettingsPage />)

    // useLabels is synchronous in the stub so no async wait needed,
    // but flush microtasks to be safe.
    await new Promise((r) => setTimeout(r, 0))

    expect(container.firstChild).not.toBeNull()

    // Primary a11y assertion — 0 violations expected.
    // TODO: if violations are found, file follow-up ticket per P1 a11y audit.
    const results = await runAxe(container)
    expect(results.violations.length).toBe(0)
  })

  it('renders section headings for Label Hierarchy and Auto-Apply Rules', async () => {
    const { container } = render(<LabelsSettingsPage />)
    await new Promise((r) => setTimeout(r, 0))

    // i18n returns the key as the value — check for the key fragments
    const text = container.textContent ?? ''
    // The page renders SettingsSection titles using t() which returns the key
    expect(text).toMatch(/labelHierarchy|label hierarchy/i)
    expect(text).toMatch(/autoApplyRules|auto.apply rules/i)
  })
})
