/**
 * Tests for `experience-id` — M.9 T270.
 *
 * Verifies the parser accepts canonical UUID v7 strings, rejects every
 * shape/version/variant defect with a typed error, and the brand escape hatch
 * (`unsafeExperienceId`) refuses bad input loudly.
 */
import { describe, it, expect } from 'bun:test';
import {
  isExperienceId,
  parseExperienceId,
  unsafeExperienceId,
  experienceIdToString,
} from '../experience-id.ts';

const VALID_V7 = '0190a4d2-1234-7abc-89de-0123456789ab';
const VALID_V7_VARIANT_B = '0190a4d2-1234-7abc-bdef-0123456789ab';

describe('parseExperienceId', () => {
  it('accepts canonical UUID v7', () => {
    const result = parseExperienceId(VALID_V7);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(experienceIdToString(result.value)).toBe(VALID_V7);
    }
  });

  it('accepts each valid variant nibble (8,9,a,b)', () => {
    for (const variant of ['8', '9', 'a', 'b']) {
      const candidate = `0190a4d2-1234-7abc-${variant}def-0123456789ab`;
      const result = parseExperienceId(candidate);
      expect(result.ok).toBe(true);
    }
  });

  it('lower-cases mixed-case input', () => {
    const result = parseExperienceId('0190A4D2-1234-7ABC-89DE-0123456789AB');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(experienceIdToString(result.value)).toBe(VALID_V7);
    }
  });

  it('trims surrounding whitespace', () => {
    const result = parseExperienceId(`   ${VALID_V7_VARIANT_B}   `);
    expect(result.ok).toBe(true);
  });

  it('rejects empty string with reason=empty', () => {
    const result = parseExperienceId('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('empty');
    }
  });

  it('rejects too-short input with reason=wrong-length', () => {
    const result = parseExperienceId('0190a4d2-1234-7abc');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('wrong-length');
    }
  });

  it('rejects too-long input with reason=wrong-length', () => {
    const result = parseExperienceId(VALID_V7 + 'aa');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('wrong-length');
    }
  });

  it('rejects non-hex characters with reason=wrong-shape', () => {
    const result = parseExperienceId('0190a4d2-1234-7abc-89de-0123456789zz');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('wrong-shape');
    }
  });

  it('rejects wrong version nibble (v4 instead of v7) with reason=wrong-version', () => {
    const result = parseExperienceId('0190a4d2-1234-4abc-89de-0123456789ab');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('wrong-version');
    }
  });

  it('rejects wrong variant nibble (c) with reason=wrong-variant', () => {
    const result = parseExperienceId('0190a4d2-1234-7abc-cdef-0123456789ab');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('wrong-variant');
    }
  });

  it('preserves the original `input` on the error payload', () => {
    const result = parseExperienceId('not-a-uuid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.input).toBe('not-a-uuid');
      expect(result.error.kind).toBe('ExperienceIdParseError');
    }
  });
});

describe('isExperienceId', () => {
  it('returns true for a valid v7', () => {
    expect(isExperienceId(VALID_V7)).toBe(true);
  });
  it('returns false for non-strings', () => {
    expect(isExperienceId(42)).toBe(false);
    expect(isExperienceId(null)).toBe(false);
    expect(isExperienceId(undefined)).toBe(false);
    expect(isExperienceId({})).toBe(false);
  });
  it('returns false for malformed strings', () => {
    expect(isExperienceId('nope')).toBe(false);
  });
});

describe('unsafeExperienceId', () => {
  it('returns a branded id on valid input', () => {
    const id = unsafeExperienceId(VALID_V7);
    expect(experienceIdToString(id)).toBe(VALID_V7);
  });
  it('throws on invalid input rather than producing a fake brand', () => {
    expect(() => unsafeExperienceId('not-a-uuid')).toThrow(/not a valid UUID v7/);
  });
});
