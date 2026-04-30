import { describe, expect, test } from 'bun:test'

import {
  buildCompoundRoute,
  buildRouteFromNavigationState,
  parseCompoundRoute,
  parseRoute,
  parseRouteToNavigationState,
} from '../route-parser'
import { routes } from '../routes'

describe('route-parser: workbench routes', () => {
  test('builds first-class Experience Layer routes', () => {
    expect(routes.view.workbench()).toBe('workbench/deep-missions')
    expect(routes.view.workbench('arena-builder')).toBe('workbench/arena-builder')
    expect(routes.view.workbench('mission-control')).toBe('workbench/mission-control')
    expect(routes.view.workbench('progression')).toBe('workbench/progression')
    expect(routes.view.workbench('quest-map')).toBe('workbench/quest-map')
    expect(routes.view.workbench('agent-forge')).toBe('workbench/agent-forge')
  })

  test('parses workbench route into a dedicated navigator', () => {
    const parsed = parseCompoundRoute('workbench/arena-builder')

    expect(parsed).toEqual({
      navigator: 'workbench',
      details: { type: 'workbench', id: 'arena-builder' },
    })
  })

  test('roundtrips workbench navigation state', () => {
    const state = parseRouteToNavigationState('workbench/quest-map')

    expect(state).toEqual({
      navigator: 'workbench',
      screen: 'quest-map',
    })
    expect(buildRouteFromNavigationState(state!)).toBe('workbench/quest-map')
  })

  test('converts workbench compound routes to view routes', () => {
    expect(parseRoute('workbench/agent-forge')).toEqual({
      type: 'view',
      name: 'workbench',
      id: 'agent-forge',
      params: {},
    })
  })

  test('builds workbench compound route from parsed state', () => {
    expect(buildCompoundRoute({
      navigator: 'workbench',
      details: { type: 'workbench', id: 'mission-control' },
    })).toBe('workbench/mission-control')
  })
})
