/**
 * Mission ID — branded uuid v7.
 *
 * A `MissionId` is a stringly-typed handle used everywhere we reason about
 * a mission. The brand is purely a compile-time guard; at runtime it is a
 * plain string. We require uuid v7 (time-sortable, B-tree friendly) per
 * the user-engineering rules on identifiers.
 */

export type MissionId = string & { readonly __brand: 'MissionId' }

export type MissionIdError = {
  readonly kind: 'invalid_mission_id'
  readonly input: unknown
  readonly reason: string
}

export type ParseMissionIdResult =
  | { readonly ok: true; readonly value: MissionId }
  | { readonly ok: false; readonly error: MissionIdError }

// Lowercase canonical uuid v7 — version nibble is 7, variant is 8/9/a/b.
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isMissionId(value: unknown): value is MissionId {
  return typeof value === 'string' && UUID_V7_REGEX.test(value)
}

export function parseMissionId(input: unknown): ParseMissionIdResult {
  if (typeof input !== 'string') {
    return {
      ok: false,
      error: { kind: 'invalid_mission_id', input, reason: 'not_a_string' },
    }
  }
  if (!UUID_V7_REGEX.test(input)) {
    return {
      ok: false,
      error: { kind: 'invalid_mission_id', input, reason: 'not_a_uuid_v7' },
    }
  }
  return { ok: true, value: input as MissionId }
}

/**
 * Escape hatch for fixture/test code that needs to forge an id without going
 * through validation. Never use this in product code paths.
 */
export function unsafeMissionId(value: string): MissionId {
  return value as MissionId
}

/**
 * Generate a fresh uuid v7. Falls back to `crypto.randomUUID` when the runtime
 * does not expose a v7 generator. The version nibble is patched so the result
 * matches the v7 contract even when the host returns v4 bytes.
 *
 * Pure inputs: a timestamp in ms and 10 random bytes. Useful for deterministic
 * tests if you swap the generator out via DI.
 */
export function generateMissionId(now: number, randomBytes: Uint8Array): MissionId {
  if (randomBytes.length < 10) {
    throw new Error('generateMissionId requires at least 10 random bytes')
  }
  const ms = BigInt(Math.max(0, Math.floor(now)))
  const hex = ms.toString(16).padStart(12, '0')
  const timeHigh = hex.slice(0, 8)
  const timeMid = hex.slice(8, 12)
  const r0 = randomBytes[0] ?? 0
  const r1 = randomBytes[1] ?? 0
  const r2 = randomBytes[2] ?? 0
  const r3 = randomBytes[3] ?? 0
  // Version 7 in the high nibble of byte 6.
  const versionByte = (0x70 | (r0 & 0x0f)).toString(16).padStart(2, '0')
  const rand1 = r1.toString(16).padStart(2, '0')
  // Variant 10xx in the high two bits of byte 8.
  const variantByte = (0x80 | (r2 & 0x3f)).toString(16).padStart(2, '0')
  const rand2 = r3.toString(16).padStart(2, '0')
  const tail = Array.from(randomBytes.slice(4, 10), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
  const id = `${timeHigh}-${timeMid}-${versionByte}${rand1}-${variantByte}${rand2}-${tail}`
  return id as MissionId
}
