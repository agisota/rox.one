/**
 * RTL coverage for FreeFormInput emphasis-toolbar wiring. [T235b]
 * Covers click + Cmd/Ctrl shortcut paths for bold / italic / code /
 * strike, plus the unchanged Enter-submit baseline.
 *
 * Mocks mirror the send / history RTL suites: RichTextInput → textarea
 * stand-in exposing the same imperative handle (selectionStart /
 * selectionEnd / setSelectionRange come from the real <textarea>).
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
      setValue: (v: string) => {
        if (localRef.current) {
          localRef.current.value = v
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

// Same Radix-bypass + cmdk-bypass mocks the rest of the FreeFormInput RTL
// suites use. The cross-copy @radix-ui/react-context issue is documented in
// freeform-input.send.rtl.test.tsx.
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
  // jsdom / happy-dom don't always polyfill rAF — the toggle restores
  // selection inside `requestAnimationFrame`, so make sure the callback
  // runs synchronously enough for our assertions.
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number
    }) as typeof requestAnimationFrame
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

/**
 * Type a value into the textarea and place the cursor at the given range.
 * Mirrors the way a user would highlight `selection` before clicking a
 * toolbar button or pressing a shortcut.
 */
async function typeAndSelect(
  textarea: HTMLTextAreaElement,
  value: string,
  range: { start: number; end: number },
): Promise<void> {
  await userEvent.clear(textarea)
  await userEvent.type(textarea, value)
  textarea.setSelectionRange(range.start, range.end)
  // Dispatch a selectionchange so the host's selection-aware paths see the
  // updated range. Some happy-dom builds skip this otherwise.
  fireEvent.select(textarea)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Render the composer and return the textarea stand-in. Centralised so each
 * `it` keeps to one assertion block.
 */
async function mount(
  overrides?: Partial<React.ComponentProps<typeof FreeFormInput>>,
): Promise<HTMLTextAreaElement> {
  render(<FreeFormInput {...baseProps(overrides)} />)
  return screen.findByTestId<HTMLTextAreaElement>('rich-text-input')
}

describe('FreeFormInput emphasis toolbar [T235b]', () => {
  it('renders the toolbar with all four mode buttons', async () => {
    await mount()
    expect(await screen.findByTestId('composer-emphasis-toolbar')).toBeTruthy()
    for (const mode of ['bold', 'italic', 'code', 'strike']) {
      expect(screen.getByTestId(`composer-emphasis-${mode}`)).toBeTruthy()
    }
  })

  // ── Click path: every mode button wraps the selected slice ─────────────
  const clickCases = [
    { mode: 'bold', input: 'hello world', range: { start: 0, end: 5 }, expected: '**hello** world' },
    { mode: 'italic', input: 'note here', range: { start: 5, end: 9 }, expected: 'note _here_' },
    { mode: 'code', input: 'run cmd now', range: { start: 4, end: 7 }, expected: 'run `cmd` now' },
    { mode: 'strike', input: 'drop this line', range: { start: 5, end: 9 }, expected: 'drop ~~this~~ line' },
  ] as const

  for (const { mode, input, range, expected } of clickCases) {
    it(`clicking the ${mode} button wraps the selected slice`, async () => {
      const textarea = await mount()
      await typeAndSelect(textarea, input, range)
      fireEvent.click(screen.getByTestId(`composer-emphasis-${mode}`))
      await waitFor(() => expect(textarea.value).toBe(expected))
    })
  }

  // ── Shortcut path: each emphasis shortcut produces the same wrap ───────
  const shortcutCases = [
    { name: 'Cmd+B', event: { key: 'b', code: 'KeyB', metaKey: true }, input: 'hello world', range: { start: 6, end: 11 }, expected: 'hello **world**' },
    { name: 'Cmd+I', event: { key: 'i', code: 'KeyI', metaKey: true }, input: 'italic me', range: { start: 7, end: 9 }, expected: 'italic _me_' },
    { name: 'Cmd+`', event: { key: '`', code: 'Backquote', metaKey: true }, input: 'use foo here', range: { start: 4, end: 7 }, expected: 'use `foo` here' },
    { name: 'Cmd+Shift+X', event: { key: 'X', code: 'KeyX', metaKey: true, shiftKey: true }, input: 'wipe me out', range: { start: 0, end: 4 }, expected: '~~wipe~~ me out' },
    { name: 'Ctrl+B', event: { key: 'b', code: 'KeyB', ctrlKey: true }, input: 'ctrl bold', range: { start: 5, end: 9 }, expected: 'ctrl **bold**' },
  ] as const

  for (const { name, event, input, range, expected } of shortcutCases) {
    it(`${name} keydown wraps the selected slice`, async () => {
      const textarea = await mount()
      await typeAndSelect(textarea, input, range)
      fireEvent.keyDown(textarea, event)
      await waitFor(() => expect(textarea.value).toBe(expected))
    })
  }

  it('Cmd+B with a collapsed caret expands to the surrounding word', async () => {
    // Caret sits in the middle of "world" — no range selection. The
    // toggleEmphasis helper expands to the surrounding word, which in turn
    // means Cmd+B without a selection still produces a useful result.
    const textarea = await mount()
    await typeAndSelect(textarea, 'hello world', { start: 8, end: 8 })
    fireEvent.keyDown(textarea, { key: 'b', code: 'KeyB', metaKey: true })
    await waitFor(() => expect(textarea.value).toBe('hello **world**'))
  })

  it('preserves Enter-to-submit when no emphasis shortcut matches', async () => {
    const onSubmit = vi.fn()
    const textarea = await mount({ onSubmit })
    await userEvent.type(textarea, 'plain text')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toBe('plain text')
  })
})
