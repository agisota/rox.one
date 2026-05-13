/**
 * Hand-rolled UUID v7 generator.
 *
 * Layout (per RFC 9562):
 *   - 48 bits: Unix epoch milliseconds (big-endian).
 *   - 4 bits: version (`0111` = 7).
 *   - 12 bits: random.
 *   - 2 bits: variant (`10` = RFC 4122).
 *   - 62 bits: random.
 *
 * UUID v7 is time-sortable and B-tree friendly, matching the user
 * engineering rule for IDs. Bun's `crypto.randomUUID()` returns a v4,
 * so we hand-roll v7 here using `crypto.getRandomValues` for the
 * random fields.
 *
 * Returns lower-case hyphenated form.
 */

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

export function uuidV7(nowMs: number = Date.now()): string {
  const bytes = new Uint8Array(16)

  // 48-bit timestamp (big-endian).
  const ms = Math.max(0, Math.floor(nowMs))
  const high = Math.floor(ms / 2 ** 32)
  const low = ms >>> 0
  bytes[0] = (high >>> 8) & 0xff
  bytes[1] = high & 0xff
  bytes[2] = (low >>> 24) & 0xff
  bytes[3] = (low >>> 16) & 0xff
  bytes[4] = (low >>> 8) & 0xff
  bytes[5] = low & 0xff

  // 80 bits of random.
  const random = new Uint8Array(10)
  crypto.getRandomValues(random)
  for (let i = 0; i < 10; i += 1) {
    bytes[6 + i] = random[i] ?? 0
  }

  // Set version (top nibble of byte 6) to 7.
  bytes[6] = (bytes[6]! & 0x0f) | 0x70
  // Set variant (top two bits of byte 8) to `10`.
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, toHex).join('')
  return (
    `${hex.slice(0, 8)}-` +
    `${hex.slice(8, 12)}-` +
    `${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-` +
    `${hex.slice(20, 32)}`
  )
}

/**
 * Extract the embedded millisecond timestamp from a v7 UUID.
 * Returns NaN for strings that are not v7.
 */
export function uuidV7TimestampMs(value: string): number {
  if (typeof value !== 'string') return Number.NaN
  const stripped = value.replace(/-/g, '').toLowerCase()
  if (stripped.length !== 32) return Number.NaN
  const version = stripped.charAt(12)
  if (version !== '7') return Number.NaN
  const hex = stripped.slice(0, 12)
  // 48-bit value; safe inside Number.MAX_SAFE_INTEGER.
  return Number.parseInt(hex, 16)
}
