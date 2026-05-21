/**
 * User data contract — Zod schema + inferred TypeScript type.
 *
 * A `User` is the identity owner: one human, one row. Federated provider
 * links live in `Identity` (see ./identity.ts) and are joined many-to-one.
 *
 * See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { z } from 'zod';
import { UuidV7Schema } from './uuid-v7.ts';

/** RFC 5321 effective max for email local + domain. */
const EMAIL_MAX = 254;

/** Loose BCP-47 tag, e.g. `en-US`, `zh-Hans`, `pt-BR`. */
const LOCALE_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * Email schema — lower-cased at boundary by the repository. Schema-level
 * normalization is intentionally absent so that downstream callers can
 * detect raw input drift.
 */
export const EmailSchema = z
  .string()
  .min(3)
  .max(EMAIL_MAX)
  .email({ message: 'must be a valid email address' });

/**
 * Username — assigned later in WT-13; OPTIONAL on the v1 contract. Format
 * mirrors typical handle constraints: 3..32 chars, alphanumeric and `_`/`-`.
 */
export const UsernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, 'username may only contain A-Z, 0-9, _ and -');

export const LocaleSchema = z
  .string()
  .min(2)
  .max(15)
  .regex(LOCALE_REGEX, 'must be a BCP-47 tag (e.g. en-US, zh-Hans)');

/**
 * IANA timezone identifier. Schema validates shape only — runtime tz
 * validity must be checked at the boundary via `Intl.DateTimeFormat`.
 */
export const TimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_+\-/]*$/, 'must be an IANA timezone identifier');

/**
 * ISO-8601 UTC timestamp with explicit `Z` suffix. Stored in Postgres as
 * `TIMESTAMPTZ`. Conversion to local zone happens only at display layer
 * (per NFR-04.7).
 */
export const IsoUtcSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/,
    'must be ISO-8601 UTC ending in Z',
  );

export const UserStatusSchema = z.enum(['active', 'invited', 'suspended', 'deleted']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSchema = z.object({
  id: UuidV7Schema,
  /** FK → tenants.id (WT-05). Backfilled with `DEFAULT_TENANT_ID` pre-Foundation. */
  tenantId: UuidV7Schema,
  email: EmailSchema,
  username: UsernameSchema.optional(),
  displayName: z.string().min(1).max(255),
  locale: LocaleSchema.default('en-US'),
  timezone: TimezoneSchema.default('UTC'),
  status: UserStatusSchema,
  createdAtUtc: IsoUtcSchema,
  updatedAtUtc: IsoUtcSchema,
  /** Soft-delete marker (NFR-04.5 + WT-27 grace cleanup). */
  deletedAtUtc: IsoUtcSchema.nullable().default(null),
});

export type User = z.infer<typeof UserSchema>;
