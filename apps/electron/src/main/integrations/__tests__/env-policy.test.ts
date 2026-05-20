/**
 * PZD-79 G.2.2.1.C — env-var gating primitive.
 *
 * Generalizes the audit findings A-M1/A-M2 (env-override hardening): env-var
 * overrides only honored in dev (`!app.isPackaged`). Packaged builds log a
 * warn-level message describing the gated read.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Mock electron `app` before importing the module under test. Provide a
// complete-enough mock surface so that this declaration does not strip the
// `WebContentsView` named export when a co-located test file re-imports
// electron (bun caches module mocks across the test run).
let isPackagedValue = false
mock.module('electron', () => ({
  app: {
    get isPackaged() {
      return isPackagedValue
    },
  },
  WebContentsView: class {},
  BrowserView: class {},
  BrowserWindow: class {},
  shell: { openExternal: async () => undefined },
}))

const { isEnvOverrideAllowed, readGatedEnv } = await import('../env-policy') as typeof import('../env-policy')

const ENV_NAME = 'ROX_DESIGN_WEB_URL_TEST_PZD79'

afterEach(() => {
  delete process.env[ENV_NAME]
  isPackagedValue = false
})

describe('isEnvOverrideAllowed', () => {
  test('returns true in development (app.isPackaged === false)', () => {
    isPackagedValue = false
    expect(isEnvOverrideAllowed()).toBe(true)
  })

  test('returns false in packaged builds (app.isPackaged === true)', () => {
    isPackagedValue = true
    expect(isEnvOverrideAllowed()).toBe(false)
  })
})

describe('readGatedEnv', () => {
  test('returns the env value in development', () => {
    isPackagedValue = false
    process.env[ENV_NAME] = 'https://design-dev.t'
    expect(readGatedEnv(ENV_NAME)).toBe('https://design-dev.t')
  })

  test('returns undefined when the env var is not set, even in development', () => {
    isPackagedValue = false
    expect(readGatedEnv(ENV_NAME)).toBeUndefined()
  })

  test('returns undefined in packaged builds even when the env var is set', () => {
    isPackagedValue = true
    process.env[ENV_NAME] = 'https://design-dev.t'
    expect(readGatedEnv(ENV_NAME)).toBeUndefined()
  })

  test('logs a warn with structured reason when packaged build suppresses an env override', () => {
    isPackagedValue = true
    process.env[ENV_NAME] = 'https://design-dev.t'
    const warn = mock((_msg: string, _meta?: Record<string, unknown>) => undefined)
    const logger = { warn }

    expect(readGatedEnv(ENV_NAME, logger)).toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(1)
    const [, meta] = warn.mock.calls[0] as [string, Record<string, unknown>]
    expect(meta).toEqual({ reason: 'env-overrides-disabled-in-production', name: ENV_NAME })
  })

  test('does NOT log when the env var is unset in packaged builds', () => {
    isPackagedValue = true
    const warn = mock((_msg: string, _meta?: Record<string, unknown>) => undefined)
    const logger = { warn }

    expect(readGatedEnv(ENV_NAME, logger)).toBeUndefined()

    expect(warn).not.toHaveBeenCalled()
  })

  test('does NOT log in development even when env is set', () => {
    isPackagedValue = false
    process.env[ENV_NAME] = 'https://design-dev.t'
    const warn = mock((_msg: string, _meta?: Record<string, unknown>) => undefined)
    const logger = { warn }

    expect(readGatedEnv(ENV_NAME, logger)).toBe('https://design-dev.t')
    expect(warn).not.toHaveBeenCalled()
  })

  test('is safe to call without a logger', () => {
    isPackagedValue = true
    process.env[ENV_NAME] = 'https://design-dev.t'
    expect(() => readGatedEnv(ENV_NAME)).not.toThrow()
  })
})
