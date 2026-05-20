/**
 * rox-design-telemetry.test.ts — PZD-82
 *
 * Asserts the structured logging + Sentry breadcrumb shape for Rox Design
 * lifecycle errors. These tests describe the contract that the lifecycle
 * code (runtime-manager, view-manager, theme-bridge) must satisfy.
 */

import { describe, expect, mock, test, beforeEach, afterEach } from 'bun:test'

import {
  ROX_DESIGN_INTEGRATION_TAG,
  __setRoxDesignSentryClient,
  catchRoxDesignError,
  recordRoxDesignError,
  scrubContext,
  type RoxDesignSentryClient,
  type RoxDesignTelemetryLogger,
} from '../rox-design-telemetry'

interface CapturedBreadcrumb {
  category?: string
  level?: string
  message?: string
  data?: Record<string, unknown>
}

function makeLogger(): RoxDesignTelemetryLogger & {
  __errors: Array<[string, Record<string, unknown> | undefined]>
  __warns: Array<[string, Record<string, unknown> | undefined]>
} {
  const errors: Array<[string, Record<string, unknown> | undefined]> = []
  const warns: Array<[string, Record<string, unknown> | undefined]> = []
  return {
    error: mock((message: string, meta?: Record<string, unknown>) => { errors.push([message, meta]) }),
    warn: mock((message: string, meta?: Record<string, unknown>) => { warns.push([message, meta]) }),
    info: mock(() => undefined),
    __errors: errors,
    __warns: warns,
  }
}

function makeSentry(): RoxDesignSentryClient & { __breadcrumbs: CapturedBreadcrumb[] } {
  const breadcrumbs: CapturedBreadcrumb[] = []
  return {
    addBreadcrumb: mock((b: CapturedBreadcrumb) => { breadcrumbs.push(b) }),
    __breadcrumbs: breadcrumbs,
  }
}

let sentry: ReturnType<typeof makeSentry>

beforeEach(() => {
  sentry = makeSentry()
  __setRoxDesignSentryClient(sentry)
})

afterEach(() => {
  __setRoxDesignSentryClient(null)
})

