/**
 * RTL coverage for FreeFormInput's embedded WorkingDirectoryBadge. [T197]
 *
 * Cases covered:
 *   - Badge renders "Work in Folder" (placeholder) when no workingDirectory prop
 *   - Badge renders the folder name when workingDirectory is provided
 *   - Click the badge trigger → onWorkingDirectoryChange wiring (via "Choose Folder"
 *     button which calls pickDirectory)
 *   - The X-remove button on a recent folder item calls removeRecentWorkingDir
 *   - a11y: no axe violations with the badge rendered
 *
 * Mocks: same self-contained pattern as the rest of the T187/T197 suite.
 * WorkingDirectoryBadge lives inside FreeFormInput; we test it through the
 * rendered DOM (Popover stub always renders children, so PopoverContent is in DOM).
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

// Track pickDirectory calls so we can assert it's wired to the "Choose Folder" button.
const mockPickDirectory = vi.fn()

vi.mock('@/hooks/useDirectoryPicker', () => ({
  useDirectoryPicker: () => ({
    pickDirectory: mockPickDirectory,
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

// Popover stub always renders children — this is intentional: it means PopoverContent
// is always in the DOM so we can assert on the badge's dropdown content without
// needing to simulate a real Radix Popover open/close cycle in happy-dom.
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ServerDirectoryBrowser', () => ({ ServerDirectoryBrowser: () => null }))
vi.mock('@/components/ui/SourceSelectorPopover', () => ({ SourceSelectorPopover: () => null }))
vi.mock('@/components/ui/EditPopover', () => ({ EditPopover: () => null, getEditConfig: () => ({}) }))

// Mock working-directory-history so tests can inject recent folders without
// touching localStorage. The real implementation is tested in its own unit file.
const mockGetRecentWorkingDirs = vi.fn(() => [] as string[])
const mockAddRecentWorkingDir = vi.fn((path: string) => [path])
const mockRemoveRecentWorkingDir = vi.fn((path: string, _ws?: string) => [] as string[])

vi.mock('../working-directory-history', () => ({
  getRecentWorkingDirs: (...args: Parameters<typeof mockGetRecentWorkingDirs>) => mockGetRecentWorkingDirs(...args),
  addRecentWorkingDir: (...args: Parameters<typeof mockAddRecentWorkingDir>) => mockAddRecentWorkingDir(...args),
  removeRecentWorkingDir: (...args: Parameters<typeof mockRemoveRecentWorkingDir>) => mockRemoveRecentWorkingDir(...args),
}))

// ── Imports under test ───────────────────────────────────────────────────────
import { render } from '../../../../../test-utils/render'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { expectNoA11yViolations } from '../../../../../test-utils/a11y'
import { FreeFormInput } from '../FreeFormInput'

// ── Common test setup ────────────────────────────────────────────────────────
beforeEach(() => {
  mockPickDirectory.mockClear()
  mockGetRecentWorkingDirs.mockReturnValue([])
  mockAddRecentWorkingDir.mockImplementation((path: string) => [path])
  mockRemoveRecentWorkingDir.mockImplementation(() => [])

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
describe('FreeFormInput WorkingDirectoryBadge [T197]', () => {
  it('renders the placeholder label when no workingDirectory is provided', async () => {
    const onWorkingDirectoryChange = vi.fn()
    render(<FreeFormInput {...baseProps({ onWorkingDirectoryChange })} />)

    // i18n returns the key; the badge trigger aria-label is the folderName which
    // defaults to "Work in Folder" (hardcoded string, not i18n key).
    const trigger = await screen.findByRole('button', { name: 'Work in Folder' })
    expect(trigger).toBeTruthy()
  })

  it('renders the folder basename when workingDirectory is set', async () => {
    const onWorkingDirectoryChange = vi.fn()
    render(<FreeFormInput {...baseProps({
      workingDirectory: '/home/test/my-project',
      onWorkingDirectoryChange,
    })} />)

    // The badge label is the last path segment (basename) of the directory.
    // FreeFormInput uses getPathBasename from @/lib/platform.
    const trigger = await screen.findByRole('button', { name: 'my-project' })
    expect(trigger).toBeTruthy()
  })

  it('clicking "Choose Folder" button delegates to pickDirectory', async () => {
    const onWorkingDirectoryChange = vi.fn()
    render(<FreeFormInput {...baseProps({ onWorkingDirectoryChange })} />)

    // The "Choose Folder" button is inside PopoverContent (always rendered via
    // our Popover stub). i18n returns the key as the text content.
    const chooseFolderBtn = await screen.findByRole('button', { name: 'chat.chooseFolder' })
    fireEvent.click(chooseFolderBtn)

    await waitFor(() => {
      expect(mockPickDirectory).toHaveBeenCalledTimes(1)
    })
    // The parent prop should NOT be called directly by this button — pickDirectory
    // triggers a native OS dialog; onWorkingDirectoryChange fires after selection.
    expect(onWorkingDirectoryChange).not.toHaveBeenCalled()
  })

  it('clicking the X on a recent folder removes it via removeRecentWorkingDir', async () => {
    // Seed one recent dir so the X button appears in the popover.
    mockGetRecentWorkingDirs.mockReturnValue(['/home/test/old-project'])
    const onWorkingDirectoryChange = vi.fn()

    render(<FreeFormInput {...baseProps({
      workingDirectory: '/home/test/my-project',
      onWorkingDirectoryChange,
    })} />)

    // The remove button has aria-label from the i18n key (key returned as label).
    const removeBtn = await screen.findByRole('button', {
      name: 'workbench.composer.actions.removeRecentFolder',
    })
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(mockRemoveRecentWorkingDir).toHaveBeenCalledWith(
        '/home/test/old-project',
        undefined, // workspaceId not provided in baseProps
      )
    })
    // Removing from list should NOT trigger onWorkingDirectoryChange.
    expect(onWorkingDirectoryChange).not.toHaveBeenCalled()
  })

  it('a11y: no violations with the badge rendered', async () => {
    const onWorkingDirectoryChange = vi.fn()
    const { container } = render(<FreeFormInput {...baseProps({
      workingDirectory: '/home/test/my-project',
      onWorkingDirectoryChange,
    })} />)

    // Wait for async effects (getHomeDir, getGitBranch) to settle.
    await screen.findByRole('button', { name: 'my-project' })

    // Disable `label` (hidden file input) and `button-name` (icon-only X on
    // attachment bubbles) — known pre-existing gaps out of scope for T197.
    await expectNoA11yViolations(container, {
      rules: {
        label: { enabled: false },
        'button-name': { enabled: false },
      },
    })
  })
})
