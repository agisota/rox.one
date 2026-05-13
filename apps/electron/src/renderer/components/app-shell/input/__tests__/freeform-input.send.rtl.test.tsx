/**
 * RTL coverage for FreeFormInput's send/submit hot path. [T187]
 *
 * Cases covered:
 *   - Typing text + Enter → onSubmit fires with the typed text
 *   - Shift+Enter → no submit
 *   - Empty input + Enter → no submit
 *   - a11y: no axe violations after typing
 *
 * Mocks:
 *   - RichTextInput (replaced with a textarea-style stand-in that exposes the
 *     same imperative handle FreeFormInput uses)
 *   - EscapeInterruptContext (useEscapeInterrupt would otherwise throw)
 *   - useDirectoryPicker (no-op in tests)
 *   - window.electronAPI minimal stub
 *   - lucide-react icons → noop spans (avoid SVG cost in happy-dom)
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

// Heavy dialogs depend on ModalProvider; render-cheap stubs are sufficient
// for the send hot path which never opens them.
vi.mock('../PromptRewriteDialog', () => ({
  PromptRewriteDialog: () => null,
}))
vi.mock('../ThinkingPartnerRoundTableDialog', () => ({
  ThinkingPartnerRoundTableDialog: () => null,
}))
vi.mock('../ComposerArtifactPanel', () => ({
  ComposerArtifactPanel: () => null,
}))

// Radix-based primitives have multiple nested copies of @radix-ui/react-context
// in this monorepo (Bun's hoisted-linker artifact). Each copy creates its own
// React context, so a Tooltip rendered in one copy can never see a Provider
// from another. Stubbing these primitives sidesteps the cross-copy lookup
// without changing FreeFormInput's behavior under test.
vi.mock('@rox-one/ui', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children, asChild: _ }: { children?: React.ReactNode; asChild?: boolean }) => <>{children}</>,
    TooltipContent: () => null,
    TooltipProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children, asChild: _ }: { children?: React.ReactNode; asChild?: boolean }) => <>{children}</>,
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
  PopoverTrigger: ({ children, asChild: _ }: { children?: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

// FreeFormInput renders working-directory ServerDirectoryBrowser; cmdk inside
// it is heavy and irrelevant for the send hot path.
vi.mock('@/components/ServerDirectoryBrowser', () => ({
  ServerDirectoryBrowser: () => null,
}))

// SourceSelectorPopover & EditPopover are not on the send path either.
vi.mock('@/components/ui/SourceSelectorPopover', () => ({
  SourceSelectorPopover: () => null,
}))
vi.mock('@/components/ui/EditPopover', () => ({
  EditPopover: () => null,
  getEditConfig: () => ({}),
}))

// ── Imports under test ───────────────────────────────────────────────────────
// NOTE: use relative path — vitest's `@` alias points to src/renderer, but
// test-utils lives at src/test-utils (outside the @ alias root).
import { render } from '../../../../../test-utils/render'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectNoA11yViolations } from '../../../../../test-utils/a11y'
import { FreeFormInput } from '../FreeFormInput'

// ── Common test setup ────────────────────────────────────────────────────────
beforeEach(() => {
  // Minimal electronAPI surface used by FreeFormInput's effects.
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
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
  // Vitest doesn't auto-cleanup RTL between tests; without this each render
  // adds another <FreeFormInput /> to document.body and queries match multiple.
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
describe('FreeFormInput send hot path [T187]', () => {
  it('Enter submits typed text via onSubmit', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId('rich-text-input')

    await userEvent.type(textarea, 'hello world')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toBe('hello world')
  })

  it('Shift+Enter does NOT submit (newline path)', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId('rich-text-input')

    await userEvent.type(textarea, 'line one')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('empty input + Enter is a no-op', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId('rich-text-input')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('whitespace-only input + Enter is a no-op (input.trim() guard)', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId('rich-text-input')
    await userEvent.type(textarea, '    ')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('a11y: no axe violations after typing', async () => {
    const { container } = render(<FreeFormInput {...baseProps()} />)
    const textarea = await screen.findByTestId('rich-text-input')
    await userEvent.type(textarea, 'hi there')
    // The component renders a `<input type="file" className="hidden">` whose
    // accessible label is the trigger button (paperclip), not its own attribute.
    // happy-dom doesn't apply Tailwind's .hidden style, so axe can't infer the
    // node is inert. Disable the `label` rule for this scope only.
    await expectNoA11yViolations(container, {
      rules: { label: { enabled: false } },
    })
  })
})
