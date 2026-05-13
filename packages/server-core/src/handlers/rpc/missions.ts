/**
 * Mission admin RPC handlers (M.8 T243-rpc).
 *
 * Exposes the four channels declared in `RPC_CHANNELS.missions`:
 *
 *  - `missions.create`        — owner-on-workspace gated. Mints a new
 *                               `MissionId` via the scheduler and returns
 *                               the fresh `MissionRecord`.
 *  - `missions.dispatchEvent` — owner-on-workspace gated. Forwards a
 *                               `SchedulerInputEvent` to the scheduler.
 *                               Surface errors come back as a structured
 *                               `{error, reason}` envelope.
 *  - `missions.get`           — read-permission gated. Returns the
 *                               `MissionRecord` or `{error: 'mission-not-found'}`.
 *  - `missions.list`          — read-permission gated. Returns an array
 *                               of `MissionRecord` filtered by optional
 *                               `kinds` from `MissionListFilter`.
 *
 * Owner-gating mirrors the `roles.ts` (T227) pattern: callers with a
 * `global` owner grant pass anywhere; otherwise the caller must hold an
 * owner grant whose `scopeKind === 'workspace'` and `scopeId` matches
 * the request context's `workspaceId`. Read handlers require that the
 * caller's `permittedWorkspacesForUser` includes the request scope
 * (workspace id or the global sentinel `'*'`).
 *
 * Hosts that have not adopted the M.8 mission surface may leave
 * `HandlerDeps.missionScheduler` undefined. All four channels then
 * respond with `{error: 'missions-not-configured', reason: 'no-mission-scheduler'}`.
 */

import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import type { RequestContext } from '../../transport/types'
import { isMissionId, type MissionId } from '../../missions/mission-id.ts'
import {
  MISSION_STATE_KINDS,
  type MissionStateKind,
} from '../../missions/state.ts'
import type { MissionListFilter } from '../../missions/mission-store.ts'
import type { SchedulerInputEvent } from '../../missions/scheduler.ts'

export const CORE_HANDLED_CHANNELS = [
  RPC_CHANNELS.missions.CREATE,
  RPC_CHANNELS.missions.DISPATCH_EVENT,
  RPC_CHANNELS.missions.GET,
  RPC_CHANNELS.missions.LIST,
] as const

type ErrorResult = { error: string; reason: string }

const VALID_EVENT_KINDS = new Set<SchedulerInputEvent['kind']>([
  'Start',
  'Pause',
  'Resume',
  'AwaitInput',
  'ProvideInput',
  'Complete',
  'Fail',
  'Cancel',
])

const VALID_STATE_KINDS = new Set<MissionStateKind>(MISSION_STATE_KINDS)

/**
 * Owner-gate check used by every mutating handler. The caller may
 * mutate when they hold:
 *  - a `'global'` owner grant, OR
 *  - a `workspace`-scoped owner grant whose `scopeId` matches the
 *    request context's `workspaceId`.
 *
 * Returns `null` on success, or an `{error, reason}` ErrorResult.
 */
async function assertOwnerOnScope(
  deps: HandlerDeps,
  ctx: RequestContext,
): Promise<ErrorResult | null> {
  if (!ctx.userId) {
    return { error: 'permission-denied', reason: 'no-user' }
  }
  if (!deps.rbacResolver) {
    return { error: 'rbac-not-configured', reason: 'no-rbac-resolver' }
  }
  const ownerGrants = await deps.rbacResolver.ownerGrantsForUser(ctx.userId)
  const allowed = ownerGrants.some((grant) => {
    if (grant.scopeKind === 'global') return true
    if (grant.scopeKind === 'workspace' && grant.scopeId === ctx.workspaceId) {
      return true
    }
    return false
  })
  if (!allowed) {
    return { error: 'permission-denied', reason: 'no-owner-grant' }
  }
  return null
}

/**
 * Read-permission gate. The caller must be authenticated AND
 * (a) hold a global grant (`'*'` in `permittedWorkspaces`), OR
 * (b) hold any grant that includes the request's `workspaceId`.
 *
 * Hosts without an `rbacResolver` reject reads — the M.8 surface is
 * not safe to expose unauthenticated.
 */
async function assertReadOnScope(
  deps: HandlerDeps,
  ctx: RequestContext,
): Promise<ErrorResult | null> {
  if (!ctx.userId) {
    return { error: 'permission-denied', reason: 'no-user' }
  }
  if (!deps.rbacResolver) {
    return { error: 'rbac-not-configured', reason: 'no-rbac-resolver' }
  }
  const permitted = await deps.rbacResolver.permittedWorkspacesForUser(ctx.userId)
  // Global sentinel grants read on any workspace, including null.
  if (permitted.includes('*')) return null
  if (ctx.workspaceId && permitted.includes(ctx.workspaceId)) return null
  return { error: 'permission-denied', reason: 'no-read-grant' }
}

