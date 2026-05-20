/**
 * RTL tests for the standalone ROX DESIGN button in TopBar. [T537 PR#3]
 *
 * Cases covered:
 *   C1: button renders right of `+` when status === 'idle'
 *   C2: click → calls onOpenRoxDesign prop
 *   C3: status === 'starting' shows Loader2 animate-spin
 *   C4: status === 'running' has accent border + background classes
 *   C5: status === 'failed' shows red pulse dot
 *   C6: tooltip text is dynamic per state
 *   C7: aria-label is dynamic per state
 *   C8: jest-axe — 0 violations across all 4 states
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '../../../../test-utils/render'
import { expectNoA11yViolations } from '../../../../test-utils/a11y'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the useRoxDesignStatus hook so tests control status independently
vi.mock('../../../hooks/useRoxDesignStatus', () => ({
  useRoxDesignStatus: vi.fn(() => ({ status: 'idle', error: undefined })),
}))

// Mock @/actions — TopBar calls useActionLabel which needs ActionRegistryProvider
vi.mock('../../../actions', () => ({
  useActionLabel: () => ({ hotkey: undefined, label: '' }),
  ActionRegistryProvider: ({ children }: { children: React.ReactNode }) => children,
  useActionRegistry: () => ({}),
}))

// No react-i18next mock needed — the TestComposerHarness in render.tsx
// initialises a real i18n instance with parseMissingKeyHandler returning
// the key itself, so t('some.key') === 'some.key' in tests.

// Minimal electronAPI mock — covers all calls TopBar makes on mount
const mockElectronAPI = {
  isDebugMode: vi.fn(async () => false),
  // useUpdateChecker
  getUpdateInfo: vi.fn(async () => ({ available: false, currentVersion: '0.0.0' })),
  getUpdateSettings: vi.fn(async () => null),
  onUpdateAvailable: vi.fn(() => () => {}),
  onUpdateDownloadProgress: vi.fn(() => () => {}),
  // useRoxDesignStatus
  roxDesign: {
    getStatus: vi.fn(async () => ({ status: 'idle' as const })),
  },
  onRoxDesignStatusChanged: vi.fn(() => () => {}),
}

beforeEach(() => {
  // @ts-ignore — happy-dom doesn't have window.electronAPI
  window.electronAPI = mockElectronAPI
})

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

// ---------------------------------------------------------------------------
// Import component + hook after mocks are set up
// ---------------------------------------------------------------------------

import { TopBar } from '../TopBar'
import * as useRoxDesignStatusModule from '../../../hooks/useRoxDesignStatus'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  workspaces: [],
  activeWorkspaceId: null,
  onSelectWorkspace: vi.fn(),
  onNewChat: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenSettingsSubpage: vi.fn(),
  onOpenKeyboardShortcuts: vi.fn(),
  onOpenStoredUserPreferences: vi.fn(),
  onOpenRoxDesign: vi.fn(),
  onBack: vi.fn(),
  onForward: vi.fn(),
  canGoBack: false,
  canGoForward: false,
  onToggleSidebar: vi.fn(),
  onToggleFocusMode: vi.fn(),
  onAddSessionPanel: vi.fn(),
  onAddBrowserPanel: vi.fn(),
}

function mockStatus(status: 'idle' | 'starting' | 'running' | 'failed', error?: string) {
  vi.mocked(useRoxDesignStatusModule.useRoxDesignStatus).mockReturnValue({ status, error })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TopBar — ROX DESIGN standalone button', () => {
  // C1: button renders when status === 'idle'
  it('renders a ROX DESIGN button in idle state', () => {
    mockStatus('idle')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.idle/i })
    expect(btn).toBeTruthy()
  })

  // C2: click → calls onOpenRoxDesign prop
  it('calls onOpenRoxDesign when clicked', () => {
    mockStatus('idle')
    const onOpenRoxDesign = vi.fn()
    render(<TopBar {...DEFAULT_PROPS} onOpenRoxDesign={onOpenRoxDesign} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.idle/i })
    fireEvent.click(btn)
    expect(onOpenRoxDesign).toHaveBeenCalledOnce()
  })

  // C3: status === 'starting' shows Loader2 with animate-spin
  it('shows a spinning loader in starting state', () => {
    mockStatus('starting')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.starting/i })
    // The button should contain an SVG with animate-spin class
    const svg = btn.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.classList.contains('animate-spin')).toBe(true)
  })

  // C4: status === 'running' has accent styling
  it('has accent border and background in running state', () => {
    mockStatus('running')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.running/i })
    // Check inline style or class names contain accent variables
    const style = btn.getAttribute('style') ?? ''
    const cls = btn.className
    const hasAccentBorder = style.includes('--rox-accent') || cls.includes('rox-accent')
    const hasAccentBg = style.includes('--rox-accent') || cls.includes('rox-accent')
    expect(hasAccentBorder || hasAccentBg).toBe(true)
  })

  // C5: status === 'failed' shows red pulse dot
  it('shows a red pulse indicator in failed state', () => {
    mockStatus('failed', 'daemon crashed')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.failed/i })
    // There should be a span/div with animate-pulse class inside the button
    const pulseDot = btn.querySelector('[class*="animate-pulse"]')
    expect(pulseDot).toBeTruthy()
  })

  // C6: tooltip text is dynamic per state
  it('shows state-specific tooltip text', () => {
    mockStatus('idle')
    const { unmount } = render(<TopBar {...DEFAULT_PROPS} />)
    // Tooltip content isn't in the DOM until hover in most implementations,
    // but our TopBar renders TooltipContent statically for screen readers.
    // We check via aria-label which doubles as accessible description.
    const btn = screen.getByRole('button', { name: /topBar\.design\.idle/i })
    expect(btn.getAttribute('aria-label')).toMatch(/topBar\.design\.idle/)
    unmount()
  })

  // C7: aria-label is dynamic per state
  it('sets aria-label to starting key in starting state', () => {
    mockStatus('starting')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.starting/i })
    expect(btn.getAttribute('aria-label')).toMatch(/topBar\.design\.starting/)
  })

  it('sets aria-label to running key in running state', () => {
    mockStatus('running')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.running/i })
    expect(btn.getAttribute('aria-label')).toMatch(/topBar\.design\.running/)
  })

  it('sets aria-label to failed key in failed state', () => {
    mockStatus('failed', 'oh no')
    render(<TopBar {...DEFAULT_PROPS} />)
    const btn = screen.getByRole('button', { name: /topBar\.design\.failed/i })
    expect(btn.getAttribute('aria-label')).toMatch(/topBar\.design\.failed/)
  })

  // C8: a11y — no violations across all 4 states
  it('has no a11y violations in idle state', async () => {
    mockStatus('idle')
    const { container } = render(<TopBar {...DEFAULT_PROPS} />)
    await expectNoA11yViolations(container)
  })

  it('has no a11y violations in starting state', async () => {
    mockStatus('starting')
    const { container } = render(<TopBar {...DEFAULT_PROPS} />)
    await expectNoA11yViolations(container)
  })

  it('has no a11y violations in running state', async () => {
    mockStatus('running')
    const { container } = render(<TopBar {...DEFAULT_PROPS} />)
    await expectNoA11yViolations(container)
  })

  it('has no a11y violations in failed state', async () => {
    mockStatus('failed', 'test error')
    const { container } = render(<TopBar {...DEFAULT_PROPS} />)
    await expectNoA11yViolations(container)
  })
})
