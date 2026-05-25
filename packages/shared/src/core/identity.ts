/**
 * Identity data contract — federated provider link to a User.
 *
 * One user, many identities. The compound unique (tenantId, provider,
 * externalId) is enforced at the Postgres layer; the schema only validates
 * shape + claims size cap.
 *
 * See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { z } from 'zod';
import { IsoUtcSchema } from './user.ts';
import { UuidV7Schema } from './uuid-v7.ts';

/**
 * Max serialized size of the JSONB `claims` payload. Real-world Anthropic
 * OAuth JWT ~3KB, SCIM ~5KB; 16KB headroom 3x (per spec §22 Q3).
 */
export const IDENTITY_CLAIMS_MAX_BYTES = 16 * 1024;

export const IdentityProviderSchema = z.enum([
  'google',
  'slack',
  'microsoft',
  'anthropic-oauth',
  'scim',
  'rox-local',
]);
export type IdentityProvider = z.infer<typeof IdentityProviderSchema>;

const ClaimsSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx) => {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `claims must be JSON-serializable: ${(err as Error).message}`,
      });
      return;
    }
    if (serialized.length > IDENTITY_CLAIMS_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `claims serialized size ${serialized.length}B exceeds cap ${IDENTITY_CLAIMS_MAX_BYTES}B`,
      });
    }
  });

export const IdentitySchema = z.object({
  id: UuidV7Schema,
  userId: UuidV7Schema,
  /** Denormalized for tenant-isolation queries (FR-04.6, AC-04.6). */
  tenantId: UuidV7Schema,
  provider: IdentityProviderSchema,
  externalId: z.string().min(1).max(2048),
  /** Raw provider claims (JWT / SCIM); size-capped at 16KB. */
  claims: ClaimsSchema,
  primary: z.boolean().default(false),
  lastSeenAtUtc: IsoUtcSchema.nullable().default(null),
  createdAtUtc: IsoUtcSchema,
  deletedAtUtc: IsoUtcSchema.nullable().default(null),
});

export type Identity = z.infer<typeof IdentitySchema>;
