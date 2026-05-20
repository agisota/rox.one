/**
 * Integration tests: useAutoLaunchDecision + real @rox-one/design-classifier
 *
 * Verifies end-to-end path: prompt → classifyDesignTask → getAutoLaunchDecision.
 * No mocking — the real classifier runs on actual prompt strings.
 *
 * PZD-50 / T537 Phase D
 */

import { describe, it, expect } from 'bun:test'
import { getAutoLaunchDecision } from '../useAutoLaunchDecision'
import { classifyDesignTask } from '@rox-one/design-classifier'

describe('useAutoLaunchDecision integration: real classifier', () => {
  it('integration: design prompt → real classifier → ask-user when choice=ask', () => {
    // «сделай лендинг» — Russian design prompt with strong signal ('лендинг', weight 2)
    const result = classifyDesignTask('сделай лендинг')
    const decision = getAutoLaunchDecision('ask', result)
    expect(decision).toBe('ask-user')
  })

  it('integration: non-design prompt → never-launch', () => {
    // «fix sql bug» — matches negative signals: fix (+1), sql (+2), bug (+1)
    const result = classifyDesignTask('fix sql bug')
    const decision = getAutoLaunchDecision('always', result)
    expect(decision).toBe('never-launch')
  })
})
