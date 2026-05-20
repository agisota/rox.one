/**
 * RTL tests for OnboardingPromptModal (T537 Phase D, cycles 13-14 + a11y 17-18).
 *
 * Covers:
 *   - Renders 3 choice buttons + close button when open=true
 *   - Calls onChoice('always' | 'ask' | 'never') on button click
 *   - Calls onClose on close button click
 *   - Does not render when open=false
 *   - Axe-core: 0 violations (WCAG 2.x)
 */

import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { render } from '../../../../test-utils/render'
import { expectNoA11yViolations } from '../../../../test-utils/a11y'
import { OnboardingPromptModal } from '../OnboardingPromptModal'
import type { AutoLaunchDesignChoice } from '../../../hooks/useAutoLaunchDecision'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/navigate', () => ({
  routes: { view: { settings: (slug: string) => `settings/${slug}` } },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  open: true,
  title: 'Auto-launch Rox Design?',
  description: 'When ROX detects a design task, should it open Rox Design automatically?',
  labels: {
    always: 'Always',
    ask: 'Ask me',
    never: 'Never',
    close: 'Close',
  },
  onChoice: vi.fn<[AutoLaunchDesignChoice], void>(),
  onClose: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnboardingPromptModal', () => {
  // Cycle 13 & 14: renders 3 buttons + close, calls onChoice

  it('renders dialog with title when open=true', () => {
    render(<OnboardingPromptModal {...DEFAULT_PROPS} />)
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(screen.getByText('Auto-launch Rox Design?')).not.toBeNull()
  })

  it('renders description text when provided', () => {
    render(<OnboardingPromptModal {...DEFAULT_PROPS} />)
    expect(screen.getByText('When ROX detects a design task, should it open Rox Design automatically?')).not.toBeNull()
  })

  it('renders 3 choice buttons', () => {
    render(<OnboardingPromptModal {...DEFAULT_PROPS} />)
    expect(screen.getByText('Always')).not.toBeNull()
    expect(screen.getByText('Ask me')).not.toBeNull()
    expect(screen.getByText('Never')).not.toBeNull()
  })

  it('renders close button with accessible label', () => {
    render(<OnboardingPromptModal {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull()
  })

  it('calls onChoice("always") when Always button is clicked', () => {
    const onChoice = vi.fn<[AutoLaunchDesignChoice], void>()
    render(<OnboardingPromptModal {...DEFAULT_PROPS} onChoice={onChoice} />)
    fireEvent.click(screen.getByText('Always'))
    expect(onChoice).toHaveBeenCalledTimes(1)
    expect(onChoice).toHaveBeenCalledWith('always')
  })

  it('calls onChoice("ask") when Ask me button is clicked', () => {
    const onChoice = vi.fn<[AutoLaunchDesignChoice], void>()
    render(<OnboardingPromptModal {...DEFAULT_PROPS} onChoice={onChoice} />)
    fireEvent.click(screen.getByText('Ask me'))
    expect(onChoice).toHaveBeenCalledTimes(1)
    expect(onChoice).toHaveBeenCalledWith('ask')
  })

  it('calls onChoice("never") when Never button is clicked', () => {
    const onChoice = vi.fn<[AutoLaunchDesignChoice], void>()
    render(<OnboardingPromptModal {...DEFAULT_PROPS} onChoice={onChoice} />)
    fireEvent.click(screen.getByText('Never'))
    expect(onChoice).toHaveBeenCalledTimes(1)
    expect(onChoice).toHaveBeenCalledWith('never')
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<OnboardingPromptModal {...DEFAULT_PROPS} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<OnboardingPromptModal {...DEFAULT_PROPS} onClose={onClose} />)
    // Backdrop is the aria-hidden div behind the panel
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render when open=false', () => {
    render(<OnboardingPromptModal {...DEFAULT_PROPS} open={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Always')).toBeNull()
  })

  // Cycles 17 & 18: axe-core a11y

  it('has no axe-core violations (WCAG 2.x)', async () => {
    const { container } = render(<OnboardingPromptModal {...DEFAULT_PROPS} />)
    await expectNoA11yViolations(container)
  })
})
