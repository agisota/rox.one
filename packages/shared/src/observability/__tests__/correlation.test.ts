import { describe, expect, it } from 'bun:test'

import {
  type CorrelationId,
  asCorrelationId,
  currentCorrelationId,
  withCorrelationId,
} from '../correlation.ts'

describe('CorrelationId brand', () => {
  it('produces a branded CorrelationId from a string via asCorrelationId', () => {
    const id: CorrelationId = asCorrelationId('req-1')
    expect(id).toBe('req-1' as CorrelationId)
  })

  it('rejects empty strings to prevent unidentifiable spans', () => {
    expect(() => asCorrelationId('')).toThrow(/empty/i)
    expect(() => asCorrelationId('   ')).toThrow(/empty/i)
  })

  it('trims surrounding whitespace before branding', () => {
    const id = asCorrelationId('  req-trim  ')
    expect(id).toBe('req-trim' as CorrelationId)
  })
})

describe('withCorrelationId / currentCorrelationId', () => {
  it('exposes the current correlation id inside the wrapped fn', () => {
    const id = asCorrelationId('span-A')
    const observed = withCorrelationId(id, () => currentCorrelationId())
    expect(observed).toBe(id)
  })

  it('returns undefined outside any span', () => {
    expect(currentCorrelationId()).toBeUndefined()
  })

  it('isolates sibling spans (no leakage between sequential calls)', () => {
    const a = asCorrelationId('A')
    const b = asCorrelationId('B')

    const observedA = withCorrelationId(a, () => currentCorrelationId())
    const observedB = withCorrelationId(b, () => currentCorrelationId())

    expect(observedA).toBe(a)
    expect(observedB).toBe(b)
    expect(currentCorrelationId()).toBeUndefined()
  })

  it('supports nested spans (inner overrides outer; outer restored after)', () => {
    const outer = asCorrelationId('outer')
    const inner = asCorrelationId('inner')

    const trace: Array<string | undefined> = []
    withCorrelationId(outer, () => {
      trace.push(currentCorrelationId())
      withCorrelationId(inner, () => {
        trace.push(currentCorrelationId())
      })
      trace.push(currentCorrelationId())
    })

    expect(trace).toEqual([outer, inner, outer])
    expect(currentCorrelationId()).toBeUndefined()
  })

  it('propagates correlation across await boundaries', async () => {
    const id = asCorrelationId('async-span')

    const observed = await withCorrelationId(id, async () => {
      await Promise.resolve()
      const afterAwait = currentCorrelationId()
      await new Promise(resolve => setTimeout(resolve, 1))
      const afterTimer = currentCorrelationId()
      return { afterAwait, afterTimer }
    })

    expect(observed.afterAwait).toBe(id)
    expect(observed.afterTimer).toBe(id)
    expect(currentCorrelationId()).toBeUndefined()
  })

  it('keeps parallel spans isolated under Promise.all', async () => {
    const idA = asCorrelationId('par-A')
    const idB = asCorrelationId('par-B')

    const [observedA, observedB] = await Promise.all([
      withCorrelationId(idA, async () => {
        await Promise.resolve()
        return currentCorrelationId()
      }),
      withCorrelationId(idB, async () => {
        await Promise.resolve()
        return currentCorrelationId()
      }),
    ])

    expect(observedA).toBe(idA)
    expect(observedB).toBe(idB)
  })

  it('returns the wrapped fn return value', () => {
    const id = asCorrelationId('ret')
    const result = withCorrelationId(id, () => 42)
    expect(result).toBe(42)
  })

  it('propagates synchronous throws unchanged', () => {
    const id = asCorrelationId('throw')
    expect(() =>
      withCorrelationId(id, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(currentCorrelationId()).toBeUndefined()
  })

  it('propagates async rejections unchanged', async () => {
    const id = asCorrelationId('reject')
    await expect(
      withCorrelationId(id, async () => {
        await Promise.resolve()
        throw new Error('async-boom')
      }),
    ).rejects.toThrow('async-boom')
  })
})
