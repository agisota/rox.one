/**
 * Tests for the T246c bootstrap helper `attachAuditProducer`. The
 * helper wraps the T246b host audit chain (`createHostAuditProducer`)
 * with a kill-switch and mutates the `auditProducer` slot on a
 * `HandlerDeps`-shaped bag.
 *
 * The chain factory is stubbed so the tests never construct a real
 * `FileAuditSink` (no `/tmp`, no `$HOME`, no real disk writes). The
 * `ROX_AUDIT_DISABLE` env switch is exercised via an injected
 * `readDisableFlag` so tests stay hermetic.
 */
import { describe, expect, it } from 'bun:test'

import {
  type AuditEvent,
  type AuditEventInput,
  type AuditProducer,
  asCorrelationId,
} from '@rox-one/shared/observability'

import {
  type CreateHostAuditProducerOptions,
  type HostAuditChain,
} from '../../observability/host.ts'
import {
  type AuditAttachableDeps,
  attachAuditProducer,
} from '../audit-bootstrap.ts'

interface StubChain {
  chain: HostAuditChain
  emitted: AuditEvent[]
  disposed: number
  options: CreateHostAuditProducerOptions | null
}

function makeStubChain(): StubChain {
  const stub: StubChain = { emitted: [], disposed: 0, options: null, chain: undefined as unknown as HostAuditChain }
  const producer: AuditProducer = {
    emit(input: AuditEventInput): AuditEvent {
      const ev = {
        ...input,
        ts: (input as Partial<AuditEvent>).ts ?? '2026-05-14T12:00:00.000Z',
        correlationId: (input as Partial<AuditEvent>).correlationId ?? asCorrelationId('stub-cid'),
      } as AuditEvent
      stub.emitted.push(ev); return ev
    },
  }
  const noop = (): void => undefined
  stub.chain = {
    producer,
    activeLogPath: '/dev/null/audit.log',
    logger: { info: noop, warn: noop, error: noop, debug: noop } as unknown as HostAuditChain['logger'],
    dispose: async (): Promise<void> => { stub.disposed += 1 },
    enforceRetentionNow: noop,
  }
  return stub
}

function makeInput(overrides: Partial<AuditEvent> = {}): AuditEventInput {
  return {
    kind: 'RoleGranted',
    actor: { type: 'user', id: 'admin' },
    subject: { type: 'user', id: 'u-1' },
    scope: { kind: 'workspace', workspaceId: 'ws-1' },
    roleName: 'editor',
    ts: '2026-05-14T12:00:00.000Z',
    correlationId: asCorrelationId('cid-bootstrap-1'),
    ...overrides,
  } as AuditEventInput
}

