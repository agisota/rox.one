import { describe, expect, it } from 'bun:test'

import { createDurableMissionScheduler, DurableMissionScheduler } from '@rox-one/server-core/mission-scheduler'

describe('mission scheduler package export', () => {
  it('exposes the durable scheduler contract through server-core', () => {
    expect(createDurableMissionScheduler).toBeTypeOf('function')
    expect(DurableMissionScheduler).toBeTypeOf('function')
  })
})
