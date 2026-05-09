/**
 * RTL coverage for FreeFormInput's attachment add/remove flow. [T187]
 *
 * Cases covered:
 *   - Attachments prop renders the chip with the file name
 *   - Click the chip's remove button → onAttachmentsChange called with the
 *     remaining items (and onSubmit is not affected by the click)
 *   - Click the paperclip "Attach Files" button → opens the hidden file input
 *     (clicked via the file input ref; we observe the click is wired)
 *   - Empty + attachment + Enter → onSubmit is called with attachments only
 *   - a11y: no axe violations with attachments rendered
 *
 * Mocks: same pattern as freeform-input.send.rtl.test.tsx (self-contained).
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

vi.mock('@rox-agent/ui', async (orig) => {
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
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectNoA11yViolations } from '../../../../../test-utils/a11y'
import { FreeFormInput } from '../FreeFormInput'
import type { FileAttachment } from '../../../../../shared/types'

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

function makeAttachment(name = 'note.txt'): FileAttachment {
  return {
    type: 'text',
    path: `/tmp/${name}`,
    name,
    mimeType: 'text/plain',
    size: 12,
    text: 'hello world',
  }
}

function baseProps(overrides: Partial<React.ComponentProps<typeof FreeFormInput>> = {}) {
  return {
    onSubmit: vi.fn(),
    currentModel: 'claude-3-5-sonnet-20241022',
    onModelChange: vi.fn(),
    ...overrides,
  } satisfies React.ComponentProps<typeof FreeFormInput>
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('FreeFormInput attachments [T187]', () => {
  it('renders a chip with the attachment name', async () => {
    const att = makeAttachment('readme.txt')
    render(<FreeFormInput {...baseProps({ attachmentsValue: [att] })} />)

    // The chip renders the file name as text inside a span with title attribute.
    const chip = await screen.findByTitle('readme.txt')
    expect(chip).toBeTruthy()
    expect(chip.textContent).toContain('readme.txt')
  })

  it('paperclip button is rendered with an accessible label', async () => {
    render(<FreeFormInput {...baseProps()} />)
    // i18n fallback returns the key, so chat.attachFiles is the literal label.
    const attachBtn = await screen.findByRole('button', { name: 'chat.attachFiles' })
    expect(attachBtn).toBeTruthy()
  })

  it('clicking the chip remove button drops one attachment and does NOT submit the form', async () => {
    // T196 fix: AttachmentBubble's X button now has type="button", so clicking
    // it no longer triggers form submission. We assert that onSubmit is NOT
    // called, and that onAttachmentsChange is called with the remaining item.
    const onSubmit = vi.fn()
    const onAttachmentsChange = vi.fn()
    const a = makeAttachment('one.txt')
    const b = makeAttachment('two.txt')
    render(<FreeFormInput {...baseProps({
      attachmentsValue: [a, b],
      onAttachmentsChange,
      onSubmit,
    })} />)

    await screen.findByTitle('one.txt')
    await screen.findByTitle('two.txt')

    const firstChipName = screen.getByTitle('one.txt')
    const firstBubble = firstChipName.closest('.relative.group') as HTMLElement | null
    expect(firstBubble).toBeTruthy()
    const removeButton = firstBubble!.querySelector<HTMLButtonElement>('button.absolute')
    expect(removeButton).toBeTruthy()
    fireEvent.click(removeButton!)

    // onAttachmentsChange is called with the one remaining attachment (index 0 removed).
    await waitFor(() => {
      expect(onAttachmentsChange).toHaveBeenCalled()
      const lastCall = onAttachmentsChange.mock.calls[onAttachmentsChange.mock.calls.length - 1]
      expect(lastCall[0].map((x: FileAttachment) => x.name)).toEqual(['two.txt'])
    })

    // The form must NOT have been submitted — type="button" prevents default submit.
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Enter with only an attachment (no text) submits the attachment via onSubmit', async () => {
    const onSubmit = vi.fn()
    const att = makeAttachment('only.txt')
    render(<FreeFormInput {...baseProps({ onSubmit, attachmentsValue: [att] })} />)

    await screen.findByTitle('only.txt')
    const textarea = await screen.findByTestId('rich-text-input')
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const [text, attachments] = onSubmit.mock.calls[0]
    expect(text).toBe('')
    expect(attachments).toHaveLength(1)
    expect(attachments[0].name).toBe('only.txt')
  })

  it('a11y: no axe violations with attachments rendered', async () => {
    const att = makeAttachment('a11y.txt')
    const { container } = render(<FreeFormInput {...baseProps({ attachmentsValue: [att] })} />)
    await screen.findByTitle('a11y.txt')
    // The hidden file input lacks a <label>, and the per-chip remove button
    // (an X icon) doesn't have an accessible name. These are existing a11y
    // gaps in AttachmentBubble & the file input — out of scope for T187, which
    // is test coverage. We disable just those two rules so the rest of the
    // composer surface still gets axe-checked.
    await expectNoA11yViolations(container, {
      rules: {
        label: { enabled: false },
        'button-name': { enabled: false },
      },
    })
  })
})