export function registerMissionsCoreHandlers(server: RpcServer, deps: HandlerDeps): void {
  // ----------------------------------------------------------------------
  // missions.create — owner-gated. Returns the freshly minted record.
  // ----------------------------------------------------------------------
  server.handle(RPC_CHANNELS.missions.CREATE, async (ctx: RequestContext) => {
    const denied = await assertOwnerOnScope(deps, ctx)
    if (denied) return denied
    if (!deps.missionScheduler) {
      return { error: 'missions-not-configured', reason: 'no-mission-scheduler' }
    }
    const record = await deps.missionScheduler.create()
    return { ok: true, mission: record }
  })

  // ----------------------------------------------------------------------
  // missions.dispatchEvent — owner-gated. Returns the post-transition
  // record or a structured error (illegal/terminal/not-found).
  // ----------------------------------------------------------------------
  server.handle(
    RPC_CHANNELS.missions.DISPATCH_EVENT,
    async (
      ctx: RequestContext,
      input: { id: MissionId; event: SchedulerInputEvent },
    ) => {
      // Validate the input envelope before the permission check so the
      // caller gets a useful invalid-argument response for malformed
      // payloads. Permission check still runs second to avoid leaking
      // auth state through validation timing.
      if (!input || typeof input !== 'object') {
        return { error: 'invalid-argument', reason: 'invalid-input' }
      }
      if (!isMissionId(input.id)) {
        return { error: 'invalid-argument', reason: 'invalid-mission-id' }
      }
      if (!input.event || typeof input.event !== 'object') {
        return { error: 'invalid-argument', reason: 'invalid-event' }
      }
      if (!VALID_EVENT_KINDS.has(input.event.kind)) {
        return { error: 'invalid-argument', reason: 'invalid-event-kind' }
      }

      const denied = await assertOwnerOnScope(deps, ctx)
      if (denied) return denied
      if (!deps.missionScheduler) {
        return { error: 'missions-not-configured', reason: 'no-mission-scheduler' }
      }
      const result = await deps.missionScheduler.dispatchEvent(input.id, input.event)
      if (!result.ok) {
        if (result.error.kind === 'mission_not_found') {
          return { error: 'mission-not-found', reason: result.error.id }
        }
        return {
          error: 'invalid-transition',
          reason: result.error.kind,
          from: result.error.from,
          event: result.error.event,
        }
      }
      return { ok: true, mission: result.value }
    },
  )

  // ----------------------------------------------------------------------
  // missions.get — read-permission gated. Returns the record or a
  // structured not-found.
  // ----------------------------------------------------------------------
  server.handle(
    RPC_CHANNELS.missions.GET,
    async (ctx: RequestContext, id: MissionId) => {
      if (!isMissionId(id)) {
        return { error: 'invalid-argument', reason: 'invalid-mission-id' }
      }
      const denied = await assertReadOnScope(deps, ctx)
      if (denied) return denied
      if (!deps.missionScheduler) {
        return { error: 'missions-not-configured', reason: 'no-mission-scheduler' }
      }
      const record = await deps.missionScheduler.get(id)
      if (!record) {
        return { error: 'mission-not-found', reason: id }
      }
      return { ok: true, mission: record }
    },
  )

  // ----------------------------------------------------------------------
  // missions.list — read-permission gated. Returns the filtered records.
  // ----------------------------------------------------------------------
  server.handle(
    RPC_CHANNELS.missions.LIST,
    async (ctx: RequestContext, filter?: MissionListFilter) => {
      // Validate the optional filter envelope.
      const normalizedFilter: MissionListFilter = {}
      if (filter !== undefined && filter !== null) {
        if (typeof filter !== 'object') {
          return { error: 'invalid-argument', reason: 'invalid-filter' }
        }
        if (filter.kinds !== undefined) {
          if (!Array.isArray(filter.kinds)) {
            return { error: 'invalid-argument', reason: 'invalid-kinds' }
          }
          for (const k of filter.kinds) {
            if (!VALID_STATE_KINDS.has(k as MissionStateKind)) {
              return { error: 'invalid-argument', reason: 'invalid-kind' }
            }
          }
          ;(normalizedFilter as { kinds: readonly MissionStateKind[] }).kinds = filter.kinds
        }
      }

      const denied = await assertReadOnScope(deps, ctx)
      if (denied) return denied
      if (!deps.missionScheduler) {
        return { error: 'missions-not-configured', reason: 'no-mission-scheduler' }
      }
      const missions = await deps.missionScheduler.list(normalizedFilter)
      return { ok: true, missions }
    },
  )
}
