/**
 * PZD-W3 G.2.2.1.D — skin pipeline tests.
 *
 * Verifies:
 *   - `applySkin` substitutes tokens, inserts CSS, runs bootstrap, returns key.
 *   - `reapplySkin` ALWAYS calls `removeInsertedCSS(prevKey)` BEFORE the new
 *     `insertCSS` (closes audit C-H4 at framework level).
 *   - `destroySkin` tolerates an invalid / stale key without throwing.
 *   - Token substitution leaves unknown placeholders in place.
 *   - All paths log via `mainLog.error` on failure rather than throwing.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test'

const logCalls: Array<{ level: string; args: unknown[] }> = []

mock.module('../../logger', () => {
  const makeLog =
    (level: string) =>
    (...args: unknown[]) => {
      logCalls.push({ level, args })
    }
  const stubLog = {
    info: makeLog('info'),
    warn: makeLog('warn'),
    error: makeLog('error'),
    debug: makeLog('debug'),
    scope: () => stubLog,
  }
  return {
    mainLog: stubLog,
    sessionLog: stubLog,
    handlerLog: stubLog,
    windowLog: stubLog,
    agentLog: stubLog,
    searchLog: stubLog,
    isDebugMode: false,
    default: stubLog,
  }
})

const { MockWebContentsView } = await import(
  '../__testing__/mock-web-contents-view'
) as typeof import('../__testing__/mock-web-contents-view')

const { SkinPipeline, substituteTokens } = await import('../skin-pipeline') as typeof import('../skin-pipeline')

type WebContentsShim = import('electron').WebContents

function wcOf(view: import('../__testing__/mock-web-contents-view').MockWebContentsView): WebContentsShim {
  // The MockWebContents mirrors the WebContents surface the pipeline touches
  // (insertCSS, removeInsertedCSS, executeJavaScript, isDestroyed). Cast at
  // the boundary so production typing stays honest.
  return view.webContents as unknown as WebContentsShim
}

beforeEach(() => {
  logCalls.length = 0
})

describe('substituteTokens', () => {
  test('replaces `{{token}}` placeholders with tokenMap values', () => {
    const css = '.button { color: {{primary}}; background: {{bg}}; }'
    const out = substituteTokens(css, { primary: '#f00', bg: '#000' })
    expect(out).toBe('.button { color: #f00; background: #000; }')
  })

  test('leaves unknown placeholders untouched (no map entry => keep raw)', () => {
    const out = substituteTokens('.x { color: {{absent}}; }', { other: 'y' })
    expect(out).toBe('.x { color: {{absent}}; }')
  })

  test('returns css unchanged when tokenMap is undefined', () => {
    const css = '.x { color: {{primary}}; }'
    expect(substituteTokens(css)).toBe(css)
  })

  test('trims whitespace inside placeholders before lookup', () => {
    expect(substituteTokens('a={{ primary }}', { primary: 'X' })).toBe('a=X')
  })
})

describe('SkinPipeline.applySkin', () => {
  test('inserts CSS and returns the resulting cssKey', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    const { cssKey } = await pipeline.applySkin(wcOf(view), {
      css: 'body { background: black; }',
    })

    expect(cssKey).toBe('mock-css-1')
    expect(view.getInsertedCss()).toEqual({
      'mock-css-1': 'body { background: black; }',
    })
  })

  test('applies token substitution before insertCSS', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    await pipeline.applySkin(wcOf(view), {
      css: 'a { color: {{primary}}; }',
      tokenMap: { primary: '#abc' },
    })

    expect(view.getInsertedCss()).toEqual({
      'mock-css-1': 'a { color: #abc; }',
    })
  })

  test('executes the bootstrap script after CSS insertion when provided', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    const executed: string[] = []
    view.setExecuteJavaScriptImplementation(async (code: string) => {
      executed.push(code)
      return undefined
    })

    await pipeline.applySkin(wcOf(view), {
      css: 'x{}',
      bootstrapScript: 'window.__rox_skin_bootstrap__=true',
    })

    expect(executed).toEqual(['window.__rox_skin_bootstrap__=true'])
  })

  test('skips bootstrap when not provided', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    const executed: string[] = []
    view.setExecuteJavaScriptImplementation(async (code: string) => {
      executed.push(code)
      return undefined
    })

    await pipeline.applySkin(wcOf(view), { css: 'x{}' })

    expect(executed).toEqual([])
  })

  test('returns empty cssKey and logs error when insertCSS rejects', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    // Monkey-patch insertCSS to fail.
    view.webContents.insertCSS = async () => {
      throw new Error('boom')
    }

    const { cssKey } = await pipeline.applySkin(wcOf(view), { css: 'x{}' })

    expect(cssKey).toBe('')
    expect(logCalls.some((c) => c.level === 'error')).toBe(true)
  })

  test('short-circuits when webContents is destroyed', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    view.webContents.close()

    const { cssKey } = await pipeline.applySkin(wcOf(view), { css: 'x{}' })

    expect(cssKey).toBe('')
    expect(view.getInsertedCss()).toEqual({})
  })
})

describe('SkinPipeline.reapplySkin', () => {
  test('calls removeInsertedCSS(prevKey) BEFORE inserting the new CSS (C-H4)', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    // Capture call ordering between removeInsertedCSS and insertCSS.
    const callOrder: string[] = []
    const realInsert = view.webContents.insertCSS.bind(view.webContents)
    const realRemove = view.webContents.removeInsertedCSS.bind(view.webContents)
    view.webContents.insertCSS = async (css: string) => {
      callOrder.push(`insertCSS:${css}`)
      return realInsert(css)
    }
    view.webContents.removeInsertedCSS = async (key: string) => {
      callOrder.push(`removeInsertedCSS:${key}`)
      return realRemove(key)
    }

    await pipeline.reapplySkin(wcOf(view), 'mock-css-old', { css: 'NEW{}' })

    expect(callOrder).toEqual([
      'removeInsertedCSS:mock-css-old',
      'insertCSS:NEW{}',
    ])
  })

  test('still inserts new CSS when removeInsertedCSS rejects on a stale key', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    view.webContents.removeInsertedCSS = async () => {
      throw new Error('stale-key')
    }

    const { cssKey } = await pipeline.reapplySkin(wcOf(view), 'stale', {
      css: 'NEW{}',
    })

    expect(cssKey).toBe('mock-css-1')
    expect(view.getInsertedCss()).toEqual({ 'mock-css-1': 'NEW{}' })
    // Removal failure is recorded but does not propagate.
    expect(logCalls.some((c) => c.level === 'error')).toBe(true)
  })

  test('skips removeInsertedCSS when prevKey is empty (initial apply)', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    let removeCalls = 0
    view.webContents.removeInsertedCSS = async () => {
      removeCalls++
    }

    await pipeline.reapplySkin(wcOf(view), '', { css: 'x{}' })

    expect(removeCalls).toBe(0)
  })

  test('returns empty cssKey when webContents is destroyed', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    view.webContents.close()

    const { cssKey } = await pipeline.reapplySkin(wcOf(view), 'k', { css: 'x{}' })

    expect(cssKey).toBe('')
  })
})

describe('SkinPipeline.destroySkin', () => {
  test('removes the inserted CSS associated with cssKey', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    const { cssKey } = await pipeline.applySkin(wcOf(view), { css: 'x{}' })
    expect(view.getInsertedCss()).toEqual({ [cssKey]: 'x{}' })

    await pipeline.destroySkin(wcOf(view), cssKey)

    expect(view.getInsertedCss()).toEqual({})
  })

  test('tolerates an invalid / stale key without throwing', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()

    view.webContents.removeInsertedCSS = async () => {
      throw new Error('no such key')
    }

    await expect(
      pipeline.destroySkin(wcOf(view), 'never-existed'),
    ).resolves.toBeUndefined()
    expect(logCalls.some((c) => c.level === 'error')).toBe(true)
  })

  test('is a no-op when cssKey is empty', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    let removeCalls = 0
    view.webContents.removeInsertedCSS = async () => {
      removeCalls++
    }

    await pipeline.destroySkin(wcOf(view), '')

    expect(removeCalls).toBe(0)
  })

  test('is a no-op when webContents is destroyed', async () => {
    const pipeline = new SkinPipeline()
    const view = new MockWebContentsView()
    view.webContents.close()

    await expect(pipeline.destroySkin(wcOf(view), 'k')).resolves.toBeUndefined()
  })
})
