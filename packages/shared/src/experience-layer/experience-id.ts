/**
 * Experience Identifier — M.9 T270.
 *
 * Branded `ExperienceId` carrying a UUID v7-shaped string. The brand symbol
 * is module-local: callers cannot synthesise an `ExperienceId` without going
 * through {@link parseExperienceId} or {@link unsafeExperienceId}.
 *
 * Shape validation is structural only (8-4-4-4-12 lowercase hex with the
 * canonical version nibble `7` and variant `8|9|a|b`). We deliberately do not
 * mint IDs here — the kernel is pure; minting is a host concern (see T271).
 *
 * Pure module. No I/O, no side effects, no rxjs.
 */

declare const experienceIdBrand: unique symbol;

export type ExperienceId = string & { readonly [experienceIdBrand]: 'ExperienceId' };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface ExperienceIdParseError {
  readonly kind: 'ExperienceIdParseError';
  readonly input: string;
  readonly reason:
    | 'empty'
    | 'wrong-length'
    | 'wrong-shape'
    | 'wrong-version'
    | 'wrong-variant';
}

// 8-4-4-4-12 lowercase hex; version nibble `7`; variant nibble in {8,9,a,b}.
const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const GENERIC_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseExperienceId(
  input: string,
): Result<ExperienceId, ExperienceIdParseError> {
  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, error: { kind: 'ExperienceIdParseError', input, reason: 'empty' } };
  }
  const normalised = input.trim().toLowerCase();
  if (normalised.length !== 36) {
    return {
      ok: false,
      error: { kind: 'ExperienceIdParseError', input, reason: 'wrong-length' },
    };
  }
  if (!GENERIC_UUID_REGEX.test(normalised)) {
    return {
      ok: false,
      error: { kind: 'ExperienceIdParseError', input, reason: 'wrong-shape' },
    };
  }
  // version nibble = 13th char (0-indexed position 14)
  if (normalised[14] !== '7') {
    return {
      ok: false,
      error: { kind: 'ExperienceIdParseError', input, reason: 'wrong-version' },
    };
  }
  // variant nibble = 17th char (0-indexed position 19)
  const variant = normalised[19];
  if (variant !== '8' && variant !== '9' && variant !== 'a' && variant !== 'b') {
    return {
      ok: false,
      error: { kind: 'ExperienceIdParseError', input, reason: 'wrong-variant' },
    };
  }
  if (!UUID_V7_REGEX.test(normalised)) {
    return {
      ok: false,
      error: { kind: 'ExperienceIdParseError', input, reason: 'wrong-shape' },
    };
  }
  return { ok: true, value: normalised as ExperienceId };
}

export function isExperienceId(input: unknown): input is ExperienceId {
  if (typeof input !== 'string') return false;
  const parsed = parseExperienceId(input);
  return parsed.ok;
}

/**
 * Escape hatch for trusted internal callers (e.g. tests, host bootstrap).
 * Throws on invalid shape so the brand stays a real proof.
 */
export function unsafeExperienceId(input: string): ExperienceId {
  const parsed = parseExperienceId(input);
  if (!parsed.ok) {
    throw new Error(
      `unsafeExperienceId: ${input} is not a valid UUID v7 (${parsed.error.reason})`,
    );
  }
  return parsed.value;
}

export function experienceIdToString(id: ExperienceId): string {
  return id;
}
