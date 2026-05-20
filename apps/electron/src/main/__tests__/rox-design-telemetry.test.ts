import { describe, expect, test, mock, beforeEach } from 'bun:test'
import {
  createRoxDesignTelemetry,
  type RoxDesignTelemetryRecord,
  type RoxDesignTelemetrySink,
} from '../rox-design-telemetry'

function createMockSink() {
  const records: RoxDesignTelemetryRecord[] = []
  const sink: RoxDesignTelemetrySink = {
    emit: mock((record: RoxDesignTelemetryRecord) => {
      records.push(record)
    }),
  }
  return { sink, records }
}

const FIXED_PLATFORM = 'linux' as const
const FIXED_ARCH = 'x64' as const

describe('RoxDesignTelemetry', () => {
  let now = 0
  const advanceTime = (ms: number) => {
    now += ms
  }
  const nowFn = () => now

  beforeEach(() => {
    now = 0
  })

  test('first-show emits a "first-show" record with cold=true on the first lifecycle', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    const span = telemetry.startShow()
    advanceTime(500)
    span.end()

    expect(records).toHaveLength(1)
    const event = records[0]
    expect(event.integration).toBe('rox-design')
    expect(event.event).toBe('first-show')
    expect(event.cold).toBe(true)
    expect(event.durationMs).toBeGreaterThanOrEqual(500)
    expect(event.platform).toBe(FIXED_PLATFORM)
    expect(event.arch).toBe(FIXED_ARCH)
  })

  test('second open flips cold flag to false and emits "warm-open"', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    const first = telemetry.startShow()
    advanceTime(700)
    first.end()

    const second = telemetry.startShow()
    advanceTime(120)
    second.end()

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ event: 'first-show', cold: true })
    expect(records[1]).toMatchObject({ event: 'warm-open', cold: false })
  })

  test('phase spans fire in correct order for a happy-path show', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    const span = telemetry.startShow()
    const spawn = span.startPhase('spawn-sidecar')
    advanceTime(200)
    spawn.end()
    const auth = span.startPhase('register-desktop-auth')
    advanceTime(50)
    auth.end()
    const attach = span.startPhase('attach-view')
    advanceTime(80)
    attach.end()
    const load = span.startPhase('load-url')
    advanceTime(120)
    load.end()
    const dom = span.startPhase('dom-ready')
    advanceTime(50)
    dom.end()
    const finish = span.startPhase('did-finish-load')
    advanceTime(40)
    finish.end()
    span.end()

    const phases = records
      .filter((r) => r.phase != null)
      .map((r) => r.phase)
    expect(phases).toEqual([
      'spawn-sidecar',
      'register-desktop-auth',
      'attach-view',
      'load-url',
      'dom-ready',
      'did-finish-load',
    ])
  })

  test('phase total approximately equals sum of sub-phases', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    const span = telemetry.startShow()
    const phaseDurations = [200, 50, 80, 120, 50, 40]
    const phaseNames = [
      'spawn-sidecar',
      'register-desktop-auth',
      'attach-view',
      'load-url',
      'dom-ready',
      'did-finish-load',
    ] as const
    for (let i = 0; i < phaseNames.length; i += 1) {
      const phase = span.startPhase(phaseNames[i])
      advanceTime(phaseDurations[i])
      phase.end()
    }
    span.end()

    const total = records.find((r) => r.event === 'first-show' && r.phase == null)
    const sumPhases = records
      .filter((r) => r.phase != null)
      .reduce((acc, r) => acc + r.durationMs, 0)
    expect(total).toBeDefined()
    expect(total!.durationMs).toBe(sumPhases)
  })

  test('INP samples are tagged with platform and arch', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    telemetry.reportInpSample(120)
    telemetry.reportInpSample(85)

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      integration: 'rox-design',
      event: 'inp-sample',
      durationMs: 120,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
    })
    expect(records[1]).toMatchObject({
      event: 'inp-sample',
      durationMs: 85,
    })
  })

  test('INP samples ignore non-finite, negative, or absurd values', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    telemetry.reportInpSample(Number.NaN)
    telemetry.reportInpSample(Number.POSITIVE_INFINITY)
    telemetry.reportInpSample(-1)
    telemetry.reportInpSample(120_000) // 2 minutes — out of plausible INP range
    telemetry.reportInpSample(180)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ event: 'inp-sample', durationMs: 180 })
  })

  test('exposes correct platform/arch derived from process when defaults used', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({ sink, now: nowFn })

    const span = telemetry.startShow()
    span.end()

    expect(records[0].platform).toBe(process.platform as 'darwin' | 'linux' | 'win32')
    expect(records[0].arch).toBe(process.arch as 'arm64' | 'x64')
  })

  test('does not emit duplicate "first-show" if same lifecycle span is ended twice', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    const span = telemetry.startShow()
    advanceTime(150)
    span.end()
    span.end()

    expect(records.filter((r) => r.event === 'first-show')).toHaveLength(1)
  })

  test('resetColdFlag forces the next show to be treated as cold again', () => {
    const { sink, records } = createMockSink()
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    telemetry.startShow().end()
    telemetry.resetColdFlag()
    telemetry.startShow().end()

    expect(records[0]).toMatchObject({ event: 'first-show', cold: true })
    expect(records[1]).toMatchObject({ event: 'first-show', cold: true })
  })

  test('sink errors do not propagate to caller', () => {
    const sink: RoxDesignTelemetrySink = {
      emit: () => {
        throw new Error('sink failure')
      },
    }
    const telemetry = createRoxDesignTelemetry({
      sink,
      platform: FIXED_PLATFORM,
      arch: FIXED_ARCH,
      now: nowFn,
    })

    expect(() => {
      const span = telemetry.startShow()
      span.startPhase('spawn-sidecar').end()
      span.end()
      telemetry.reportInpSample(50)
    }).not.toThrow()
  })
})
