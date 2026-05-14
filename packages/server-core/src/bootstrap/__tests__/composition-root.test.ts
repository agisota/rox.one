/**
 * T246d tests for the server-core composition root wire. Drives
 * `bootstrapServer` end-to-end with stubbed collaborators and injects
 * `createChain` via `options.auditProducerOptions` so no real
 * `FileAuditSink` is ever constructed. `ROX_CONFIG_DIR` is redirected
 * to a cwd-relative temp dir before the dynamic import so the lock
 * file lands inside the worktree (no `/tmp`, no `~/.rox` mutation).
 */
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'

import {
  type AuditEvent,
  type AuditEventInput,
  type AuditProducer,
  asCorrelationId,
} from '@rox-one/shared/observability'

import type {
  CreateHostAuditProducerOptions,
  HostAuditChain,
} from '../../observability/host.ts'
import type { RpcServer } from '../../transport/types.ts'
import type { AttachAuditProducerOptions } from '../audit-bootstrap.ts'
import type { ServerBootstrapOptions } from '../headless-start.ts'

const TEMP_ROOT = resolvePath(process.cwd(), '.tmp-test-composition-root')

// CRITICAL: redirect `ROX_CONFIG_DIR` BEFORE the bootstrap module is
// imported so `CONFIG_DIR` (captured at module-load time) and therefore
// `LOCK_FILE` resolve inside the worktree, not `~/.rox`.
if (!existsSync(TEMP_ROOT)) mkdirSync(TEMP_ROOT, { recursive: true })
const workDir = mkdtempSync(join(TEMP_ROOT, 'run-'))
process.env.ROX_CONFIG_DIR = workDir
delete process.env.ROX_AUDIT_DISABLE

// Dynamic import so the env var is observable when `paths.ts` evaluates
// `getConfigDir()` at module load. Top-level `await` works in bun:test.
const headless = await import('../headless-start.ts')
const bootstrapServer = headless.bootstrapServer

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

interface TestDeps {
  auditProducer?: AuditProducer
  registered: boolean
  registerSeenProducer?: AuditProducer
  /** Free-form extras to verify the wire only mutates `auditProducer`. */
  marker?: string
}

interface BootArgs {
  audit?: AttachAuditProducerOptions | undefined  // explicit `undefined` allowed
  /** Override the deps factory so callers can seed extras. */
  initialDeps?: Partial<TestDeps>
  /** Spy on register so ordering tests can capture state. */
  spyRegister?: boolean
}

let tokenCounter = 0
function nextToken(): string {
  tokenCounter += 1
  return `composition-root-token-${tokenCounter.toString(16).padStart(40, '0')}`
}

/** Boot `bootstrapServer` with stubbed collaborators. */
async function bootHermetic(args: BootArgs = {}): Promise<{
  instance: Awaited<ReturnType<typeof bootstrapServer>>
  deps: TestDeps
}> {
  const deps: TestDeps = { registered: false, ...(args.initialDeps ?? {}) }
  const sessionManager = { kind: 'session-stub' as const }
  const bootOpts: ServerBootstrapOptions<typeof sessionManager, TestDeps> = {
    serverToken: nextToken(),
    rpcHost: '127.0.0.1',
    rpcPort: 0,
    createSessionManager: () => sessionManager,
    createHandlerDeps: () => deps,
    registerAllRpcHandlers: (_server: RpcServer, d: TestDeps): void => {
      if (args.spyRegister) d.registerSeenProducer = d.auditProducer
      d.registered = true
    },
    initializeSessionManager: async (): Promise<void> => undefined,
    setSessionEventSink: (): void => undefined,
    initModelRefreshService: () => ({ startAll(): void { /* noop */ }, stopAll(): void { /* noop */ } }),
    cleanupSessionManager: async (): Promise<void> => undefined,
    serverId: 'composition-root-test',
  }
  if (args.audit !== undefined) bootOpts.auditProducerOptions = args.audit
  const instance = await bootstrapServer(bootOpts)
  return { instance, deps }
}

