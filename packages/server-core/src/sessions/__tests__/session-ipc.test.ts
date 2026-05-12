import { beforeEach, describe, expect, it } from 'bun:test'
import type { EventSink } from '@rox-agent/server-core/transport'
import type { Logger } from '@rox-agent/server-core/runtime'
import { RPC_CHANNELS, type SessionEvent, type UnreadSummary } from '@rox-agent/shared/protocol'
import type { LoadedSource } from '@rox-agent/shared/sources'
import type { LoadedSkill } from '@rox-agent/shared/skills'
import type { ThemeOverrides } from '@rox-agent/shared/config'
import { SessionIPC } from '../session-ipc'

// Per-helper unit tests for the IPC concern extracted from SessionManager
// (Slice 3 composition, 1/3). The helper now has a coherent broadcast surface
// that is testable in isolation — these tests assert event shape, channel
// routing, and the no-event-sink short-circuit for each broadcast method.

interface CapturedCall {
  channel: string
  target: { to: string; workspaceId?: string }
  args: unknown[]
}

function buildSilentLogger(): Logger {
  const noop = () => {}
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    trace: noop,
    fatal: noop,
  } as unknown as Logger
}

function buildHarness(opts: { unread?: UnreadSummary } = {}) {
  const calls: CapturedCall[] = []
  const sink: EventSink = (channel, target, ...args) => {
    calls.push({ channel, target: target as CapturedCall['target'], args })
  }
  const badgeUpdates: number[] = []
  const ipc = new SessionIPC({
    getLogger: () => buildSilentLogger(),
    getUnreadSummary: () =>
      opts.unread ?? ({ totalUnreadSessions: 0, byWorkspace: {}, hasUnreadByWorkspace: {} } as UnreadSummary),
    updateBadgeCount: (n) => badgeUpdates.push(n),
  })
  return { ipc, calls, sink, badgeUpdates }
}

