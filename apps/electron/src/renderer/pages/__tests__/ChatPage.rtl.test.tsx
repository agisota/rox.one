/**
 * RTL a11y + error-boundary smoke tests for ChatPage. [T-chatpage-a11y]
 *
 * Cases covered:
 *   - a11y: no axe violations on the "session not found" branch (simplest
 *     renderable state — avoids spinning up ChatDisplay's entire tree)
 *   - error boundary: ChatPageErrorBoundary catches a render crash and shows
 *     the graceful fallback instead of a blank screen
 *
 * Mocked deps (Electron-specific APIs stubbed so jsdom/happy-dom can render):
 *   - window.electronAPI: getWindowFocusState, onWindowFocusChange,
 *     sessionCommand (ChatPage calls these in effects on mount)
 *   - @/lib/perf (rendererPerf): markSessionSwitch, endSessionSwitch — perf
 *     marks use PerformanceObserver which happy-dom doesn't fully support
 *   - AppShellContext (useAppShellContext + related hooks): heavyweight context
 *     with 40+ callbacks; a minimal vi.fn() stub surface is sufficient
 *   - All heavy child components (ChatDisplay, PanelHeader, SessionMenu,
 *     SessionInfoPopover, RenameDialog, PanelHeaderCenterButton): stubbed so
 *     ChatPage's own structure is tested, not each child's tree
 *   - @config/llm-connections: pure utility, stubbed to avoid config reads
 *   - sonner toast: no-op to prevent floating-UI portal errors
 *   - @/atoms/sessions: real jotai atoms created via vi.hoisted() so they are
 *     available before vitest hoists the vi.mock() calls to file top
 *
 * Axe rule set: wcag2a + wcag2aa + wcag21aa + wcag22aa (the project default
 * defined in src/test-utils/a11y.ts). Expected violations: 0.
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted stubs ─────────────────────────────────────────────────────────────
// vi.hoisted() runs synchronously before ALL vi.mock() factory functions, so
// values created here are available inside mock factories even after hoisting.
const sessionAtoms = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { atom } = require('jotai') as typeof import('jotai')
  const nullAtom = atom(null)
  return {
    loadedSessionsAtom: atom(new Set<string>()),
    sessionMetaMapAtom: atom(new Map()),
    nullAtom,
    // write-only load atoms used by ChatPage effects
    ensureSessionMessagesLoadedAtom: atom(null, async (_get: unknown, _set: unknown, _id: string) => null),
    forceSessionMessagesReloadAtom: atom(null, async (_get: unknown, _set: unknown, _id: string) => null),
  }
})

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Perf module: PerformanceObserver-backed marks don't work in happy-dom.
vi.mock('@/lib/perf', () => ({
  rendererPerf: {
    markSessionSwitch: vi.fn(),
    endSessionSwitch: vi.fn(),
    startSessionSwitch: vi.fn(),
  },
}))

// Heavy child components — stubbed so ChatPage's own structure is exercised.
vi.mock('@/components/app-shell/ChatDisplay', () => ({
  ChatDisplay: () => <div data-testid="chat-display" />,
}))
vi.mock('@/components/app-shell/PanelHeader', () => ({
  PanelHeader: ({ title }: { title?: string }) => (
    <header>
      <h1>{title ?? 'Chat'}</h1>
    </header>
  ),
}))
vi.mock('@/components/app-shell/SessionMenu', () => ({
  SessionMenu: () => null,
}))
vi.mock('@/components/app-shell/SessionInfoPopover', () => ({
  SessionInfoPopover: () => null,
}))
vi.mock('@/components/ui/rename-dialog', () => ({
  RenameDialog: () => null,
}))
vi.mock('@/components/ui/PanelHeaderCenterButton', () => ({
  PanelHeaderCenterButton: ({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) => (
    <button aria-label={ariaLabel ?? 'action'} type="button" />
  ),
}))

// Dropdown and styled-dropdown: not on the primary render path for the
// "session not found" branch, but imported at module level.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/styled-dropdown', () => ({
  StyledDropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  StyledDropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  StyledDropdownMenuSeparator: () => null,
}))

// LLM-connections config helpers: pure functions stubbed to return safe defaults.
vi.mock('@config/llm-connections', () => ({
  resolveEffectiveConnectionSlug: () => null,
  isSessionConnectionUnavailable: () => false,
}))

// Sonner toast: avoid floating-UI portal attachment issues in happy-dom.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Jotai session atoms: use atoms created by vi.hoisted() above so that
// useAtomValue(loadedSessionsAtom) / useAtomValue(sessionMetaMapAtom) work
// (plain objects with { init: ... } are not valid jotai atoms).
vi.mock('@/atoms/sessions', () => ({
  loadedSessionsAtom: sessionAtoms.loadedSessionsAtom,
  sessionMetaMapAtom: sessionAtoms.sessionMetaMapAtom,
  // sessionAtomFamily is called by useSession in AppShellContext; return
  // a stable null atom since useSession is mocked to return null anyway.
  sessionAtomFamily: vi.fn(() => sessionAtoms.nullAtom),
  ensureSessionMessagesLoadedAtom: sessionAtoms.ensureSessionMessagesLoadedAtom,
  forceSessionMessagesReloadAtom: sessionAtoms.forceSessionMessagesReloadAtom,
}))

// AppShellContext: return a minimal stub that satisfies all destructured fields.
// ChatPage spreads ~25 fields from useAppShellContext(); all callbacks are
// vi.fn() no-ops. useSession is mocked to return null so ChatPage renders its
// "session no longer exists" fallback — the simplest, most accessible branch.
const mockAppShellContext = {
  activeWorkspaceId: 'ws-1',
  activeWorkspaceSlug: 'ws-1',
  llmConnections: [],
  workspaceDefaultLlmConnection: undefined,
  workspaces: [],
  pendingPermissions: new Map(),
  pendingCredentials: new Map(),
  getDraft: vi.fn(() => ''),
  getDraftAttachmentRefs: vi.fn(() => []),
  hydrateDraftAttachments: vi.fn(() => Promise.resolve([])),
  enabledSources: [],
  skills: [],
  labels: [],
  sessionOptions: new Map(),
  sessionStatuses: [],
  enabledModes: [],
  isCompactMode: false,
  isFocusedPanel: true,
  sessionListSearchQuery: '',
  isSearchModeActive: false,
  chatDisplayRef: { current: null },
  refreshLlmConnections: vi.fn(),
  onCreateSession: vi.fn(),
  onSendMessage: vi.fn(),
  onRenameSession: vi.fn(),
  onFlagSession: vi.fn(),
  onUnflagSession: vi.fn(),
  onArchiveSession: vi.fn(),
  onUnarchiveSession: vi.fn(),
  onMarkSessionRead: vi.fn(),
  onMarkSessionUnread: vi.fn(),
  onSetActiveViewingSession: vi.fn(),
  onSessionStatusChange: vi.fn(),
  onDeleteSession: vi.fn(() => Promise.resolve(true)),
  onRespondToPermission: vi.fn(),
  onRespondToCredential: vi.fn(),
  onOpenFile: vi.fn(),
  onOpenUrl: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenKeyboardShortcuts: vi.fn(),
  onOpenStoredUserPreferences: vi.fn(),
  onReset: vi.fn(),
  onSessionOptionsChange: vi.fn(),
  onInputChange: vi.fn(),
  onAttachmentsChange: vi.fn(),
  onSessionSourcesChange: vi.fn(),
  onSessionLabelsChange: vi.fn(),
  onChatMatchInfoChange: vi.fn(),
}

vi.mock('@/context/AppShellContext', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    useAppShellContext: () => mockAppShellContext,
    useSessionOptionsFor: () => ({
      options: { thinkingLevel: 'none', permissionMode: 'auto' },
      setOption: vi.fn(),
      setOptions: vi.fn(),
      setPermissionMode: vi.fn(),
      isSafeModeActive: () => false,
    }),
    // Return null → ChatPage renders the "session no longer exists" fallback.
    useSession: () => null,
    // These hooks call useAppShellContext internally; mock them directly so
    // they don't try to read from a real context provider.
    usePendingPermission: () => undefined,
    usePendingCredential: () => undefined,
  }
})

// ── Imports under test ────────────────────────────────────────────────────────
// NOTE: relative path — test-utils is at src/test-utils/, outside the '@' alias
// (which points to src/renderer/). From src/renderer/pages/__tests__/ that is
// three levels up to src/: ../../../test-utils/
import { render } from '../../../test-utils/render'
import { cleanup, screen } from '@testing-library/react'
import { expectNoA11yViolations } from '../../../test-utils/a11y'
import ChatPage from '../ChatPage'
import { ChatPageErrorBoundary } from '../ChatPageErrorBoundary'

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Extend the baseline vitest-setup stub (src/test-utils/vitest-setup.ts) with
  // the ChatPage-specific electronAPI surface it calls on mount.
  const api = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI
  api.getWindowFocusState = () => Promise.resolve(true)
  api.onWindowFocusChange = (_cb: (focused: boolean) => void) => () => {}
  api.sessionCommand = () => Promise.resolve({ success: true })
  api.openUrl = () => Promise.resolve()
  api.searchFiles = () => Promise.resolve([])
})

afterEach(() => {
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChatPage a11y [T-chatpage-a11y]', () => {
  it('renders without axe violations (session-not-found branch)', async () => {
    // useSession returns null + sessionMetaMapAtom is empty → ChatPage renders
    // the "session no longer exists" fallback: a header + icon + paragraph.
    // That branch is simpler than the full chat UI and reliably renderable
    // without ChatDisplay's deep tree.
    const { container } = render(<ChatPage sessionId="test-session-id" />)

    // Confirm something rendered (not a blank screen).
    expect(container.firstChild).not.toBeNull()

    // Primary a11y assertion: WCAG 2.x (2a + 2aa + 21aa + 22aa) — 0 violations.
    await expectNoA11yViolations(container)
  })
})

// ── Error boundary tests ──────────────────────────────────────────────────────

// A component that always throws on render — used to exercise the boundary.
function AlwaysCrash(): React.ReactElement {
  throw new Error('Simulated ChatPage crash')
}

describe('ChatPageErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ChatPageErrorBoundary>
        <div data-testid="child">OK</div>
      </ChatPageErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('shows graceful fallback (not a blank screen) when child crashes', () => {
    // Suppress expected React error boundary console.error output in test log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ChatPageErrorBoundary>
        <AlwaysCrash />
      </ChatPageErrorBoundary>,
    )

    // Fallback must expose a reload affordance so the user is not stuck.
    const reloadBtn = screen.getByRole('button', { name: /reload/i })
    expect(reloadBtn).toBeTruthy()

    spy.mockRestore()
  })

  it('fallback has no axe violations', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { container } = render(
      <ChatPageErrorBoundary>
        <AlwaysCrash />
      </ChatPageErrorBoundary>,
    )

    await expectNoA11yViolations(container)

    spy.mockRestore()
  })
})
