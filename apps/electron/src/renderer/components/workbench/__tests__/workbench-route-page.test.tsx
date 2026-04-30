import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { WorkbenchRoutePage } from '../WorkbenchRoutePage'

describe('WorkbenchRoutePage', () => {
  test.each([
    ['deep-missions', 'Deep Missions'],
    ['arena-builder', 'Arena Builder'],
    ['mission-control', 'Mission Control'],
    ['progression', 'Progression Observatory'],
    ['quest-map', 'Quest Map'],
    ['agent-forge', 'Agent Forge'],
  ] as const)('renders %s as a first-class screen', (screen, expectedTitle) => {
    const markup = renderToStaticMarkup(<WorkbenchRoutePage screen={screen} />)

    expect(markup).toContain(expectedTitle)
    expect(markup).toContain('Experience Layer')
  })
})
