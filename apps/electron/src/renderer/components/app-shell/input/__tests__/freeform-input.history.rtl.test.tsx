/**
 * RTL coverage for FreeFormInput composer-history wiring. [T234]
 *
 * Cases covered:
 *   - Submit + ArrowUp on empty input recalls the last submission
 *   - Three submits + ArrowUp x3 walks back through them
 *   - ArrowDown after recall walks forward
 *   - ArrowDown past most-recent recall restores empty scratch
 *   - Editing a recalled entry + Enter pushes the edited message
 *   - sessionId change clears history (next ArrowUp is a no-op)
 *   - ArrowUp with non-empty text does NOT trigger recall (caret nav)
 *   - a11y: no axe violations on the rendered composer
 */
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks (mirror freeform-input.send.rtl.test.tsx) ───────────────────────────

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
      setValue: (v: string) => {
        if (localRef.current) {
          localRef.current.value = v
          // Surface the change to the host so React state stays in sync.
          props.onChange(v)
        }
      },
      setSelectionRange: (s: number, e: number) => localRef.current?.setSelectionRange(s, e),
      getBoundingClientRect: () => localRef.current?.getBoundingClientRect() ?? new DOMRect(),
      getCaretRect: () => null,
      element: localRef.current,
    }), [props.onChange])
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

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('../PromptRewriteDialog', () => ({
  PromptRewriteDialog: () => null,
}))
vi.mock('../ThinkingPartnerRoundTableDialog', () => ({
  ThinkingPartnerRoundTableDialog: () => null,
}))
vi.mock('../ComposerArtifactPanel', () => ({
  ComposerArtifactPanel: () => null,
}))

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

vi.mock('@/components/ServerDirectoryBrowser', () => ({
  ServerDirectoryBrowser: () => null,
}))

vi.mock('@/components/ui/SourceSelectorPopover', () => ({
  SourceSelectorPopover: () => null,
}))
vi.mock('@/components/ui/EditPopover', () => ({
  EditPopover: () => null,
  getEditConfig: () => ({}),
}))

// ── Imports under test ───────────────────────────────────────────────────────
import { render } from '../../../../../test-utils/render'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectNoA11yViolations } from '../../../../../test-utils/a11y'
import { FreeFormInput } from '../FreeFormInput'

// ── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
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
  cleanup()
})

function baseProps(overrides: Partial<React.ComponentProps<typeof FreeFormInput>> = {}) {
  return {
    onSubmit: vi.fn(),
    currentModel: 'claude-3-5-sonnet-20241022',
    onModelChange: vi.fn(),
    sessionId: 'session-1',
    ...overrides,
  } satisfies React.ComponentProps<typeof FreeFormInput>
}

async function typeAndSubmit(textarea: HTMLElement, value: string): Promise<void> {
  await userEvent.type(textarea, value)
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('FreeFormInput composer history [T234]', () => {
  it('Submit + ArrowUp on empty input recalls the last submission', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'first message')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))

    // Empty input now; ArrowUp should pull back the last submission.
    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })

    await waitFor(() => expect(textarea.value).toBe('first message'))
  })

  it('Three submits + ArrowUp x3 walks back through them', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'one')
    await typeAndSubmit(textarea, 'two')
    await typeAndSubmit(textarea, 'three')

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3))

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('three'))

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('two'))

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('one'))
  })

  it('ArrowDown after recall walks forward', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'alpha')
    await typeAndSubmit(textarea, 'beta')

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('beta'))

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('alpha'))

    fireEvent.keyDown(textarea, { key: 'ArrowDown', code: 'ArrowDown' })
    await waitFor(() => expect(textarea.value).toBe('beta'))
  })

  it('ArrowDown past most-recent recall restores empty scratch', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'one')

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('one'))

    fireEvent.keyDown(textarea, { key: 'ArrowDown', code: 'ArrowDown' })
    await waitFor(() => expect(textarea.value).toBe(''))
  })

  it('Editing a recalled entry + Enter pushes the edited message (no pollution)', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'original')
    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('original'))

    // Append edit. The first ArrowUp set the value, so type appends.
    await userEvent.type(textarea, ' edit')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))

    // Pull back; we should get the edited message first.
    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('original edit'))

    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })
    await waitFor(() => expect(textarea.value).toBe('original'))
  })

  it('sessionId change clears history (next ArrowUp is a no-op)', async () => {
    const onSubmit = vi.fn()
    const { rerender } = render(<FreeFormInput {...baseProps({ onSubmit, sessionId: 's-a' })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'session-a msg')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))

    rerender(<FreeFormInput {...baseProps({ onSubmit, sessionId: 's-b' })} />)
    const nextTextarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    fireEvent.keyDown(nextTextarea, { key: 'ArrowUp', code: 'ArrowUp' })
    // History is cleared — value stays empty.
    expect(nextTextarea.value).toBe('')
  })

  it('ArrowUp with non-empty text does NOT trigger recall', async () => {
    const onSubmit = vi.fn()
    render(<FreeFormInput {...baseProps({ onSubmit })} />)
    const textarea = await screen.findByTestId<HTMLTextAreaElement>('rich-text-input')

    await typeAndSubmit(textarea, 'submitted')
    await userEvent.type(textarea, 'typing now')
    fireEvent.keyDown(textarea, { key: 'ArrowUp', code: 'ArrowUp' })

    // Value is unchanged because the input is non-empty.
    expect(textarea.value).toBe('typing now')
  })

  it('a11y: no axe violations on the rendered composer', async () => {
    const { container } = render(<FreeFormInput {...baseProps()} />)
    await screen.findByTestId('rich-text-input')
    // FreeFormInput renders a hidden `<input type="file">` whose accessible
    // label is the trigger button; disable the `label` rule per Pillar 3
    // convention (see T187 worklog §6).
    await expectNoA11yViolations(container, {
      rules: { label: { enabled: false } },
    })
  })
})