describe('attachAuditProducer', () => {
  it('attaches a real producer when ROX_AUDIT_DISABLE is unset and forwards host options', () => {
    const deps: AuditAttachableDeps = {}
    const stub = makeStubChain()
    const clock = (): Date => new Date('2026-05-14T00:00:00.000Z')
    const handle = attachAuditProducer(deps, {
      readDisableFlag: () => undefined,
      logDir: '/nonexistent/.rox-test',
      clock,
      retention: { maxAgeMs: 1234, maxFiles: 5 },
      createChain: (opts) => { stub.options = opts; return stub.chain },
    })
    expect(handle.disabled).toBe(false)
    expect(handle.producer).toBe(stub.chain.producer)
    expect(deps.auditProducer).toBe(stub.chain.producer)
    expect(stub.options?.logDir).toBe('/nonexistent/.rox-test')
    expect(stub.options?.clock).toBe(clock)
    expect(stub.options?.retention?.maxAgeMs).toBe(1234)
    expect(stub.options?.retention?.maxFiles).toBe(5)
  })

  it('does not leak helper-specific options to the chain factory', () => {
    const stub = makeStubChain()
    attachAuditProducer({}, {
      readDisableFlag: () => undefined,
      createChain: (opts) => { stub.options = opts; return stub.chain },
    })
    expect((stub.options as Record<string, unknown> | null)?.readDisableFlag).toBeUndefined()
    expect((stub.options as Record<string, unknown> | null)?.createChain).toBeUndefined()
  })

  it('emits real events through the attached producer', () => {
    const deps: AuditAttachableDeps = {}
    const stub = makeStubChain()
    attachAuditProducer(deps, { readDisableFlag: () => undefined, createChain: () => stub.chain })
    const ev = deps.auditProducer?.emit(makeInput())
    expect(stub.emitted).toHaveLength(1)
    expect(ev?.kind).toBe('RoleGranted')
    expect(stub.emitted[0]?.correlationId).toBe(asCorrelationId('cid-bootstrap-1'))
  })

  it('installs a no-op producer when ROX_AUDIT_DISABLE=1 (factory never called)', () => {
    const deps: AuditAttachableDeps = {}
    let factoryCalls = 0
    const handle = attachAuditProducer(deps, {
      readDisableFlag: () => '1',
      createChain: (): HostAuditChain => { factoryCalls += 1; return makeStubChain().chain },
    })
    expect(handle.disabled).toBe(true)
    expect(deps.auditProducer).toBe(handle.producer)
    expect(factoryCalls).toBe(0)
  })

  it('no-op producer.emit returns a fully-formed event and stamps defaults', () => {
    const handle = attachAuditProducer({}, { readDisableFlag: () => '1' })
    const stamped = handle.producer.emit({
      kind: 'LoginSucceeded',
      actor: { type: 'user', id: 'admin' },
      subject: { type: 'user', id: 'u-1' },
      scope: { kind: 'global' },
    } as AuditEventInput)
    expect(stamped.kind).toBe('LoginSucceeded')
    expect(typeof stamped.ts).toBe('string')
    expect(typeof stamped.correlationId).toBe('string')
    expect(stamped.correlationId.length).toBeGreaterThan(0)
    const echoed = handle.producer.emit(makeInput({ correlationId: asCorrelationId('noop-1') }))
    expect(echoed.correlationId).toBe(asCorrelationId('noop-1'))
  })

  it('treats truthy strings as disabling, "0"/"false"/empty as NOT disabling', () => {
    for (const flag of ['1', 'true', 'yes', 'on', 'TRUE']) {
      const handle = attachAuditProducer({}, {
        readDisableFlag: () => flag,
        createChain: () => makeStubChain().chain,
      })
      expect(handle.disabled).toBe(true)
    }
    for (const flag of ['0', 'false', 'FALSE', '']) {
      const stub = makeStubChain()
      const deps: AuditAttachableDeps = {}
      const handle = attachAuditProducer(deps, {
        readDisableFlag: () => flag,
        createChain: () => stub.chain,
      })
      expect(handle.disabled).toBe(false)
      expect(deps.auditProducer).toBe(stub.chain.producer)
    }
  })

  it('dispose() flushes the underlying chain exactly once and is idempotent', async () => {
    const stub = makeStubChain()
    const handle = attachAuditProducer({}, { readDisableFlag: () => undefined, createChain: () => stub.chain })
    await handle.dispose()
    await handle.dispose()
    await handle.dispose()
    expect(stub.disposed).toBe(1)
  })

  it('dispose() for the no-op branch resolves without touching any chain (idempotent)', async () => {
    let factoryCalls = 0
    const handle = attachAuditProducer({}, {
      readDisableFlag: () => '1',
      createChain: (): HostAuditChain => { factoryCalls += 1; return makeStubChain().chain },
    })
    await expect(handle.dispose()).resolves.toBeUndefined()
    await expect(handle.dispose()).resolves.toBeUndefined()
    expect(factoryCalls).toBe(0)
    expect(handle.disabled).toBe(true)
  })

  it('reads ROX_AUDIT_DISABLE from process.env when no readDisableFlag is supplied', () => {
    const prev = process.env.ROX_AUDIT_DISABLE
    try {
      process.env.ROX_AUDIT_DISABLE = '1'
      const handle = attachAuditProducer({}, { createChain: () => makeStubChain().chain })
      expect(handle.disabled).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.ROX_AUDIT_DISABLE
      else process.env.ROX_AUDIT_DISABLE = prev
    }
  })

  it('overwrites any pre-existing deps.auditProducer slot and exposes a shared reference', () => {
    const previous: AuditProducer = { emit: (): AuditEvent => ({} as AuditEvent) }
    const deps: AuditAttachableDeps = { auditProducer: previous }
    const stub = makeStubChain()
    const handle = attachAuditProducer(deps, {
      readDisableFlag: () => undefined,
      createChain: () => stub.chain,
    })
    expect(deps.auditProducer).toBe(stub.chain.producer)
    expect(deps.auditProducer).not.toBe(previous)
    expect(handle.producer).toBe(stub.chain.producer)
  })

  it('accepts an options-less invocation and defaults to the real factory', () => {
    // When `createChain` is unset and the env switch is unset, the helper
    // would normally construct a real `FileAuditSink`. To stay hermetic
    // we only verify the default-disable path: with the env switch we can
    // exercise the no-arg call without touching disk.
    const prev = process.env.ROX_AUDIT_DISABLE
    try {
      process.env.ROX_AUDIT_DISABLE = '1'
      const deps: AuditAttachableDeps = {}
      const handle = attachAuditProducer(deps)
      expect(handle.disabled).toBe(true)
      expect(deps.auditProducer).toBeDefined()
    } finally {
      if (prev === undefined) delete process.env.ROX_AUDIT_DISABLE
      else process.env.ROX_AUDIT_DISABLE = prev
    }
  })
})