describe('SessionIPC broadcast surface', () => {
  let h: ReturnType<typeof buildHarness>

  beforeEach(() => {
    h = buildHarness()
  })

  it('hasBrowserPaneManager returns false until set, true after', () => {
    expect(h.ipc.hasBrowserPaneManager()).toBe(false)
    h.ipc.setBrowserPaneManager({} as never)
    expect(h.ipc.hasBrowserPaneManager()).toBe(true)
  })

  describe('broadcastSourcesChanged', () => {
    it('emits CHANGED on the sources channel with workspace target and payload', () => {
      h.ipc.setEventSink(h.sink)
      const sources = [{ config: { slug: 's1' } }] as unknown as LoadedSource[]
      h.ipc.broadcastSourcesChanged('ws1', sources)
      expect(h.calls).toHaveLength(1)
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.sources.CHANGED,
        target: { to: 'workspace', workspaceId: 'ws1' },
        args: ['ws1', sources],
      })
    })

    it('is a no-op when no event sink is wired', () => {
      h.ipc.broadcastSourcesChanged('ws1', [])
      expect(h.calls).toHaveLength(0)
    })
  })

  describe('broadcastStatusesChanged', () => {
    it('emits CHANGED on the statuses channel with workspace target', () => {
      h.ipc.setEventSink(h.sink)
      h.ipc.broadcastStatusesChanged('ws-x')
      expect(h.calls).toEqual([
        {
          channel: RPC_CHANNELS.statuses.CHANGED,
          target: { to: 'workspace', workspaceId: 'ws-x' },
          args: ['ws-x'],
        },
      ])
    })

    it('no-op without sink', () => {
      h.ipc.broadcastStatusesChanged('ws-x')
      expect(h.calls).toHaveLength(0)
    })
  })

  describe('broadcastLabelsChanged', () => {
    it('emits CHANGED on labels channel scoped to workspace', () => {
      h.ipc.setEventSink(h.sink)
      h.ipc.broadcastLabelsChanged('ws-l')
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.labels.CHANGED,
        target: { to: 'workspace', workspaceId: 'ws-l' },
        args: ['ws-l'],
      })
    })
  })

  describe('broadcastAutomationsChanged', () => {
    it('emits CHANGED on automations channel scoped to workspace', () => {
      h.ipc.setEventSink(h.sink)
      h.ipc.broadcastAutomationsChanged('ws-a')
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.automations.CHANGED,
        target: { to: 'workspace', workspaceId: 'ws-a' },
        args: ['ws-a'],
      })
    })
  })

  describe('broadcastAppThemeChanged', () => {
    it('emits APP_CHANGED globally with the theme payload', () => {
      h.ipc.setEventSink(h.sink)
      const theme = { mode: 'dark' } as unknown as ThemeOverrides
      h.ipc.broadcastAppThemeChanged(theme)
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.theme.APP_CHANGED,
        target: { to: 'all' },
        args: [theme],
      })
    })

    it('emits null payload when theme cleared', () => {
      h.ipc.setEventSink(h.sink)
      h.ipc.broadcastAppThemeChanged(null)
      expect(h.calls[0].args).toEqual([null])
    })
  })

  describe('broadcastLlmConnectionsChanged', () => {
    it('emits CHANGED globally with no payload', () => {
      h.ipc.setEventSink(h.sink)
      h.ipc.broadcastLlmConnectionsChanged()
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.llmConnections.CHANGED,
        target: { to: 'all' },
        args: [],
      })
    })
  })

  describe('broadcastSkillsChanged', () => {
    it('emits CHANGED with workspace target and skills payload', () => {
      h.ipc.setEventSink(h.sink)
      const skills = [{ slug: 'skill-a' }, { slug: 'skill-b' }] as unknown as LoadedSkill[]
      h.ipc.broadcastSkillsChanged('ws-s', skills)
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.skills.CHANGED,
        target: { to: 'workspace', workspaceId: 'ws-s' },
        args: ['ws-s', skills],
      })
    })
  })

  describe('broadcastDefaultPermissionsChanged', () => {
    it('emits DEFAULTS_CHANGED globally with null payload', () => {
      h.ipc.setEventSink(h.sink)
      h.ipc.broadcastDefaultPermissionsChanged()
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.permissions.DEFAULTS_CHANGED,
        target: { to: 'all' },
        args: [null],
      })
    })
  })

  describe('emitUnreadSummaryChanged', () => {
    it('updates host badge count and broadcasts the summary to all', () => {
      const summary: UnreadSummary = {
        totalUnreadSessions: 3,
        byWorkspace: { ws1: 2, ws2: 1 },
        hasUnreadByWorkspace: { ws1: true, ws2: true },
      }
      const harness = buildHarness({ unread: summary })
      harness.ipc.setEventSink(harness.sink)
      harness.ipc.emitUnreadSummaryChanged()

      expect(harness.badgeUpdates).toEqual([3])
      expect(harness.calls).toEqual([
        {
          channel: RPC_CHANNELS.sessions.UNREAD_SUMMARY_CHANGED,
          target: { to: 'all' },
          args: [summary],
        },
      ])
    })

    it('still updates badge even when no event sink is wired', () => {
      const summary: UnreadSummary = {
        totalUnreadSessions: 7,
        byWorkspace: {},
        hasUnreadByWorkspace: {},
      }
      const harness = buildHarness({ unread: summary })
      // Note: no setEventSink call.
      harness.ipc.emitUnreadSummaryChanged()
      expect(harness.badgeUpdates).toEqual([7])
      expect(harness.calls).toHaveLength(0)
    })
  })

  describe('sendEvent', () => {
    it('emits EVENT on the sessions channel with workspace target', () => {
      h.ipc.setEventSink(h.sink)
      const event: SessionEvent = { type: 'complete', sessionId: 's1' } as SessionEvent
      h.ipc.sendEvent(event, 'ws1')
      expect(h.calls[0]).toEqual({
        channel: RPC_CHANNELS.sessions.EVENT,
        target: { to: 'workspace', workspaceId: 'ws1' },
        args: [event],
      })
    })

    it('drops the event if workspaceId is missing', () => {
      h.ipc.setEventSink(h.sink)
      const event: SessionEvent = { type: 'complete', sessionId: 's1' } as SessionEvent
      h.ipc.sendEvent(event)
      expect(h.calls).toHaveLength(0)
    })
  })
})
