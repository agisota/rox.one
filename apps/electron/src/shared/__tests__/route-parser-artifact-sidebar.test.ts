import { describe, expect, it } from 'bun:test'
import {
  buildRightSidebarParam,
  parseRightSidebarParam,
} from '../route-parser'

describe('artifact right sidebar route state', () => {
  it('roundtrips artifact sidebar without an artifact id', () => {
    expect(parseRightSidebarParam('artifact')).toEqual({ type: 'artifact' })
    expect(buildRightSidebarParam({ type: 'artifact' })).toBe('artifact')
  })

  it('roundtrips artifact sidebar with an artifact id', () => {
    expect(parseRightSidebarParam('artifact/artifact-123')).toEqual({
      type: 'artifact',
      artifactId: 'artifact-123',
    })
    expect(buildRightSidebarParam({ type: 'artifact', artifactId: 'artifact-123' })).toBe('artifact/artifact-123')
  })
})
