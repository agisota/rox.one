import { describe, expect, it } from 'bun:test'
import { ZodError } from 'zod'
import { AgentAnswerPackageSchema } from '../agent-answer-package.ts'

const BASE = {
  agentId: 'agent-1',
  sessionId: 'session-abc',
  turnId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  createdAt: '2026-05-20T12:00:00.000Z',
}

const VALID_TEXT_PAYLOAD = { kind: 'text' as const, text: 'Hello world' }

const VALID_DESIGN_REQUEST = {
  task: {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'Build a landing page',
    kind: 'landing' as const,
    locale: 'en',
    createdAt: '2026-05-20T11:00:00.000Z',
  },
  context: {
    sessionId: 'session-abc',
    workspaceId: null,
    attachedFileIds: [],
    theme: 'dark' as const,
    locale: 'en',
  },
  autoLaunched: false,
}

describe('AgentAnswerPackageSchema', () => {
  // Cycle 1 RED→GREEN: minimal valid text-kind AAP parses
  it('parses a minimal valid text-kind AAP', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'text',
      payload: VALID_TEXT_PAYLOAD,
    })
    expect(result.agentId).toBe('agent-1')
    expect(result.sessionId).toBe('session-abc')
    expect(result.kind).toBe('text')
    expect(result.payload.kind).toBe('text')
    if (result.payload.kind === 'text') {
      expect(result.payload.text).toBe('Hello world')
    }
  })

  // Cycle 2 RED→GREEN: agentId empty string rejected
  it('rejects empty agentId', () => {
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...BASE,
        agentId: '',
        kind: 'text',
        payload: VALID_TEXT_PAYLOAD,
      })
    ).toThrow(ZodError)
  })

  // Cycle 3 RED→GREEN: code-kind without language rejected
  it('rejects code payload without language', () => {
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...BASE,
        kind: 'code',
        payload: { kind: 'code', text: 'console.log("hi")' },
      })
    ).toThrow(ZodError)
  })

  // Cycle 4 RED→GREEN: code-kind with language parses
  it('parses a valid code-kind AAP', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'code',
      payload: { kind: 'code', language: 'typescript', text: 'const x = 1' },
    })
    expect(result.kind).toBe('code')
    if (result.payload.kind === 'code') {
      expect(result.payload.language).toBe('typescript')
    }
  })

  // Cycle 5 RED→GREEN: design-kind with valid OpenDesignRequest parses
  it('parses a valid design-kind AAP with real OpenDesignRequest', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'design',
      payload: { kind: 'design', request: VALID_DESIGN_REQUEST },
    })
    expect(result.kind).toBe('design')
    if (result.payload.kind === 'design') {
      expect(result.payload.request.task.kind).toBe('landing')
    }
  })

  // Cycle 6 RED→GREEN: design payload with missing task field rejected
  it('rejects design payload with missing task field', () => {
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...BASE,
        kind: 'design',
        payload: {
          kind: 'design',
          request: { context: VALID_DESIGN_REQUEST.context, autoLaunched: false },
        },
      })
    ).toThrow(ZodError)
  })

  // Cycle 7 RED→GREEN: mixed payload with 2 nested primitives parses
  it('parses a mixed payload with 2 nested primitives', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'mixed',
      payload: {
        kind: 'mixed',
        parts: [
          { kind: 'text', text: 'Here is the code:' },
          { kind: 'code', language: 'python', text: 'print("hello")' },
        ],
      },
    })
    expect(result.kind).toBe('mixed')
    if (result.payload.kind === 'mixed') {
      expect(result.payload.parts).toHaveLength(2)
    }
  })

  // Cycle 8 RED→GREEN: mixed payload with single part parses
  it('parses a mixed payload with a single text part', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'mixed',
      payload: {
        kind: 'mixed',
        parts: [{ kind: 'text', text: 'single part' }],
      },
    })
    expect(result.kind).toBe('mixed')
  })

  // Cycle 9 RED→GREEN: mixed payload nested 3 levels deep parses
  it('parses a mixed payload nested 3 levels deep', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'mixed',
      payload: {
        kind: 'mixed',
        parts: [
          { kind: 'text', text: 'level 1' },
          {
            kind: 'mixed',
            parts: [
              { kind: 'code', language: 'js', text: 'x()' },
              {
                kind: 'mixed',
                parts: [{ kind: 'text', text: 'level 3' }],
              },
            ],
          },
        ],
      },
    })
    expect(result.kind).toBe('mixed')
    if (result.payload.kind === 'mixed') {
      expect(result.payload.parts).toHaveLength(2)
      const nested = result.payload.parts[1]
      expect(nested?.kind).toBe('mixed')
    }
  })

  // Cycle 10 RED→GREEN: mixed payload with 4 levels deep parses
  it('parses deeply nested 4-level mixed payload', () => {
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'mixed',
      payload: {
        kind: 'mixed',
        parts: [
          {
            kind: 'mixed',
            parts: [
              {
                kind: 'mixed',
                parts: [
                  {
                    kind: 'mixed',
                    parts: [{ kind: 'text', text: 'deep' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    })
    expect(result.kind).toBe('mixed')
  })

  // Cycle 11 RED→GREEN: top-level kind mismatch with payload.kind rejected (refine)
  it('rejects when top-level kind does not match payload.kind', () => {
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...BASE,
        kind: 'text',
        payload: { kind: 'code', language: 'rust', text: 'fn main() {}' },
      })
    ).toThrow(ZodError)
  })

  // Cycle 12 RED→GREEN: kind=design but payload=text rejected by refine
  it('rejects kind=design with text payload (refine)', () => {
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...BASE,
        kind: 'design',
        payload: VALID_TEXT_PAYLOAD,
      })
    ).toThrow(ZodError)
  })

  // Cycle 13 RED→GREEN: mixed parts > 50 rejected
  it('rejects mixed payload with more than 50 parts', () => {
    const parts = Array.from({ length: 51 }, (_, i) => ({
      kind: 'text' as const,
      text: `part ${i}`,
    }))
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...BASE,
        kind: 'mixed',
        payload: { kind: 'mixed', parts },
      })
    ).toThrow(ZodError)
  })

  // Cycle 14 RED→GREEN: mixed parts exactly 50 is allowed
  it('accepts mixed payload with exactly 50 parts', () => {
    const parts = Array.from({ length: 50 }, (_, i) => ({
      kind: 'text' as const,
      text: `part ${i}`,
    }))
    const result = AgentAnswerPackageSchema.parse({
      ...BASE,
      kind: 'mixed',
      payload: { kind: 'mixed', parts },
    })
    expect(result.kind).toBe('mixed')
    if (result.payload.kind === 'mixed') {
      expect(result.payload.parts).toHaveLength(50)
    }
  })
})
