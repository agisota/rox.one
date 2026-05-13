/** Tests for `experience-id` — M.9 T270. */
import { describe, it, expect } from 'bun:test';
import {
  isExperienceId,
  parseExperienceId,
  unsafeExperienceId,
  experienceIdToString,
  type ExperienceIdParseError,
} from '../experience-id.ts';

const VALID_V7 = '0190a4d2-1234-7abc-89de-0123456789ab';
const VALID_V7_VARIANT_B = '0190a4d2-1234-7abc-bdef-0123456789ab';

function expectReason(input: string, reason: ExperienceIdParseError['reason']): void {
  const r = parseExperienceId(input);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.reason).toBe(reason);
}

describe('parseExperienceId', () => {
  it('accepts canonical UUID v7', () => {
    const r = parseExperienceId(VALID_V7);
    expect(r.ok).toBe(true);
    if (r.ok) expect(experienceIdToString(r.value)).toBe(VALID_V7);
  });

  it('accepts each valid variant nibble (8,9,a,b)', () => {
    for (const v of ['8', '9', 'a', 'b']) {
      expect(parseExperienceId(`0190a4d2-1234-7abc-${v}def-0123456789ab`).ok).toBe(true);
    }
  });

  it('lower-cases mixed-case input', () => {
    const r = parseExperienceId('0190A4D2-1234-7ABC-89DE-0123456789AB');
    expect(r.ok).toBe(true);
    if (r.ok) expect(experienceIdToString(r.value)).toBe(VALID_V7);
  });

  it('trims surrounding whitespace', () =>
    expect(parseExperienceId(`   ${VALID_V7_VARIANT_B}   `).ok).toBe(true));

  it('rejects empty → reason=empty', () => expectReason('', 'empty'));
  it('rejects too-short → wrong-length', () => expectReason('0190a4d2-1234-7abc', 'wrong-length'));
  it('rejects too-long → wrong-length', () => expectReason(VALID_V7 + 'aa', 'wrong-length'));
  it('rejects non-hex → wrong-shape', () =>
    expectReason('0190a4d2-1234-7abc-89de-0123456789zz', 'wrong-shape'));
  it('rejects v4 → wrong-version', () =>
    expectReason('0190a4d2-1234-4abc-89de-0123456789ab', 'wrong-version'));
  it('rejects variant c → wrong-variant', () =>
    expectReason('0190a4d2-1234-7abc-cdef-0123456789ab', 'wrong-variant'));

  it('preserves the original `input` on the error payload', () => {
    const r = parseExperienceId('not-a-uuid');
    if (!r.ok) {
      expect(r.error.input).toBe('not-a-uuid');
      expect(r.error.kind).toBe('ExperienceIdParseError');
    } else throw new Error('expected error');
  });
});

describe('isExperienceId', () => {
  it('returns true for a valid v7', () => expect(isExperienceId(VALID_V7)).toBe(true));
  it('returns false for non-strings', () => {
    expect(isExperienceId(42)).toBe(false);
    expect(isExperienceId(null)).toBe(false);
    expect(isExperienceId(undefined)).toBe(false);
    expect(isExperienceId({})).toBe(false);
  });
  it('returns false for malformed strings', () => expect(isExperienceId('nope')).toBe(false));
});

describe('unsafeExperienceId', () => {
  it('returns a branded id on valid input', () =>
    expect(experienceIdToString(unsafeExperienceId(VALID_V7))).toBe(VALID_V7));
  it('throws on invalid input rather than producing a fake brand', () =>
    expect(() => unsafeExperienceId('not-a-uuid')).toThrow(/not a valid UUID v7/));
});
