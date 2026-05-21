/**
 * UUID v7 generator and Zod schema — RFC 9562 conformant.
 *
 * Layout:
 *   - 48 bits: Unix epoch milliseconds (big-endian)
 *   - 4 bits:  version (`0111` = 7)
 *   - 12 bits: random
 *   - 2 bits:  variant (`10` = RFC 4122)
 *   - 62 bits: random
 *
 * Time-sortable, B-tree friendly, pure-JS, no native deps. Used everywhere
 * an `IdSchema` is declared in `@rox-one/shared/core`.
 *
 * Note: a parallel hand-roll exists at
 * `packages/server-core/src/persistence/sqlite/uuid-v7.ts` for the M.6
 * sqlite persistence layer; the two implementations are byte-compatible
 * but live in independent packages to avoid a cross-package import cycle.
 */

import { z } from 'zod';

/**
 * Well-known UUID v7 reserved for the default tenant. Used as the FK
 * backfill while `rox.feature.contracts.tenant-v1` is OFF — see FR-04.5.
 */
export const DEFAULT_TENANT_ID = '01900000-0000-7000-8000-000000000000';

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Generate a new UUID v7. Deterministic only in the timestamp prefix;
 * the trailing 74 random bits come from `crypto.getRandomValues`.
 */
export function uuidV7(nowMs: number = Date.now()): string {
  const bytes = new Uint8Array(16);

  // 48-bit timestamp (big-endian).
  const ms = Math.max(0, Math.floor(nowMs));
  const high = Math.floor(ms / 2 ** 32);
  const low = ms >>> 0;
  bytes[0] = (high >>> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >>> 24) & 0xff;
  bytes[3] = (low >>> 16) & 0xff;
  bytes[4] = (low >>> 8) & 0xff;
  bytes[5] = low & 0xff;

  // 80 bits of random (we'll then overwrite version+variant nibbles).
  const random = new Uint8Array(10);
  crypto.getRandomValues(random);
  for (let i = 0; i < 10; i += 1) {
    bytes[6 + i] = random[i] ?? 0;
  }

  // Set version (top nibble of byte 6) to 7.
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // Set variant (top two bits of byte 8) to `10`.
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, toHex).join('');
  return (
    `${hex.slice(0, 8)}-` +
    `${hex.slice(8, 12)}-` +
    `${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-` +
    `${hex.slice(20, 32)}`
  );
}

/**
 * Extract the embedded millisecond timestamp from a v7 UUID.
 * Returns NaN for strings that are not v7.
 */
export function uuidV7TimestampMs(value: string): number {
  if (typeof value !== 'string') return Number.NaN;
  const stripped = value.replace(/-/g, '').toLowerCase();
  if (stripped.length !== 32) return Number.NaN;
  const version = stripped.charAt(12);
  if (version !== '7') return Number.NaN;
  const hex = stripped.slice(0, 12);
  return Number.parseInt(hex, 16);
}

/** Type-narrowing guard. */
export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_REGEX.test(value);
}

/**
 * Zod schema for UUID v7 strings. Use everywhere an ID column maps to a
 * sortable, B-tree-friendly UUID. Reject v4 and other variants to keep
 * downstream indexes optimal.
 */
export const UuidV7Schema = z
  .string()
  .regex(UUID_V7_REGEX, 'must be a lower-case hyphenated UUID v7');

export type UuidV7 = z.infer<typeof UuidV7Schema>;
