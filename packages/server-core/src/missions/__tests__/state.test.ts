import { describe, expect, it } from 'bun:test'

import {
  isMissionTerminal,
  MISSION_STATE_KINDS,
  type MissionState,
} from '../state.ts'

const ISO = '2026-05-13T12:00:00.000Z'

describe('MissionState', () => {
  it('exposes the full state-kind catalogue', () => {
    expect(MISSION_STATE_KINDS).toEqual([
      'Pending',
      'Running',
      'Paused',
      'Awaiting',
      'Completed',
      'Failed',
      'Cancelled',
    ])
    expect(MISSION_STATE_KINDS).toHaveLength(7)
  })

  it('isMissionTerminal flags Completed, Failed and Cancelled', () => {
    const completed: MissionState = { kind: 'Completed', at: ISO, output: 'ok' }
    const failed: MissionState = { kind: 'Failed', at: ISO, reason: 'boom' }
    const cancelled: MissionState = { kind: 'Cancelled', at: ISO, reason: 'user' }
    expect(isMissionTerminal(completed)).toBe(true)
    expect(isMissionTerminal(failed)).toBe(true)
    expect(isMissionTerminal(cancelled)).toBe(true)
  })

  it('isMissionTerminal returns false for live states', () => {
    expect(isMissionTerminal({ kind: 'Pending', createdAt: ISO })).toBe(false)
    expect(isMissionTerminal({ kind: 'Running', startedAt: ISO })).toBe(false)
    expect(isMissionTerminal({ kind: 'Paused', at: ISO, reason: 'manual' })).toBe(false)
    expect(isMissionTerminal({ kind: 'Awaiting', at: ISO, prompt: 'why?' })).toBe(false)
  })

  it('Pending state carries createdAt only', () => {
    const s: MissionState = { kind: 'Pending', createdAt: ISO }
    expect(s.kind).toBe('Pending')
    expect(s.createdAt).toBe(ISO)
  })

  it('Running state carries startedAt', () => {
    const s: MissionState = { kind: 'Running', startedAt: ISO }
    expect(s.kind).toBe('Running')
    expect(s.startedAt).toBe(ISO)
  })

  it('Paused state carries reason and timestamp', () => {
    const s: MissionState = { kind: 'Paused', at: ISO, reason: 'rate-limit' }
    expect(s.reason).toBe('rate-limit')
  })

  it('Awaiting state carries a prompt to the human', () => {
    const s: MissionState = { kind: 'Awaiting', at: ISO, prompt: 'pick branch a or b' }
    expect(s.prompt).toBe('pick branch a or b')
  })

  it('Completed state carries a serialized output', () => {
    const s: MissionState = { kind: 'Completed', at: ISO, output: 'finished' }
    expect(s.output).toBe('finished')
  })

  it('Failed state carries a reason', () => {
    const s: MissionState = { kind: 'Failed', at: ISO, reason: 'timeout' }
    expect(s.reason).toBe('timeout')
  })

  it('Cancelled state carries a reason', () => {
    const s: MissionState = { kind: 'Cancelled', at: ISO, reason: 'user-request' }
    expect(s.reason).toBe('user-request')
  })
})
