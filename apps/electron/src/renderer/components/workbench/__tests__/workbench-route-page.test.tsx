import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { WorkbenchRoutePage } from '../WorkbenchRoutePage'

describe('WorkbenchRoutePage', () => {
  test.each([
    ['deep-missions', 'Долгие миссии'],
    ['arena-builder', 'Арена агентов'],
    ['mission-control', 'Центр миссий'],
    ['progression', 'Обсерватория прогресса'],
    ['quest-map', 'Карта квестов'],
    ['agent-forge', 'Кузница агентов'],
  ] as const)('renders %s as a first-class screen', (screen, expectedTitle) => {
    const markup = renderToStaticMarkup(<WorkbenchRoutePage screen={screen} />)

    expect(markup).toContain(expectedTitle)
    expect(markup).toContain('Слой опыта')
  })
})