describe('recordRoxDesignError', () => {
  test('logs a structured error tagged with the integration name and phase', () => {
    const logger = makeLogger()
    recordRoxDesignError({
      phase: 'start',
      error: new Error('boom'),
      logger,
      context: { manifestId: 'm-1', pid: 12345 },
    })

    expect(logger.__errors).toHaveLength(1)
    const [message, meta] = logger.__errors[0]
    expect(message).toContain('[rox-design.start]')
    expect(message).toContain('boom')
    expect(meta).toMatchObject({
      integration: ROX_DESIGN_INTEGRATION_TAG,
      phase: 'start',
      error: 'boom',
      manifestId: 'm-1',
      pid: 12345,
    })
  })

  test('emits a Sentry breadcrumb with category rox-design and level error', () => {
    const logger = makeLogger()
    recordRoxDesignError({
      phase: 'view-show',
      error: new Error('view failed'),
      logger,
      context: { webContentsId: 7 },
    })

    expect(sentry.__breadcrumbs).toHaveLength(1)
    const [crumb] = sentry.__breadcrumbs
    expect(crumb.category).toBe(ROX_DESIGN_INTEGRATION_TAG)
    expect(crumb.level).toBe('error')
    expect(crumb.message).toBe('view-show-failed')
    expect(crumb.data).toMatchObject({
      integration: ROX_DESIGN_INTEGRATION_TAG,
      phase: 'view-show',
      error: 'view failed',
      webContentsId: 7,
    })
  })

  test('downgrades to warn + warning when level is warn', () => {
    const logger = makeLogger()
    recordRoxDesignError({
      phase: 'before-quit-cleanup',
      error: new Error('cleanup race'),
      logger,
      level: 'warn',
    })

    expect(logger.__errors).toHaveLength(0)
    expect(logger.__warns).toHaveLength(1)
    expect(sentry.__breadcrumbs[0].level).toBe('warning')
  })

  test('accepts non-Error throws and serialises them safely', () => {
    const logger = makeLogger()
    recordRoxDesignError({ phase: 'navigate', error: 'string failure', logger })
    expect(logger.__errors[0][0]).toContain('string failure')
    expect(logger.__errors[0][1]).toMatchObject({ error: 'string failure' })

    recordRoxDesignError({ phase: 'navigate', error: { code: 42 }, logger })
    expect(logger.__errors[1][1]).toMatchObject({ error: '{"code":42}' })
  })

  test('never logs sensitive keys (token, secret, authorization, password)', () => {
    const logger = makeLogger()
    recordRoxDesignError({
      phase: 'register-desktop-auth',
      error: new Error('handshake refused'),
      logger,
      context: {
        manifestId: 'm-2',
        desktopAuthSecret: Buffer.from('SECRET'),
        token: 'topsecret',
        authorization: 'Bearer abc',
        password: 'pw',
        credential: 'creds',
        cookie: 'session=xyz',
      },
    })

    const [_, meta] = logger.__errors[0]
    expect(meta?.manifestId).toBe('m-2')
    expect(meta?.desktopAuthSecret).toBeUndefined()
    expect(meta?.token).toBeUndefined()
    expect(meta?.authorization).toBeUndefined()
    expect(meta?.password).toBeUndefined()
    expect(meta?.credential).toBeUndefined()
    expect(meta?.cookie).toBeUndefined()

    // Same scrubbing applies to the Sentry breadcrumb.
    const data = sentry.__breadcrumbs[0].data
    expect(data?.token).toBeUndefined()
    expect(data?.authorization).toBeUndefined()
    expect(data?.desktopAuthSecret).toBeUndefined()
  })

  test('truncates URLs to origin + pathname so query-string tokens never leak', () => {
    const logger = makeLogger()
    recordRoxDesignError({
      phase: 'view-navigate',
      error: new Error('nav blocked'),
      logger,
      context: {
        url: 'https://design.example/app?token=SECRET&debug=1',
        webUrl: 'http://127.0.0.1:49112/embed?embed=rox&desktopAuth=SECRET',
        daemonUrl: 'http://127.0.0.1:49111/api?auth=SECRET',
        validatedURL: 'https://x/y?session=SECRET',
      },
    })

    const [_, meta] = logger.__errors[0]
    expect(meta?.url).toBe('https://design.example/app')
    expect(meta?.webUrl).toBe('http://127.0.0.1:49112/embed')
    expect(meta?.daemonUrl).toBe('http://127.0.0.1:49111/api')
    expect(meta?.validatedURL).toBe('https://x/y')

    // Breadcrumb data is scrubbed the same way.
    const data = sentry.__breadcrumbs[0].data
    expect(data?.url).toBe('https://design.example/app')
  })

  test('is a no-op-shaped fallback when no Sentry client is available', () => {
    __setRoxDesignSentryClient(null)
    const logger = makeLogger()
    expect(() => recordRoxDesignError({ phase: 'destroy', error: new Error('x'), logger })).not.toThrow()
    expect(logger.__errors).toHaveLength(1)
  })
})

describe('catchRoxDesignError', () => {
  test('returns a function suitable for .catch() that records the error', async () => {
    const logger = makeLogger()
    const handler = catchRoxDesignError({
      phase: 'view-apply-skin-dom-ready',
      logger,
      context: { entryId: 17 },
    })

    await Promise.reject(new Error('skin failed')).catch(handler)

    expect(logger.__errors).toHaveLength(1)
    expect(logger.__errors[0][0]).toContain('[rox-design.view-apply-skin-dom-ready]')
    expect(logger.__errors[0][1]).toMatchObject({ phase: 'view-apply-skin-dom-ready', entryId: 17 })
    expect(sentry.__breadcrumbs[0].message).toBe('view-apply-skin-dom-ready-failed')
  })
})

describe('scrubContext', () => {
  test('returns empty object when input is undefined', () => {
    expect(scrubContext(undefined)).toEqual({})
  })

  test('preserves non-sensitive keys verbatim', () => {
    expect(scrubContext({ pid: 1, code: 'EBUSY', signal: null })).toEqual({ pid: 1, code: 'EBUSY', signal: null })
  })
})
