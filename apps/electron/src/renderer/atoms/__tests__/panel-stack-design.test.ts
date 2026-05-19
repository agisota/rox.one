import { describe, expect, test } from 'bun:test'

import { getPanelTypeFromRoute } from '../panel-stack'

describe('panel-stack: Rox Design lane classification', () => {
  test('classifies the design route as a design panel', () => {
    expect(getPanelTypeFromRoute('design')).toBe('design')
  })
})
