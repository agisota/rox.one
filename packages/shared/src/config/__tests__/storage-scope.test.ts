import { describe, expect, it } from 'bun:test'
import { DEFAULT_LOCAL_SCOPE, workspaceIdFromScope } from '../storage-scope'

describe('WorkspaceScope', () => {
  it('DEFAULT_LOCAL_SCOPE is frozen so callers cannot mutate the singleton', () => {
    expect(Object.isFrozen(DEFAULT_LOCAL_SCOPE)).toBe(true)
  })

  it('workspaceIdFromScope returns undefined for the local-single-user scope', () => {
    expect(workspaceIdFromScope(DEFAULT_LOCAL_SCOPE)).toBeUndefined()
  })

  it('workspaceIdFromScope returns workspaceId for a kind:workspace scope', () => {
    expect(workspaceIdFromScope({ kind: 'workspace', workspaceId: 'w1' })).toBe('w1')
  })
})
