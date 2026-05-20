import { describe, expect, it } from 'bun:test'
import { ZodError } from 'zod'
import { DesignContextSchema } from '../context.ts'

const validContext = {
  sessionId: 'session-abc123',
  workspaceId: 'ws-xyz789',
  theme: 'light' as const,
  locale: 'en',
}

describe('DesignContextSchema', () => {
  // 3.1 RED: minimal valid (no selection, no user) parses
  it('parses minimal valid context without selection or user', () => {
    const result = DesignContextSchema.parse(validContext)
    expect(result.sessionId).toBe('session-abc123')
    expect(result.workspaceId).toBe('ws-xyz789')
    expect(result.theme).toBe('light')
    expect(result.locale).toBe('en')
    expect(result.selection).toBeUndefined()
    expect(result.user).toBeUndefined()
  })

  it('accepts null workspaceId', () => {
    const result = DesignContextSchema.parse({ ...validContext, workspaceId: null })
    expect(result.workspaceId).toBeNull()
  })

  it('parses context with user field', () => {
    const result = DesignContextSchema.parse({
      ...validContext,
      user: { id: 'user-001', locale: 'fr-FR' },
    })
    expect(result.user?.id).toBe('user-001')
    expect(result.user?.locale).toBe('fr-FR')
  })

  // 3.2 RED: with selection — range must be 2 ints
  it('parses valid selection with 2-int range', () => {
    const result = DesignContextSchema.parse({
      ...validContext,
      selection: { text: 'hello world', range: [0, 11] },
    })
    expect(result.selection?.text).toBe('hello world')
    expect(result.selection?.range).toEqual([0, 11])
  })

  it('rejects selection range with floats', () => {
    expect(() =>
      DesignContextSchema.parse({
        ...validContext,
        selection: { text: 'hi', range: [0.5, 2.5] },
      })
    ).toThrow(ZodError)
  })

  it('rejects selection range with wrong tuple length', () => {
    expect(() =>
      DesignContextSchema.parse({
        ...validContext,
        selection: { text: 'hi', range: [0, 1, 2] },
      })
    ).toThrow(ZodError)
  })

  it('rejects selection range with single element', () => {
    expect(() =>
      DesignContextSchema.parse({
        ...validContext,
        selection: { text: 'hi', range: [0] },
      })
    ).toThrow(ZodError)
  })

  // 3.3 RED: attachedFileIds defaults to []
  it('defaults attachedFileIds to empty array when not provided', () => {
    const result = DesignContextSchema.parse(validContext)
    expect(result.attachedFileIds).toEqual([])
  })

  it('preserves provided attachedFileIds', () => {
    const result = DesignContextSchema.parse({
      ...validContext,
      attachedFileIds: ['file-1', 'file-2'],
    })
    expect(result.attachedFileIds).toEqual(['file-1', 'file-2'])
  })

  it('rejects empty string in attachedFileIds', () => {
    expect(() =>
      DesignContextSchema.parse({ ...validContext, attachedFileIds: [''] })
    ).toThrow(ZodError)
  })

  it('rejects invalid theme', () => {
    expect(() =>
      DesignContextSchema.parse({ ...validContext, theme: 'blue' })
    ).toThrow(ZodError)
  })

  it('rejects locale with underscore', () => {
    expect(() =>
      DesignContextSchema.parse({ ...validContext, locale: 'en_US' })
    ).toThrow(ZodError)
  })

  it('rejects empty sessionId', () => {
    expect(() =>
      DesignContextSchema.parse({ ...validContext, sessionId: '' })
    ).toThrow(ZodError)
  })
})
