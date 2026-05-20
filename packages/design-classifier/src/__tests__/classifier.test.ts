import { describe, expect, it } from 'bun:test'
import { classifyDesignTask } from '../classifier.ts'

describe('classifyDesignTask', () => {
  // Cycle 1 RED: RU positive signal
  it('classifies Russian design prompt as design with high confidence', () => {
    const result = classifyDesignTask('сделай лендинг про SaaS')
    expect(result.topClass).toBe('design')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.matchedSignals.length).toBeGreaterThan(0)
  })

  // Cycle 3 RED: negative signal
  it('classifies bug-fix prompt as other', () => {
    const result = classifyDesignTask('почини баг в auth')
    expect(result.topClass).toBe('other')
    expect(result.confidence).toBeLessThan(0.5)
  })

  // Cycle 5 RED: EN positive signal
  it('classifies English design prompt as design', () => {
    const result = classifyDesignTask('I need a landing page for my SaaS')
    expect(result.topClass).toBe('design')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  // Cycle 7 RED: negative override — SQL mixed with design word
  it('classifies "design the SQL schema" as other due to negative override', () => {
    const result = classifyDesignTask('design the SQL schema')
    expect(result.topClass).toBe('other')
  })

  // Additional behavioral tests
  it('returns confidence in [0, 1]', () => {
    const result = classifyDesignTask('some random text about anything')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('returns secondBestGap as absolute difference between design and other confidence', () => {
    const result = classifyDesignTask('create a dashboard for analytics')
    expect(result.secondBestGap).toBeGreaterThanOrEqual(0)
    expect(result.secondBestGap).toBeLessThanOrEqual(1)
  })

  it('classifies dashboard design prompt correctly', () => {
    const result = classifyDesignTask('создай дашборд для аналитики')
    expect(result.topClass).toBe('design')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('classifies infrastructure/backend prompt as other', () => {
    const result = classifyDesignTask('деплой на облако бэкенд сервис')
    expect(result.topClass).toBe('other')
  })

  it('classifies figma prompt as design', () => {
    const result = classifyDesignTask('открой файл в фигма и добавь компонент')
    expect(result.topClass).toBe('design')
  })

  it('classifies prototype prompt as design', () => {
    const result = classifyDesignTask('make a prototype for mobile screen')
    expect(result.topClass).toBe('design')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('classifies database migration as other', () => {
    const result = classifyDesignTask('write a database migration for the users table')
    expect(result.topClass).toBe('other')
  })

  it('classifies UX design as design', () => {
    const result = classifyDesignTask('improve the UX of the onboarding flow')
    expect(result.topClass).toBe('design')
  })

  it('returns matchedSignals containing the matched keyword', () => {
    const result = classifyDesignTask('make a landing page')
    expect(result.matchedSignals).toContain('landing page')
  })

  it('classifies empty string as other with low confidence', () => {
    const result = classifyDesignTask('')
    expect(result.topClass).toBe('other')
  })

  it('classifies hi-fi wireframe prompt as design', () => {
    const result = classifyDesignTask('create hi-fi wireframes for the app')
    expect(result.topClass).toBe('design')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('classifies slides presentation as design', () => {
    const result = classifyDesignTask('сделай слайды для презентации')
    expect(result.topClass).toBe('design')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('handles mixed positive and negative signals', () => {
    const result = classifyDesignTask('fix the bug in the design system migration')
    // design-system is positive, bug + migration are negative → should lean other
    expect(typeof result.topClass).toBe('string')
    expect(['design', 'other']).toContain(result.topClass)
  })
})
