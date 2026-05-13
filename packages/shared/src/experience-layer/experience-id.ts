/**
 * Experience Identifier — M.9 T270.
 *
 * Branded `ExperienceId` carrying a UUID v7-shaped string. The brand symbol
 * is module-local: callers cannot synthesise an `ExperienceId` without going
 * through {@link parseExperienceId} or {@link unsafeExperienceId}.
 *
 * Shape validation is structural only (8-4-4-4-12 lowercase hex with the
 * canonical version nibble `7` and variant `8|9|a|b`). We do not mint IDs —
 * the kernel is pure; minting is a host concern (see T271).
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

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GENERIC_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function err(input: string, reason: ExperienceIdParseError['reason']): Result<ExperienceId, ExperienceIdParseError> {
  return { ok: false, error: { kind: 'ExperienceIdParseError', input, reason } };
}

export function parseExperienceId(input: string): Result<ExperienceId, ExperienceIdParseError> {
  if (typeof input !== 'string' || input.length === 0) return err(input, 'empty');
  const normalised = input.trim().toLowerCase();
  if (normalised.length !== 36) return err(input, 'wrong-length');
  if (!GENERIC_UUID_REGEX.test(normalised)) return err(input, 'wrong-shape');
  if (normalised[14] !== '7') return err(input, 'wrong-version');
  const variant = normalised[19];
  if (variant !== '8' && variant !== '9' && variant !== 'a' && variant !== 'b') {
    return err(input, 'wrong-variant');
  }
  if (!UUID_V7_REGEX.test(normalised)) return err(input, 'wrong-shape');
  return { ok: true, value: normalised as ExperienceId };
}

export function isExperienceId(input: unknown): input is ExperienceId {
  if (typeof input !== 'string') return false;
  return parseExperienceId(input).ok;
}

/** Throws on invalid shape so the brand stays a real proof. */
export function unsafeExperienceId(input: string): ExperienceId {
  const parsed = parseExperienceId(input);
  if (!parsed.ok) {
    throw new Error(`unsafeExperienceId: ${input} is not a valid UUID v7 (${parsed.error.reason})`);
  }
  return parsed.value;
}

export function experienceIdToString(id: ExperienceId): string {
  return id;
}
