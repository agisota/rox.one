import { describe, expect, it } from 'bun:test'
import { ZodError } from 'zod'
import { DesignArtifactSchema } from '../artifact.ts'

const validArtifact = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  taskId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  type: 'html' as const,
  uri: 'file:///home/user/.rox/artifacts/page.html',
  bytes: 4096,
  sha256: 'a'.repeat(64),
  createdAt: '2024-01-15T10:30:00.000Z',
}

describe('DesignArtifactSchema', () => {
  // 2.1 RED: minimal valid artifact parses
  it('parses a minimal valid artifact', () => {
    const result = DesignArtifactSchema.parse(validArtifact)
    expect(result.id).toBe(validArtifact.id)
    expect(result.taskId).toBe(validArtifact.taskId)
    expect(result.type).toBe('html')
    expect(result.uri).toBe(validArtifact.uri)
    expect(result.bytes).toBe(4096)
    expect(result.sha256).toBe('a'.repeat(64))
  })

  it('parses artifact with optional thumbnailUri', () => {
    const result = DesignArtifactSchema.parse({
      ...validArtifact,
      thumbnailUri: 'rox-storage://thumb/abc123',
    })
    expect(result.thumbnailUri).toBe('rox-storage://thumb/abc123')
  })

  it('parses artifact without thumbnailUri (optional)', () => {
    const result = DesignArtifactSchema.parse(validArtifact)
    expect(result.thumbnailUri).toBeUndefined()
  })

  // 2.2 RED: invalid type (e.g. 'jpg') rejected
  it('rejects invalid type jpg', () => {
    expect(() =>
      DesignArtifactSchema.parse({ ...validArtifact, type: 'jpg' })
    ).toThrow(ZodError)
  })

  it('accepts all valid type values', () => {
    const types = ['html', 'svg', 'png', 'pdf', 'pptx', 'mp4'] as const
    for (const type of types) {
      const result = DesignArtifactSchema.parse({ ...validArtifact, type })
      expect(result.type).toBe(type)
    }
  })

  // 2.3 RED: uri not matching ^(file|rox-storage): rejected
  it('rejects uri with http scheme', () => {
    expect(() =>
      DesignArtifactSchema.parse({ ...validArtifact, uri: 'http://example.com/file.html' })
    ).toThrow(ZodError)
  })

  it('rejects uri with no scheme', () => {
    expect(() =>
      DesignArtifactSchema.parse({ ...validArtifact, uri: '/absolute/path/file.html' })
    ).toThrow(ZodError)
  })

  it('accepts rox-storage: uri scheme', () => {
    const result = DesignArtifactSchema.parse({ ...validArtifact, uri: 'rox-storage://bucket/file.html' })
    expect(result.uri).toBe('rox-storage://bucket/file.html')
  })

  it('rejects negative bytes', () => {
    expect(() =>
      DesignArtifactSchema.parse({ ...validArtifact, bytes: -1 })
    ).toThrow(ZodError)
  })

  it('rejects sha256 with wrong length', () => {
    expect(() =>
      DesignArtifactSchema.parse({ ...validArtifact, sha256: 'abc123' })
    ).toThrow(ZodError)
  })

  it('rejects sha256 with uppercase hex', () => {
    expect(() =>
      DesignArtifactSchema.parse({ ...validArtifact, sha256: 'A'.repeat(64) })
    ).toThrow(ZodError)
  })
})
