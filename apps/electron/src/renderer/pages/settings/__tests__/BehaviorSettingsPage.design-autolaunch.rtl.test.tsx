/**
 * RTL a11y + interaction tests for BehaviorSettingsPage (T537 Phase D).
 *
 * Cycles 15-16: radio reflects current preference + writes on change.
 * Cycles 17-18: axe-core 0 violations on radio group.
 *
 * Mocked deps:
 *   - window.electronAPI: getAutoLaunchDesign, setAutoLaunchDesign
 *   - PanelHeader, HeaderMenu, ScrollArea: thin stubs
 *   - routes: stub
 *   - motion/react AnimatePresence: passthrough
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '../../../../test-utils/render'
import { expectNoA11yViolations } from '../../../../test-utils/a11y'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/components/app-shell/PanelHeader', () => ({
  PanelHeader: ({ title }: { title?: string }) => (
    <header>
      <h1>{title ?? 'Behavior'}</h1>
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

// motion/react AnimatePresence: passthrough (SettingsRadioCard uses it)
vi.mock('motion/react', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({
        children,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
        <div {...props}>{children}</div>
      ),
    },
  }
})

// ── Imports under test ────────────────────────────────────────────────────────

import BehaviorSettingsPage from '../BehaviorSettingsPage'

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
  api.getAutoLaunchDesign = vi.fn(() => Promise.resolve('ask'))
  api.setAutoLaunchDesign = vi.fn(() => Promise.resolve({ success: true }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BehaviorSettingsPage — Auto-launch Rox Design toggle', () => {
  // Cycle 15 & 16: radio reflects current preference

  it('renders the auto-launch radio group with 3 options', async () => {
    render(<BehaviorSettingsPage />)
    await waitFor(() => {
      expect(screen.getByRole('radiogroup')).not.toBeNull()
    })
    // In tests, i18n returns the translation key as-is
    expect(screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchAlways/i })).not.toBeNull()
    expect(screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchAsk/i })).not.toBeNull()
    expect(screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchNever/i })).not.toBeNull()
  })

  it('reflects "ask" as checked by default (loaded from electronAPI)', async () => {
    const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
    api.getAutoLaunchDesign = vi.fn(() => Promise.resolve('ask'))

    render(<BehaviorSettingsPage />)
    await waitFor(() => {
      const askRadio = screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchAsk/i })
      expect(askRadio.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('reflects "always" when loaded preference is "always"', async () => {
    const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
    api.getAutoLaunchDesign = vi.fn(() => Promise.resolve('always'))

    render(<BehaviorSettingsPage />)
    await waitFor(() => {
      const alwaysRadio = screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchAlways/i })
      expect(alwaysRadio.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('reflects "never" when loaded preference is "never"', async () => {
    const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
    api.getAutoLaunchDesign = vi.fn(() => Promise.resolve('never'))

    render(<BehaviorSettingsPage />)
    await waitFor(() => {
      const neverRadio = screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchNever/i })
      expect(neverRadio.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('calls setAutoLaunchDesign when a radio option is clicked', async () => {
    const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
    const setFn = vi.fn(() => Promise.resolve({ success: true }))
    api.setAutoLaunchDesign = setFn

    render(<BehaviorSettingsPage />)
    await waitFor(() => screen.getByRole('radiogroup'))

    fireEvent.click(screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchAlways/i }))

    await waitFor(() => {
      expect(setFn).toHaveBeenCalledWith('always')
    })
  })

  it('updates radio selection optimistically when option is clicked', async () => {
    render(<BehaviorSettingsPage />)
    await waitFor(() => screen.getByRole('radiogroup'))

    const alwaysRadio = screen.getByRole('radio', { name: /settings\.behavior\.autoLaunchAlways/i })
    fireEvent.click(alwaysRadio)

    await waitFor(() => {
      expect(alwaysRadio.getAttribute('aria-checked')).toBe('true')
    })
  })

  // Cycles 17 & 18: a11y

  it('has no axe-core violations on the radio group (WCAG 2.x)', async () => {
    const { container } = render(<BehaviorSettingsPage />)
    await waitFor(() => screen.getByRole('radiogroup'))
    await expectNoA11yViolations(container)
  })
})
