/**
 * RTL coverage for FreeFormInput's ProductModeToolbar mode-switching path. [T187]
 *
 * The toolbar lives at the top of the composer and exposes a button that opens
 * a listbox of modes. T180-T185 already audited the a11y surface; T187 adds
 * behavioral coverage so a future refactor can't silently break the open /
 * arrow-navigate / select cycle.
 *
 * Cases covered:
 *   - Default mode is `research` (the toolbar trigger reflects it)
 *   - Click the trigger → listbox opens with role=listbox
 *   - ArrowDown moves the active option forward
 *   - Enter selects → the previously-selected mode changes (visible through
 *     the option becoming aria-selected="true" / the trigger label updating)
 *   - Escape closes the open listbox
 *   - a11y: no violations after opening the listbox
 *
 * Mocks: same self-contained pattern as the rest of the T187 suite.
 */
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/rich-text-input', async () => {
  const RichTextInput = React.forwardRef<unknown, {
    value: string
    onChange: (v: string) => void
    onKeyDown?: (e: React.KeyboardEvent) => void
    onInput?: (v: string, cursor: number) => void
    onFocus?: (e: React.FocusEvent) => void
    onBlur?: (e: React.FocusEvent) => void
    onPaste?: (e: React.ClipboardEvent) => void
    placeholder?: string | string[]
    disabled?: boolean
    ariaLabel?: string
    className?: string
  }>(function RichTextInput(props, ref) {
    const localRef = React.useRef<HTMLTextAreaElement>(null)
    React.useImperativeHandle(ref, () => ({
      focus: () => localRef.current?.focus(),
      blur: () => localRef.current?.blur(),
      get value() { return localRef.current?.value ?? '' },
      get selectionStart() { return localRef.current?.selectionStart ?? 0 },
      setValue: (v: string) => { if (localRef.current) localRef.current.value = v },
      setSelectionRange: (s: number, e: number) => localRef.current?.setSelectionRange(s, e),
      getBoundingClientRect: () => localRef.current?.getBoundingClientRect() ?? new DOMRect(),
      getCaretRect: () => null,
      element: localRef.current,
    }), [])
    return (
      <textarea
        ref={localRef}
        data-testid="rich-text-input"
        value={props.value}
        disabled={props.disabled}
        aria-label={props.ariaLabel}
        onChange={(e) => {
          props.onChange(e.target.value)
          props.onInput?.(e.target.value, e.target.selectionStart ?? 0)
        }}
        onKeyDown={props.onKeyDown}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
        onPaste={props.onPaste}
        className={props.className}
      />
    )
  })
  return { RichTextInput }
})

vi.mock('@/context/EscapeInterruptContext', () => ({
  useEscapeInterrupt: () => ({
    showEscapeOverlay: false,
    handleEscapePress: () => false,
    dismissOverlay: () => undefined,
  }),
}))

vi.mock('@/hooks/useDirectoryPicker', () => ({
  useDirectoryPicker: () => ({
    pickDirectory: () => undefined,
    showServerBrowser: false,
    serverBrowserMode: 'browse' as const,
    cancelServerBrowser: () => undefined,
    confirmServerBrowser: () => undefined,
  }),
}))

vi.mock('../PromptRewriteDialog', () => ({ PromptRewriteDialog: () => null }))
vi.mock('../ThinkingPartnerRoundTableDialog', () => ({ ThinkingPartnerRoundTableDialog: () => null }))
vi.mock('../ComposerArtifactPanel', () => ({ ComposerArtifactPanel: () => null }))

vi.mock('@rox-one/ui', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    TooltipContent: () => null,
    TooltipProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuSub: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuPortal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/styled-dropdown', () => ({
  StyledDropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  StyledDropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  StyledDropdownMenuSeparator: () => null,
  StyledDropdownMenuSubTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  StyledDropdownMenuSubContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ServerDirectoryBrowser', () => ({ ServerDirectoryBrowser: () => null }))
vi.mock('@/components/ui/SourceSelectorPopover', () => ({ SourceSelectorPopover: () => null }))
vi.mock('@/components/ui/EditPopover', () => ({ EditPopover: () => null, getEditConfig: () => ({}) }))

// ── Imports under test ───────────────────────────────────────────────────────
import { render } from '../../../../../test-utils/render'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expectNoA11yViolations } from '../../../../../test-utils/a11y'
import { FreeFormInput } from '../FreeFormInput'

