/**
 * AgentAnswerRouter — PZD-18 step 3
 *
 * Routes an AgentAnswerPackage (AAP) by kind:
 *   text | code → passthrough (chat-display handles via existing path)
 *   design      → calls handleOpenWithContext with the embedded OpenDesignRequest
 *   mixed       → recurses over parts serially (FIFO)
 */

import type { IpcMain } from 'electron'
import type { AgentAnswerPackage } from '@rox-one/agent-contract'
import { handleOpenWithContext } from './rox-design-ipc'

// ── Result types ──────────────────────────────────────────────────────────────

export interface RouteResult {
  status: 'opened-design' | 'passthrough' | 'failed' | 'mixed-completed'
  details?: unknown
}

type OpenWithContext = typeof handleOpenWithContext

// Internal payload shapes (mirrors agent-contract without re-exporting)
type PrimitivePayload =
  | { kind: 'text'; text: string }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'design'; request: unknown }

type MixedPayload = { kind: 'mixed'; parts: ReadonlyArray<PrimitivePayload | MixedPayload> }

type Payload = PrimitivePayload | MixedPayload

// ── Router ────────────────────────────────────────────────────────────────────

export class AgentAnswerRouter {
  constructor(private readonly openWithContext: OpenWithContext = handleOpenWithContext) {}

  /**
   * Route a validated AgentAnswerPackage.
   * For `mixed` packages the top-level `payload` field is used directly.
   */
  async route(aap: AgentAnswerPackage): Promise<RouteResult> {
    return this._routePayload(aap.payload as Payload)
  }

  private async _routePayload(payload: Payload): Promise<RouteResult> {
    if (payload.kind === 'text' || payload.kind === 'code') {
      return { status: 'passthrough' }
    }

    if (payload.kind === 'design') {
      const result = await this.openWithContext(payload.request)
      if (result.status === 'opened') {
        return { status: 'opened-design', details: result }
      }
      return { status: 'failed', details: result }
    }

    // mixed — recurse serially
    return this._routeMixed(payload)
  }

  private async _routeMixed(payload: MixedPayload): Promise<RouteResult> {
    let failedParts = 0

    for (const part of payload.parts) {
      const result = await this._routePayload(part as Payload)
      if (result.status === 'failed') {
        failedParts++
      }
    }

    return { status: 'mixed-completed', details: { failedParts } }
  }
}

// ── IPC registration ──────────────────────────────────────────────────────────

/**
 * Register the `agent-answer:dispatch` IPC handler.
 * Step 2 (server-core emitter) will invoke this via IPC;
 * a follow-up can refactor to an in-process event bus.
 */
export function registerAgentAnswerRouter(
  ipcMain: Pick<IpcMain, 'handle'>,
  router: AgentAnswerRouter,
): void {
  ipcMain.handle('agent-answer:dispatch', (_event, aap: AgentAnswerPackage) =>
    router.route(aap),
  )
}
