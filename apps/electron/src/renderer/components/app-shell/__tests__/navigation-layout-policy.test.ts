import { describe, expect, test } from 'bun:test'

import { shouldSuppressNavigatorForNavigation } from '../navigation-layout-policy'
import type { NavigationState } from '../../../../shared/types'

describe('navigation layout policy', () => {
  test('suppresses the intermediate navigator for Rox Design', () => {
    expect(shouldSuppressNavigatorForNavigation({ navigator: 'design' })).toBe(true)
  })

  test('keeps the navigator for normal session lists', () => {
    const state: NavigationState = {
      navigator: 'sessions',
      filter: { kind: 'allSessions' },
      details: null,
    }

    expect(shouldSuppressNavigatorForNavigation(state)).toBe(false)
  })
})
