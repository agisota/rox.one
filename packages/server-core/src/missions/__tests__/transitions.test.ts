import { describe, expect, it } from 'bun:test'

import { transition, type MissionEvent } from '../transitions.ts'
import { MISSION_STATE_KINDS, type MissionState } from '../state.ts'

const T = '2026-05-13T00:00:00.000Z'
const T2 = '2026-05-13T01:00:00.000Z'

function pending(): MissionState {
  return { kind: 'Pending', createdAt: T }
}
function running(): MissionState {
  return { kind: 'Running', startedAt: T }
}
function paused(): MissionState {
  return { kind: 'Paused', at: T, reason: 'manual' }
}
function awaiting(): MissionState {
  return { kind: 'Awaiting', at: T, prompt: 'pick a branch' }
}
function completed(): MissionState {
  return { kind: 'Completed', at: T, output: 'done' }
}
function failed(): MissionState {
  return { kind: 'Failed', at: T, reason: 'boom' }
}
function cancelled(): MissionState {
  return { kind: 'Cancelled', at: T, reason: 'user' }
}

describe('transition - legal paths', () => {
  it('Pending + Start -> Running', () => {
    const r = transition(pending(), { kind: 'Start', at: T2 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Running')
      if (r.value.kind === 'Running') {
        expect(r.value.startedAt).toBe(T2)
      }
    }
  })

  it('Running + Pause -> Paused (reason recorded)', () => {
    const r = transition(running(), { kind: 'Pause', at: T2, reason: 'rate-limit' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'Paused') {
      expect(r.value.reason).toBe('rate-limit')
      expect(r.value.at).toBe(T2)
    }
  })

  it('Paused + Resume -> Running', () => {
    const r = transition(paused(), { kind: 'Resume', at: T2 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Running')
    }
  })

  it('Running + AwaitInput -> Awaiting (prompt recorded)', () => {
    const r = transition(running(), { kind: 'AwaitInput', at: T2, prompt: 'left or right?' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'Awaiting') {
      expect(r.value.prompt).toBe('left or right?')
    }
  })

  it('Awaiting + ProvideInput -> Running', () => {
    const r = transition(awaiting(), { kind: 'ProvideInput', at: T2, input: 'left' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Running')
    }
  })

  it('Running + Complete -> Completed', () => {
    const r = transition(running(), { kind: 'Complete', at: T2, output: 'shipped' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'Completed') {
      expect(r.value.output).toBe('shipped')
    }
  })

  it('Running + Fail -> Failed', () => {
    const r = transition(running(), { kind: 'Fail', at: T2, reason: 'OOM' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'Failed') {
      expect(r.value.reason).toBe('OOM')
    }
  })

  it('Pending + Cancel -> Cancelled', () => {
    const r = transition(pending(), { kind: 'Cancel', at: T2, reason: 'user-pre-start' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'Cancelled') {
      expect(r.value.reason).toBe('user-pre-start')
    }
  })

  it('Running + Cancel -> Cancelled', () => {
    const r = transition(running(), { kind: 'Cancel', at: T2, reason: 'user' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Cancelled')
    }
  })

  it('Paused + Cancel -> Cancelled', () => {
    const r = transition(paused(), { kind: 'Cancel', at: T2, reason: 'user' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Cancelled')
    }
  })

  it('Awaiting + Cancel -> Cancelled', () => {
    const r = transition(awaiting(), { kind: 'Cancel', at: T2, reason: 'timeout' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Cancelled')
    }
  })

  it('Awaiting + Fail -> Failed (no input ever provided)', () => {
    const r = transition(awaiting(), { kind: 'Fail', at: T2, reason: 'input-timeout' })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.kind === 'Failed') {
      expect(r.value.reason).toBe('input-timeout')
    }
  })

  it('Paused + Fail -> Failed', () => {
    const r = transition(paused(), { kind: 'Fail', at: T2, reason: 'rate-limit-fatal' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('Failed')
    }
  })
})

describe('transition - illegal paths return typed errors', () => {
  it('Pending + Pause is illegal', () => {
    const r = transition(pending(), { kind: 'Pause', at: T2, reason: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.kind).toBe('illegal_transition')
      expect(r.error.from).toBe('Pending')
      expect(r.error.event).toBe('Pause')
    }
  })

  it('Pending + Resume is illegal', () => {
    const r = transition(pending(), { kind: 'Resume', at: T2 })
    expect(r.ok).toBe(false)
  })

  it('Pending + Complete is illegal', () => {
    const r = transition(pending(), { kind: 'Complete', at: T2, output: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Running + Start is illegal (already started)', () => {
    const r = transition(running(), { kind: 'Start', at: T2 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.from).toBe('Running')
    }
  })

  it('Running + Resume is illegal (not paused)', () => {
    const r = transition(running(), { kind: 'Resume', at: T2 })
    expect(r.ok).toBe(false)
  })

  it('Running + ProvideInput is illegal (not awaiting)', () => {
    const r = transition(running(), { kind: 'ProvideInput', at: T2, input: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Awaiting + Start is illegal', () => {
    const r = transition(awaiting(), { kind: 'Start', at: T2 })
    expect(r.ok).toBe(false)
  })

  it('Awaiting + Pause is illegal (already paused on input)', () => {
    const r = transition(awaiting(), { kind: 'Pause', at: T2, reason: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Awaiting + Resume is illegal', () => {
    const r = transition(awaiting(), { kind: 'Resume', at: T2 })
    expect(r.ok).toBe(false)
  })

  it('Awaiting + Complete is illegal (must answer first)', () => {
    const r = transition(awaiting(), { kind: 'Complete', at: T2, output: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Paused + Start is illegal', () => {
    const r = transition(paused(), { kind: 'Start', at: T2 })
    expect(r.ok).toBe(false)
  })

  it('Paused + AwaitInput is illegal', () => {
    const r = transition(paused(), { kind: 'AwaitInput', at: T2, prompt: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Paused + ProvideInput is illegal', () => {
    const r = transition(paused(), { kind: 'ProvideInput', at: T2, input: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Paused + Complete is illegal', () => {
    const r = transition(paused(), { kind: 'Complete', at: T2, output: 'x' })
    expect(r.ok).toBe(false)
  })

  it('Terminal Completed rejects every event', () => {
    const events: MissionEvent[] = [
      { kind: 'Start', at: T2 },
      { kind: 'Pause', at: T2, reason: 'x' },
      { kind: 'Resume', at: T2 },
      { kind: 'AwaitInput', at: T2, prompt: 'x' },
      { kind: 'ProvideInput', at: T2, input: 'x' },
      { kind: 'Complete', at: T2, output: 'x' },
      { kind: 'Fail', at: T2, reason: 'x' },
      { kind: 'Cancel', at: T2, reason: 'x' },
    ]
    for (const e of events) {
      const r = transition(completed(), e)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.kind).toBe('terminal_state')
        expect(r.error.from).toBe('Completed')
      }
    }
  })

  it('Terminal Failed rejects every event', () => {
    const events: MissionEvent[] = [
      { kind: 'Start', at: T2 },
      { kind: 'Resume', at: T2 },
      { kind: 'Complete', at: T2, output: 'x' },
      { kind: 'Cancel', at: T2, reason: 'x' },
    ]
    for (const e of events) {
      const r = transition(failed(), e)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.kind).toBe('terminal_state')
      }
    }
  })

  it('Terminal Cancelled rejects every event', () => {
    const events: MissionEvent[] = [
      { kind: 'Start', at: T2 },
      { kind: 'Pause', at: T2, reason: 'x' },
      { kind: 'Resume', at: T2 },
      { kind: 'Complete', at: T2, output: 'x' },
    ]
    for (const e of events) {
      const r = transition(cancelled(), e)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error.kind).toBe('terminal_state')
      }
    }
  })
})

describe('transition - truth-table coverage', () => {
  // Pair every state with every event and assert ok-status matches the
  // canonical legality table. This is the formal coverage requirement.
  const states: Array<{ name: string; build: () => MissionState }> = [
    { name: 'Pending', build: pending },
    { name: 'Running', build: running },
    { name: 'Paused', build: paused },
    { name: 'Awaiting', build: awaiting },
    { name: 'Completed', build: completed },
    { name: 'Failed', build: failed },
    { name: 'Cancelled', build: cancelled },
  ]
  const events: Array<{ name: string; build: () => MissionEvent }> = [
    { name: 'Start', build: () => ({ kind: 'Start', at: T2 }) },
    { name: 'Pause', build: () => ({ kind: 'Pause', at: T2, reason: 'p' }) },
    { name: 'Resume', build: () => ({ kind: 'Resume', at: T2 }) },
    { name: 'AwaitInput', build: () => ({ kind: 'AwaitInput', at: T2, prompt: 'p' }) },
    { name: 'ProvideInput', build: () => ({ kind: 'ProvideInput', at: T2, input: 'i' }) },
    { name: 'Complete', build: () => ({ kind: 'Complete', at: T2, output: 'o' }) },
    { name: 'Fail', build: () => ({ kind: 'Fail', at: T2, reason: 'r' }) },
    { name: 'Cancel', build: () => ({ kind: 'Cancel', at: T2, reason: 'c' }) },
  ]
  // Canonical legality matrix: ok keys live in this set; everything else is illegal.
  const legal = new Set([
    'Pending|Start',
    'Pending|Cancel',
    'Running|Pause',
    'Running|AwaitInput',
    'Running|Complete',
    'Running|Fail',
    'Running|Cancel',
    'Paused|Resume',
    'Paused|Fail',
    'Paused|Cancel',
    'Awaiting|ProvideInput',
    'Awaiting|Fail',
    'Awaiting|Cancel',
  ])

  it('every state x event pair matches the canonical legality matrix', () => {
    expect(MISSION_STATE_KINDS).toHaveLength(states.length)
    for (const s of states) {
      for (const e of events) {
        const key = `${s.name}|${e.name}`
        const r = transition(s.build(), e.build())
        if (legal.has(key)) {
          expect(r.ok).toBe(true)
        } else {
          expect(r.ok).toBe(false)
        }
      }
    }
  })
})
