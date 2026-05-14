/**
 * T246c bootstrap helper — attaches an `AuditProducer` onto an existing
 * `HandlerDeps`-shaped dependency bag without touching the canonical
 * composition root in `headless-start.ts`.
 *
 * The helper is intentionally thin: it composes the T246b host audit
 * chain (`createHostAuditProducer`) and mutates only the optional
 * `auditProducer` slot exposed by `HandlerDeps`. Hosts that already wire
 * the producer themselves (or want to opt out for tests / dev) can set
 * `ROX_AUDIT_DISABLE=1` and receive a no-op producer + dispose hook;
 * the deps bag still receives an `auditProducer` field so handler
 * branches that probe `deps.auditProducer && ...` keep their happy path.
 *
 * Pure composition: T246b stays frozen, the file sink / retention
 * sub-surfaces stay frozen, and the bootstrap composition root in
 * `headless-start.ts` stays frozen. The helper is opt-in — hosts call
 * `attachAuditProducer(deps)` after `bootstrapServer(...)` returns.
 */
import {
  type AuditEvent,
  type AuditEventInput,
  type AuditProducer,
  asCorrelationId,
} from '@rox-one/shared/observability'
import { readEnv } from '@rox-one/shared/utils'

import {
  type CreateHostAuditProducerOptions,
  type HostAuditChain,
  createHostAuditProducer,
} from '../observability/host.ts'

/** Mutable deps slot. Concrete hosts pass their `HandlerDeps` here. */
export interface AuditAttachableDeps {
  auditProducer?: AuditProducer
}

export interface AttachAuditProducerOptions extends CreateHostAuditProducerOptions {
  /**
   * Override the kill-switch read. Defaults to `readEnv('ROX_AUDIT_DISABLE')`.
   * Returning `'1'` (string) or any truthy value installs the no-op producer.
   */
  readDisableFlag?: () => string | undefined
  /**
   * Test seam: override the host-chain factory entirely. Defaults to
   * `createHostAuditProducer`. The helper never imports the factory
   * dynamically so the override is purely a type-level redirection.
   */
  createChain?: (opts: CreateHostAuditProducerOptions) => HostAuditChain
}

export interface AuditBootstrapHandle {
  /** The producer attached onto `deps.auditProducer`. */
  producer: AuditProducer
  /**
   * Shuts the chain down. For a real producer this flushes the file
   * sink, runs the final retention sweep, and closes the underlying
   * handle. For the no-op producer it is a resolved promise.
   * Idempotent across multiple calls.
   */
  dispose(): Promise<void>
  /** `true` when the kill-switch installed the no-op producer. */
  disabled: boolean
}

/**
 * Read the kill-switch flag. Any non-empty value disables the chain;
 * the canonical value used in docs / docker images is `'1'`.
 */
function isAuditDisabled(read: () => string | undefined): boolean {
  const raw = read()
  return typeof raw === 'string' && raw.length > 0 && raw !== '0' && raw.toLowerCase() !== 'false'
}

/**
 * Build a producer that swallows every emit. Used when
 * `ROX_AUDIT_DISABLE=1` is set so tests / dev environments do not write
 * to the user's `~/.rox/audit.log` and so handlers can still branch on
 * `deps.auditProducer && ...` without crashing.
 */
function createNoopAuditProducer(): AuditProducer {
  return {
    emit(input: AuditEventInput): AuditEvent {
      const base = input as Partial<AuditEvent>
      return {
        ...input,
        ts: base.ts ?? new Date(0).toISOString(),
        correlationId: base.correlationId ?? asCorrelationId('noop'),
      } as AuditEvent
    },
  }
}

/**
 * Attach a real or no-op `AuditProducer` onto an existing deps bag.
 *
 * Behaviour matrix:
 * - `ROX_AUDIT_DISABLE` unset / empty / `'0'` / `'false'` →
 *   `createHostAuditProducer(...)` runs, the producer is attached, and
 *   `dispose()` proxies to the chain's own dispose (flush + retention
 *   + close).
 * - `ROX_AUDIT_DISABLE='1'` (or any other truthy string) → a no-op
 *   producer is attached, `dispose()` resolves immediately, and the
 *   file sink is never constructed.
 *
 * Either way the returned handle is the lifetime owner. Callers should
 * `await handle.dispose()` from their shutdown path.
 */
export function attachAuditProducer(
  deps: AuditAttachableDeps,
  options: AttachAuditProducerOptions = {},
): AuditBootstrapHandle {
  const readDisable = options.readDisableFlag ?? ((): string | undefined => readEnv('ROX_AUDIT_DISABLE'))
  if (isAuditDisabled(readDisable)) {
    const producer = createNoopAuditProducer()
    deps.auditProducer = producer
    let disposed = false
    return {
      producer,
      disabled: true,
      dispose: async (): Promise<void> => {
        if (disposed) return
        disposed = true
      },
    }
  }

  const factory = options.createChain ?? createHostAuditProducer
  // Strip helper-specific keys before forwarding so the inner factory
  // never sees them. Pure composition: every other option flows through
  // verbatim.
  const {
    readDisableFlag: _readDisableFlag,
    createChain: _createChain,
    ...hostOptions
  } = options
  void _readDisableFlag
  void _createChain
  const chain = factory(hostOptions)
  deps.auditProducer = chain.producer

  let disposed = false
  return {
    producer: chain.producer,
    disabled: false,
    dispose: async (): Promise<void> => {
      if (disposed) return
      disposed = true
      await chain.dispose()
    },
  }
}