describe('bootstrapServer composition root — T246d audit producer wire', () => {
  beforeAll(() => {
    if (!existsSync(TEMP_ROOT)) mkdirSync(TEMP_ROOT, { recursive: true })
  })

  afterAll(() => {
    try { if (existsSync(TEMP_ROOT)) rmSync(TEMP_ROOT, { recursive: true, force: true }) } catch { /* best-effort */ }
  })

  it('attaches a real audit producer onto deps.auditProducer when env is not disabled', async () => {
    const stub = makeStubChain()
    const { instance, deps } = await bootHermetic({
      audit: { readDisableFlag: () => undefined, createChain: (opts) => { stub.options = opts; return stub.chain } },
    })
    try {
      expect(deps.auditProducer).toBe(stub.chain.producer)
      expect(instance.auditHandle.disabled).toBe(false)
      expect(instance.auditHandle.producer).toBe(stub.chain.producer)
      expect(deps.registered).toBe(true)
    } finally {
      await instance.stop()
    }
  })

  it('installs a no-op producer when ROX_AUDIT_DISABLE=1 (factory never called)', async () => {
    let factoryCalls = 0
    const { instance, deps } = await bootHermetic({
      audit: {
        readDisableFlag: () => '1',
        createChain: (): HostAuditChain => { factoryCalls += 1; return makeStubChain().chain },
      },
    })
    try {
      expect(instance.auditHandle.disabled).toBe(true)
      expect(deps.auditProducer).toBe(instance.auditHandle.producer)
      expect(factoryCalls).toBe(0)
    } finally {
      await instance.stop()
    }
  })

  it('stop() disposes the audit chain exactly once even when called repeatedly', async () => {
    const stub = makeStubChain()
    const { instance } = await bootHermetic({
      audit: { readDisableFlag: () => undefined, createChain: () => stub.chain },
    })
    expect(stub.disposed).toBe(0)
    await instance.stop()
    await instance.stop()
    await instance.stop()
    expect(stub.disposed).toBe(1)
  })

  it('emits real events through the wired producer (round-trip via deps.auditProducer)', async () => {
    const stub = makeStubChain()
    const { instance, deps } = await bootHermetic({
      audit: { readDisableFlag: () => undefined, createChain: () => stub.chain },
    })
    try {
      const event = deps.auditProducer?.emit({
        kind: 'RoleGranted',
        actor: { type: 'user', id: 'admin' },
        subject: { type: 'user', id: 'u-1' },
        scope: { kind: 'workspace', workspaceId: 'ws-1' },
        roleName: 'editor',
        ts: '2026-05-14T12:00:00.000Z',
        correlationId: asCorrelationId('cid-comproot-1'),
      } as AuditEventInput)
      expect(event?.kind).toBe('RoleGranted')
      expect(stub.emitted).toHaveLength(1)
      expect(stub.emitted[0]?.correlationId).toBe(asCorrelationId('cid-comproot-1'))
    } finally {
      await instance.stop()
    }
  })

  it('forwards auditProducerOptions host options (logDir / retention / clock) to the chain factory', async () => {
    const stub = makeStubChain()
    const clock = (): Date => new Date('2026-05-14T00:00:00.000Z')
    const logDir = join(workDir, 'audit-test')
    const { instance } = await bootHermetic({
      audit: {
        readDisableFlag: () => undefined,
        logDir,
        retention: { maxAgeMs: 9999, maxFiles: 7 },
        clock,
        createChain: (opts) => { stub.options = opts; return stub.chain },
      },
    })
    try {
      expect(stub.options?.logDir).toBe(logDir)
      expect(stub.options?.retention?.maxAgeMs).toBe(9999)
      expect(stub.options?.retention?.maxFiles).toBe(7)
      expect(stub.options?.clock).toBe(clock)
    } finally {
      await instance.stop()
    }
  })

  it('exposes the auditHandle on ServerInstance so hosts can flush manually', async () => {
    const stub = makeStubChain()
    const { instance } = await bootHermetic({
      audit: { readDisableFlag: () => undefined, createChain: () => stub.chain },
    })
    try {
      expect(typeof instance.auditHandle.dispose).toBe('function')
      await instance.auditHandle.dispose()
      expect(stub.disposed).toBe(1)
      await instance.stop()
      expect(stub.disposed).toBe(1)
    } finally {
      await instance.stop()
    }
  })

  it('honours an absent auditProducerOptions (defaults flow through to attachAuditProducer)', async () => {
    // The wire uses `options.auditProducerOptions ?? {}`. When the host
    // does not supply any audit overrides, the helper falls back to its
    // default kill-switch read. We use the env switch to keep this
    // hermetic (the real factory would touch `$HOME/.rox`).
    const prev = process.env.ROX_AUDIT_DISABLE
    try {
      process.env.ROX_AUDIT_DISABLE = '1'
      const { instance, deps } = await bootHermetic({ audit: undefined })
      try {
        expect(instance.auditHandle.disabled).toBe(true)
        expect(deps.auditProducer).toBe(instance.auditHandle.producer)
      } finally {
        await instance.stop()
      }
    } finally {
      if (prev === undefined) delete process.env.ROX_AUDIT_DISABLE
      else process.env.ROX_AUDIT_DISABLE = prev
    }
  })

  it('attaches the producer BEFORE registerAllRpcHandlers fires (so handlers see auditProducer)', async () => {
    const stub = makeStubChain()
    const { instance, deps } = await bootHermetic({
      spyRegister: true,
      audit: { readDisableFlag: () => undefined, createChain: () => stub.chain },
    })
    try {
      expect(deps.registerSeenProducer).toBe(stub.chain.producer)
      expect(deps.registered).toBe(true)
    } finally {
      await instance.stop()
    }
  })

  it('swallows audit dispose errors during stop() so shutdown finishes cleanly', async () => {
    let disposeCalls = 0
    const stub = makeStubChain()
    stub.chain.dispose = async (): Promise<void> => {
      disposeCalls += 1
      throw new Error('forced audit dispose failure')
    }
    const { instance } = await bootHermetic({
      audit: { readDisableFlag: () => undefined, createChain: () => stub.chain },
    })
    await expect(instance.stop()).resolves.toBeUndefined()
    expect(disposeCalls).toBe(1)
  })

  it('keeps the audit wire scoped to deps.auditProducer (other deps fields preserved)', async () => {
    const stub = makeStubChain()
    const { instance, deps } = await bootHermetic({
      initialDeps: { marker: 'preserved' },
      audit: { readDisableFlag: () => undefined, createChain: () => stub.chain },
    })
    try {
      expect(deps.marker).toBe('preserved')
      expect(deps.auditProducer).toBe(stub.chain.producer)
    } finally {
      await instance.stop()
    }
  })
})
