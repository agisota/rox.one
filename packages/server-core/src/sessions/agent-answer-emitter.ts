/**
 * AgentAnswerEmitter — PZD-18 Step 2
 *
 * Builds, validates, and dispatches an AgentAnswerPackage on every agent
 * turn completion. Backwards-compatible: existing text/code turns get
 * kind='text'|'code'; kind='design' is a placeholder for Step 3.
 *
 * Rate-limit: 3 AAPs per second per sessionId. The 4th call within the same
 * 1-second window throws a backpressure error.
 */

import { AgentAnswerPackageSchema } from '@rox-one/agent-contract'
import type { AgentAnswerPackage } from '@rox-one/agent-contract'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TurnContext {
  /** Identifier of the session acting as the agent for this turn. */
  agentId: string
  sessionId: string
  /** UUID v4/v7 for this turn. */
  turnId: string
}

export interface AgentOutput {
  /** Full text output from the agent for this turn. */
  text: string
}

/** Minimal event-bus interface required by AgentAnswerEmitter. */
export interface AAPEventBus {
  emit(actorId: string, payload: AgentAnswerPackage): void
}

export interface AgentAnswerEmitterOptions {
  bus: AAPEventBus
  /**
   * Internal test hook: when true the emitter intentionally builds an
   * invalid payload to exercise the zod rejection path.
   */
  _forceInvalidForTest?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum AAPs allowed per session within the rolling window. */
const RATE_LIMIT = 3
/** Rolling window duration in milliseconds. */
const RATE_WINDOW_MS = 1_000

// ── Rate-limit window tracking ────────────────────────────────────────────────

interface WindowEntry {
  count: number
  windowStart: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Detect the leading code-fence language from a markdown string. */
function detectCodeFence(text: string): { isCode: true; language: string } | { isCode: false } {
  const match = /^```([a-zA-Z0-9_+-]*)/.exec(text.trimStart())
  if (!match) return { isCode: false }
  const lang = (match[1] ?? '').trim()
  return { isCode: true, language: lang.length > 0 ? lang : 'plaintext' }
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class AgentAnswerEmitter {
  private readonly bus: AAPEventBus
  private readonly forceInvalid: boolean
  private readonly rateLimitWindows = new Map<string, WindowEntry>()

  constructor(options: AgentAnswerEmitterOptions) {
    this.bus = options.bus
    this.forceInvalid = options._forceInvalidForTest ?? false
  }

  async emit(turn: TurnContext, output: AgentOutput): Promise<AgentAnswerPackage> {
    // ── Rate limit check ─────────────────────────────────────────────────────
    this.checkRateLimit(turn.sessionId)

    // ── Detect kind ──────────────────────────────────────────────────────────
    const fence = detectCodeFence(output.text)
    const kind = fence.isCode ? ('code' as const) : ('text' as const)

    // ── Build payload ────────────────────────────────────────────────────────
    const payload =
      kind === 'code' && fence.isCode
        ? { kind: 'code' as const, language: fence.language, text: output.text }
        : { kind: 'text' as const, text: output.text }

    // Build raw AAP object (or intentionally broken one for test path)
    const raw = this.forceInvalid
      ? { agentId: '', sessionId: '', turnId: 'not-a-uuid', kind, payload, createdAt: 'bad' }
      : {
          agentId: turn.agentId,
          sessionId: turn.sessionId,
          turnId: turn.turnId,
          kind,
          payload,
          createdAt: new Date().toISOString(),
        }

    // ── Zod validation ───────────────────────────────────────────────────────
    const pkg = AgentAnswerPackageSchema.parse(raw)

    // ── Dispatch ─────────────────────────────────────────────────────────────
    this.bus.emit(turn.sessionId, pkg)

    return pkg
  }

  private checkRateLimit(sessionId: string): void {
    const now = Date.now()
    const entry = this.rateLimitWindows.get(sessionId)

    if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
      this.rateLimitWindows.set(sessionId, { count: 1, windowStart: now })
      return
    }

    if (entry.count >= RATE_LIMIT) {
      throw new Error(
        `[AgentAnswerEmitter] backpressure: session ${sessionId} exceeded ${RATE_LIMIT} AAPs/sec`
      )
    }

    entry.count += 1
  }
}
