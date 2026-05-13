import { describe, expect, it } from 'bun:test'

import { isMissionId, parseMissionId, unsafeMissionId, type MissionId } from '../mission-id.ts'

const SAMPLE_V7 = '01977a3b-5c4d-7abc-9def-0123456789ab'
const SAMPLE_V4 = '01977a3b-5c4d-4abc-9def-0123456789ab'

describe('mission-id', () => {
  describe('isMissionId', () => {
    it('accepts a canonical uuid v7 string', () => {
      expect(isMissionId(SAMPLE_V7)).toBe(true)
    })

    it('rejects an empty string', () => {
      expect(isMissionId('')).toBe(false)
    })

    it('rejects non-string input', () => {
      expect(isMissionId(123 as unknown)).toBe(false)
      expect(isMissionId(null as unknown)).toBe(false)
      expect(isMissionId(undefined as unknown)).toBe(false)
      expect(isMissionId({} as unknown)).toBe(false)
    })

    it('rejects a uuid with the wrong version nibble', () => {
      expect(isMissionId(SAMPLE_V4)).toBe(false)
    })

    it('rejects a malformed string lacking dashes', () => {
      expect(isMissionId('01977a3b5c4d7abc9def0123456789ab')).toBe(false)
    })

    it('rejects a uuid v7 with uppercase hex (we normalize to lowercase)', () => {
      expect(isMissionId(SAMPLE_V7.toUpperCase())).toBe(false)
    })
  })

  describe('parseMissionId', () => {
    it('returns the branded id for a well-formed uuid v7', () => {
      const result = parseMissionId(SAMPLE_V7)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(SAMPLE_V7 as MissionId)
      }
    })

    it('returns a structured error for malformed input', () => {
      const result = parseMissionId('not-a-uuid')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_mission_id')
        expect(result.error.input).toBe('not-a-uuid')
      }
    })

    it('returns an error for a v4 uuid', () => {
      const result = parseMissionId(SAMPLE_V4)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_mission_id')
      }
    })

    it('rejects non-string inputs', () => {
      const result = parseMissionId(42 as unknown as string)
      expect(result.ok).toBe(false)
    })
  })

  describe('unsafeMissionId', () => {
    it('passes through a string as a brand', () => {
      const id = unsafeMissionId(SAMPLE_V7)
      expect(id).toBe(SAMPLE_V7 as MissionId)
    })

    it('does not validate (escape hatch for tests)', () => {
      const id = unsafeMissionId('arbitrary')
      expect(id).toBe('arbitrary' as MissionId)
    })
  })
})
