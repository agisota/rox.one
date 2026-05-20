import { describe, expect, it } from 'bun:test'
import { ZodError } from 'zod'
import { OpenDesignRequestSchema, OpenDesignResultSchema } from '../request.ts'

const validTask = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  description: 'Create a landing page',
  kind: 'landing' as const,
  locale: 'en',
  createdAt: '2024-01-15T10:30:00.000Z',
}

const validContext = {
  sessionId: 'session-abc123',
  workspaceId: 'ws-xyz789',
  theme: 'light' as const,
  locale: 'en',
}

const validRequest = {
  task: validTask,
  context: validContext,
}

describe('OpenDesignRequestSchema', () => {
  // 4.1 RED: valid OpenDesignRequest parses
  it('parses a valid OpenDesignRequest', () => {
    const result = OpenDesignRequestSchema.parse(validRequest)
    expect(result.task.id).toBe(validTask.id)
    expect(result.context.sessionId).toBe(validContext.sessionId)
  })

  it('parses request with all optional fields', () => {
    const result = OpenDesignRequestSchema.parse({
      ...validRequest,
      autoLaunched: true,
      classifierConfidence: 0.95,
    })
    expect(result.autoLaunched).toBe(true)
    expect(result.classifierConfidence).toBe(0.95)
  })

  // 4.2 RED: autoLaunched defaults to false
  it('defaults autoLaunched to false when not provided', () => {
    const result = OpenDesignRequestSchema.parse(validRequest)
    expect(result.autoLaunched).toBe(false)
  })

  it('rejects classifierConfidence outside [0, 1]', () => {
    expect(() =>
      OpenDesignRequestSchema.parse({ ...validRequest, classifierConfidence: 1.5 })
    ).toThrow(ZodError)

    expect(() =>
      OpenDesignRequestSchema.parse({ ...validRequest, classifierConfidence: -0.1 })
    ).toThrow(ZodError)
  })

  it('accepts classifierConfidence at boundary values 0 and 1', () => {
    expect(OpenDesignRequestSchema.parse({ ...validRequest, classifierConfidence: 0 }).classifierConfidence).toBe(0)
    expect(OpenDesignRequestSchema.parse({ ...validRequest, classifierConfidence: 1 }).classifierConfidence).toBe(1)
  })

  it('rejects request with missing task', () => {
    expect(() =>
      OpenDesignRequestSchema.parse({ context: validContext })
    ).toThrow(ZodError)
  })

  it('rejects request with missing context', () => {
    expect(() =>
      OpenDesignRequestSchema.parse({ task: validTask })
    ).toThrow(ZodError)
  })
})

describe('OpenDesignResultSchema', () => {
  // 4.3 RED: OpenDesignResult discriminated by status
  it('parses opened result', () => {
    const result = OpenDesignResultSchema.parse({ status: 'opened', windowId: 42 })
    expect(result.status).toBe('opened')
    if (result.status === 'opened') {
      expect(result.windowId).toBe(42)
    }
  })

  it('parses failed result', () => {
    const result = OpenDesignResultSchema.parse({ status: 'failed', reason: 'Design process crashed' })
    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(result.reason).toBe('Design process crashed')
    }
  })

  it('rejects unknown status', () => {
    expect(() =>
      OpenDesignResultSchema.parse({ status: 'pending', windowId: 1 })
    ).toThrow(ZodError)
  })

  it('rejects opened result missing windowId', () => {
    expect(() =>
      OpenDesignResultSchema.parse({ status: 'opened' })
    ).toThrow(ZodError)
  })

  it('rejects failed result missing reason', () => {
    expect(() =>
      OpenDesignResultSchema.parse({ status: 'failed' })
    ).toThrow(ZodError)
  })

  it('rejects opened result with float windowId', () => {
    expect(() =>
      OpenDesignResultSchema.parse({ status: 'opened', windowId: 1.5 })
    ).toThrow(ZodError)
  })
})
