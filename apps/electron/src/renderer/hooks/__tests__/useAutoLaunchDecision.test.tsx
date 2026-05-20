/**
 * TDD: useAutoLaunchDecision hook (T537 Phase D, cycles 7-12)
 *
 * Tests the decision matrix:
 *   - choice='ask'    + confidence > 0.7 → 'ask-user'
 *   - choice='always' + confidence > 0.7 → 'always-launch'
 *   - choice='never'  + confidence > 0.7 → 'never-launch'
 *   - confidence ≤ 0.7 always → 'never-launch' (classifier not confident)
 *   - choice='always' + confidence ≤ 0.7 → 'never-launch'
 *   - choice='never'  + confidence ≤ 0.7 → 'never-launch'
 *
 * Note: uses bun:test (no DOM required — pure function tests).
 */

import { describe, it, expect } from 'bun:test'
import { getAutoLaunchDecision } from '../useAutoLaunchDecision'
import type { ClassifierResult } from '../useAutoLaunchDecision'

// ── Cycle 7 & 8: choice='ask' + classifier > 0.7 → 'ask-user' ─────────────

describe('getAutoLaunchDecision', () => {
  it('returns "ask-user" when choice is "ask" and confidence > 0.7', () => {
    const result: ClassifierResult = { confidence: 0.9, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('ask', result)).toBe('ask-user')
  })

  it('returns "ask-user" when choice is "ask" and confidence is exactly 0.71', () => {
    const result: ClassifierResult = { confidence: 0.71, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('ask', result)).toBe('ask-user')
  })

  // ── Cycle 9 & 10: choice='always' + classifier > 0.7 → 'always-launch' ─────

  it('returns "always-launch" when choice is "always" and confidence > 0.7', () => {
    const result: ClassifierResult = { confidence: 0.85, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('always', result)).toBe('always-launch')
  })

  it('returns "always-launch" when choice is "always" and confidence is 1.0', () => {
    const result: ClassifierResult = { confidence: 1.0, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('always', result)).toBe('always-launch')
  })

  // ── Cycle 11 & 12: choice='never' + classifier > 0.7 → 'never-launch' ──────

  it('returns "never-launch" when choice is "never" regardless of confidence', () => {
    const high: ClassifierResult = { confidence: 0.95, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('never', high)).toBe('never-launch')
  })

  it('returns "never-launch" when choice is "never" and confidence is low', () => {
    const low: ClassifierResult = { confidence: 0.3, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('never', low)).toBe('never-launch')
  })

  // ── Confidence threshold: ≤ 0.7 means not confident enough ─────────────────

  it('returns "never-launch" when confidence ≤ 0.7 even if choice is "ask"', () => {
    const result: ClassifierResult = { confidence: 0.7, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('ask', result)).toBe('never-launch')
  })

  it('returns "never-launch" when confidence ≤ 0.7 even if choice is "always"', () => {
    const result: ClassifierResult = { confidence: 0.5, topClass: 'design', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('always', result)).toBe('never-launch')
  })

  it('returns "never-launch" when topClass is "other" regardless of confidence', () => {
    const result: ClassifierResult = { confidence: 0.95, topClass: 'other', matchedSignals: [], secondBestGap: 0 }
    expect(getAutoLaunchDecision('always', result)).toBe('never-launch')
  })

  it('returns "never-launch" when classifier result is null', () => {
    expect(getAutoLaunchDecision('ask', null)).toBe('never-launch')
  })

  it('returns "never-launch" when classifier result is undefined', () => {
    expect(getAutoLaunchDecision('always', undefined)).toBe('never-launch')
  })
})
