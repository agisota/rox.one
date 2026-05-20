import { describe, expect, it } from 'bun:test'
import { ZodError } from 'zod'
import { DesignTaskSchema } from '../task.ts'

const validTask = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  description: 'Create a landing page for our SaaS product',
  kind: 'landing' as const,
  locale: 'en',
  createdAt: '2024-01-15T10:30:00.000Z',
}

describe('DesignTaskSchema', () => {
  // 1.1 RED: minimal valid task parses
  it('parses a minimal valid task', () => {
    const result = DesignTaskSchema.parse(validTask)
    expect(result.id).toBe(validTask.id)
    expect(result.description).toBe(validTask.description)
    expect(result.kind).toBe('landing')
    expect(result.locale).toBe('en')
    expect(result.createdAt).toBe(validTask.createdAt)
  })

  // 1.2 RED: empty description rejected
  it('rejects empty description', () => {
    expect(() =>
      DesignTaskSchema.parse({ ...validTask, description: '' })
    ).toThrow(ZodError)
  })

  it('rejects description over 8192 characters', () => {
    expect(() =>
      DesignTaskSchema.parse({ ...validTask, description: 'x'.repeat(8193) })
    ).toThrow(ZodError)
  })

  // 1.3 RED: invalid locale ('en_US' with underscore) rejected; BCP-47 ('en' or 'en-US') accepted
  it('rejects locale with underscore (en_US)', () => {
    expect(() =>
      DesignTaskSchema.parse({ ...validTask, locale: 'en_US' })
    ).toThrow(ZodError)
  })

  it('accepts BCP-47 short locale (en)', () => {
    const result = DesignTaskSchema.parse({ ...validTask, locale: 'en' })
    expect(result.locale).toBe('en')
  })

  it('accepts BCP-47 region locale (en-US)', () => {
    const result = DesignTaskSchema.parse({ ...validTask, locale: 'en-US' })
    expect(result.locale).toBe('en-US')
  })

  it('rejects unknown kind', () => {
    expect(() =>
      DesignTaskSchema.parse({ ...validTask, kind: 'unknown' })
    ).toThrow(ZodError)
  })

  it('accepts all valid kind values', () => {
    const kinds = ['landing', 'dashboard', 'slides', 'mobile-screen', 'prototype', 'image', 'free'] as const
    for (const kind of kinds) {
      const result = DesignTaskSchema.parse({ ...validTask, kind })
      expect(result.kind).toBe(kind)
    }
  })

  it('rejects non-UUID id', () => {
    expect(() =>
      DesignTaskSchema.parse({ ...validTask, id: 'not-a-uuid' })
    ).toThrow(ZodError)
  })
})
