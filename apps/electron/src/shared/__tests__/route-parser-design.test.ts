import { describe, expect, test } from 'bun:test'

import {
  buildCompoundRoute,
  buildRouteFromNavigationState,
  parseCompoundRoute,
  parseRoute,
  parseRouteToNavigationState,
} from '../route-parser'
import { getNavigationStateKey, parseNavigationStateKey } from '../types'
import { routes } from '../routes'

describe('route-parser: Rox Design routes', () => {
  test('builds a first-class Rox Design route', () => {
    expect(routes.view.design()).toBe('design')
  })

  test('parses design route into a dedicated navigator', () => {
    expect(parseCompoundRoute('design')).toEqual({
      navigator: 'design',
      details: null,
    })
  })

  test('roundtrips design navigation state', () => {
    const state = parseRouteToNavigationState('design')

    expect(state).toEqual({ navigator: 'design' })
    expect(buildRouteFromNavigationState(state!)).toBe('design')
  })

  test('converts design compound route to a view route', () => {
    expect(parseRoute('design')).toEqual({
      type: 'view',
      name: 'design',
      params: {},
    })
  })

  test('builds design compound route from parsed state', () => {
    expect(buildCompoundRoute({ navigator: 'design', details: null })).toBe('design')
  })

  test('serializes design navigation keys for panel reconciliation', () => {
    const state = { navigator: 'design' } as const
    expect(getNavigationStateKey(state)).toBe('design')
    expect(parseNavigationStateKey('design')).toEqual(state)
  })
})
