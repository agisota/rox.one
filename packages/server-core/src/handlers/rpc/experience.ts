/**
 * Experience Layer server emit RPC handlers (M.9 T272).
 *
 * Exposes three channels that mint `ExperienceState` events for the T271
 * renderer hook to consume via subscription:
 *
 *  - `experience.emit`        — owner-gated. Hosts push a fresh
 *                               `ExperienceState<T>` snapshot for an
 *                               `actorId`; the handler fans it out via the
 *                               in-memory bus and broadcasts an
 *                               `experience.event` push to subscribed
 *                               renderers through `RpcServer.push`.
 *  - `experience.subscribe`   — read-gated. Accepts an `actorId` and
 *                               returns `{ok, subscriptionId}`.
 *  - `experience.unsubscribe` — releases a subscription id. Idempotent —
 *                               unknown ids return `{ok: true, released: false}`.
 *
 * The handler is STANDALONE for T272 — channel strings are local to this
 * module and the handler is NOT yet registered through `index.ts`. T273
 * (ipc-bridge) folds the channels into `RPC_CHANNELS.experience` and the
 * routing table, then adds the registration to `registerCoreRpcHandlers`.
 *
 * Owner-gating mirrors `roles.ts` / `missions.ts`: global owner grants
 * pass anywhere; otherwise the caller must hold an owner grant whose
 * `scopeKind === 'workspace'` and `scopeId` matches the request scope.
 * Read-gating mirrors `missions.assertReadOnScope`.
 */

import type { ExperienceState } from '@rox-one/shared/experience-layer'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import type { RequestContext } from '../../transport/types'
import { createExperienceBus, type ExperienceBus, type ExperienceListener } from './experience-bus'

export const EXPERIENCE_CHANNELS = {
  EMIT: 'experience.emit',
  SUBSCRIBE: 'experience.subscribe',
  UNSUBSCRIBE: 'experience.unsubscribe',
  /** Push channel — server → clients carrying `{actorId, state}` payloads. */
  EVENT: 'experience.event',
} as const

export const CORE_HANDLED_CHANNELS = [
  EXPERIENCE_CHANNELS.EMIT,
  EXPERIENCE_CHANNELS.SUBSCRIBE,
  EXPERIENCE_CHANNELS.UNSUBSCRIBE,
] as const

type ErrorResult = { error: string; reason: string }

interface EmitInput<T = unknown> { readonly actorId: string; readonly state: ExperienceState<T> }
interface SubscribeInput { readonly actorId: string }
interface UnsubscribeInput { readonly subscriptionId: string }

export interface RegisterExperienceOptions {
  /** Optional bus override; default constructs a fresh in-memory bus. */
  readonly bus?: ExperienceBus
}

async function assertOwnerOnScope(deps: HandlerDeps, ctx: RequestContext): Promise<ErrorResult | null> {
  if (!ctx.userId) return { error: 'permission-denied', reason: 'no-user' }
  if (!deps.rbacResolver) return { error: 'rbac-not-configured', reason: 'no-rbac-resolver' }
  const grants = await deps.rbacResolver.ownerGrantsForUser(ctx.userId)
  const allowed = grants.some((g) =>
    g.scopeKind === 'global' || (g.scopeKind === 'workspace' && g.scopeId === ctx.workspaceId),
  )
  return allowed ? null : { error: 'permission-denied', reason: 'no-owner-grant' }
}

async function assertReadOnScope(deps: HandlerDeps, ctx: RequestContext): Promise<ErrorResult | null> {
  if (!ctx.userId) return { error: 'permission-denied', reason: 'no-user' }
  if (!deps.rbacResolver) return { error: 'rbac-not-configured', reason: 'no-rbac-resolver' }
  const permitted = await deps.rbacResolver.permittedWorkspacesForUser(ctx.userId)
  if (permitted.includes('*')) return null
  if (ctx.workspaceId && permitted.includes(ctx.workspaceId)) return null
  return { error: 'permission-denied', reason: 'no-read-grant' }
}

/**
 * Validates an `ExperienceState<T>` envelope. We don't call the kernel's
 * id parser here so hosts can pass branded values unchanged; only typing
 * slop (missing kind, wrong kind, missing id) is rejected.
 */
function isExperienceState(value: unknown): value is ExperienceState<unknown> {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  const kind = c.kind
  if (typeof kind !== 'string') return false
  if (kind !== 'idle' && kind !== 'loading' && kind !== 'ready' && kind !== 'error' && kind !== 'mutating') {
    return false
  }
  return typeof c.id === 'string' && c.id.length > 0
}

export function registerExperienceCoreHandlers(
  server: RpcServer,
  deps: HandlerDeps,
  options: RegisterExperienceOptions = {},
): ExperienceBus {
  const bus = options.bus ?? createExperienceBus()
  // subscriptionId -> unwire fn (releases the bus slot AND any wiring).
  const pushUnwirers = new Map<string, () => void>()

  // experience.emit — owner-gated; validates payload; fans out via bus.
  server.handle(EXPERIENCE_CHANNELS.EMIT, async (ctx: RequestContext, input: EmitInput<unknown>) => {
    if (!input || typeof input !== 'object') return { error: 'invalid-argument', reason: 'invalid-input' }
    if (typeof input.actorId !== 'string' || input.actorId.length === 0) {
      return { error: 'invalid-argument', reason: 'invalid-actor-id' }
    }
    if (!isExperienceState(input.state)) return { error: 'invalid-argument', reason: 'invalid-state' }
    const denied = await assertOwnerOnScope(deps, ctx)
    if (denied) return denied
    const delivered = bus.emit(input.actorId, input.state)
    return { ok: true, delivered }
  })

  // experience.subscribe — read-gated; returns opaque subscription id.
  server.handle(EXPERIENCE_CHANNELS.SUBSCRIBE, async (ctx: RequestContext, input: SubscribeInput) => {
    if (!input || typeof input !== 'object') return { error: 'invalid-argument', reason: 'invalid-input' }
    if (typeof input.actorId !== 'string' || input.actorId.length === 0) {
      return { error: 'invalid-argument', reason: 'invalid-actor-id' }
    }
    const denied = await assertReadOnScope(deps, ctx)
    if (denied) return denied
    const clientId = ctx.clientId
    const listener: ExperienceListener<unknown> = (state) => {
      // Push to the originating client only. T273 may widen to workspace
      // fan-out where appropriate; per-client delivery is the safe default.
      server.push(
        EXPERIENCE_CHANNELS.EVENT,
        { to: 'client', clientId },
        { actorId: input.actorId, state },
      )
    }
    const sub = bus.subscribe(input.actorId, listener)
    pushUnwirers.set(sub.id, () => { bus.unsubscribe(sub.id) })
    return { ok: true, subscriptionId: sub.id, actorId: sub.actorId }
  })

  // experience.unsubscribe — release a subscription. Idempotent.
  server.handle(EXPERIENCE_CHANNELS.UNSUBSCRIBE, async (_ctx: RequestContext, input: UnsubscribeInput) => {
    if (!input || typeof input !== 'object') return { error: 'invalid-argument', reason: 'invalid-input' }
    if (typeof input.subscriptionId !== 'string' || input.subscriptionId.length === 0) {
      return { error: 'invalid-argument', reason: 'invalid-subscription-id' }
    }
    const unwire = pushUnwirers.get(input.subscriptionId)
    if (!unwire) return { ok: true, released: false }
    pushUnwirers.delete(input.subscriptionId)
    unwire()
    return { ok: true, released: true }
  })

  return bus
}