// ── Common test setup ────────────────────────────────────────────────────────
beforeEach(() => {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    getRuntimeEnvironment: () => 'electron',
    getAutoCapitalisation: () => Promise.resolve(false),
    getSendMessageKey: () => Promise.resolve('enter'),
    getSpellCheck: () => Promise.resolve(false),
    getHomeDir: () => Promise.resolve('/home/test'),
    getPendingPlanExecution: () => Promise.resolve(null),
    sessionCommand: () => Promise.resolve({ success: true }),
    generateThumbnail: () => Promise.resolve(null),
    getFilePath: () => null,
    saveLlmConnection: () => Promise.resolve({ success: true }),
    getGitBranch: () => Promise.resolve(null),
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

afterEach(() => {
  cleanup()
})

function baseProps(overrides: Partial<React.ComponentProps<typeof FreeFormInput>> = {}) {
  return {
    onSubmit: vi.fn(),
    currentModel: 'claude-3-5-sonnet-20241022',
    onModelChange: vi.fn(),
    ...overrides,
  } satisfies React.ComponentProps<typeof FreeFormInput>
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('FreeFormInput product-mode toolbar [T187]', () => {
  it('renders the picker trigger labelled with the default mode (research)', async () => {
    render(<FreeFormInput {...baseProps()} />)
    const trigger = await screen.findByTestId('product-mode-picker')
    expect(trigger).toBeTruthy()
    // i18n fallback returns the key — research label key encodes the mode id.
    expect(trigger.textContent).toContain('workbench.modes.research.label')
  })

  it('clicking the picker opens a listbox of mode options', async () => {
    render(<FreeFormInput {...baseProps()} />)
    const trigger = await screen.findByTestId('product-mode-picker')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const listbox = await screen.findByRole('listbox')
    expect(listbox).toBeTruthy()
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
  })

  it('ArrowDown then Enter selects the next mode (research → next mode)', async () => {
    render(<FreeFormInput {...baseProps()} />)
    const trigger = await screen.findByTestId('product-mode-picker')
    fireEvent.click(trigger)
    const listbox = await screen.findByRole('listbox')

    // Initial active option is research.
    const initialActive = listbox.querySelector('[data-active="true"]') as HTMLElement | null
    expect(initialActive?.getAttribute('data-product-mode-option')).toBe('research')

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })

    const nextActive = listbox.querySelector('[data-active="true"]') as HTMLElement | null
    expect(nextActive?.getAttribute('data-product-mode-option')).not.toBe('research')

    const targetMode = nextActive!.getAttribute('data-product-mode-option')
    fireEvent.keyDown(listbox, { key: 'Enter' })

    // Listbox closes after Enter; trigger label now reflects the selected mode.
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
    const triggerAfter = screen.getByTestId('product-mode-picker')
    expect(triggerAfter.textContent).toContain(`workbench.modes.${targetMode}.label`)
  })

  it('Escape on the open listbox closes it', async () => {
    render(<FreeFormInput {...baseProps()} />)
    const trigger = await screen.findByTestId('product-mode-picker')
    fireEvent.click(trigger)
    const listbox = await screen.findByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })

  it('a11y: no axe violations with the picker open', async () => {
    const { container } = render(<FreeFormInput {...baseProps()} />)
    const trigger = await screen.findByTestId('product-mode-picker')
    fireEvent.click(trigger)
    await screen.findByRole('listbox')
    await expectNoA11yViolations(container, {
      rules: {
        label: { enabled: false },
        'button-name': { enabled: false },
      },
    })
  })
})
